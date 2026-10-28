import { BadRequestException, ConflictException, Injectable, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { isUUID } from 'class-validator';
import { combineProfiles, equalSetting, normalizeConfiguration, ProfileComposition, ProfileSource, ProfileFetchRequest, FetchResponse, ProfileSummary } from '../configuration';
import { FleetProfileEntity } from '../entities/fleet-profile.entity';
import { CombineFleetProfilesDto, SaveFleetProfileDto, UpdateFleetProfileDto } from './profiles.dto';
import { applyProfileFilter } from './profile-filter.query';
import { REQUIRED_PROFILES, seedRequiredProfiles } from './profile-defaults';

@Injectable()
export class ProfilesService implements OnApplicationBootstrap {
  constructor(private readonly db: DataSource) {}
  async onApplicationBootstrap(): Promise<void> {
    const metadata = this.db.getMetadata(FleetProfileEntity);
    const table = [metadata.schema || 'public', metadata.tableName].map(part => this.db.driver.escape(part)).join('.');
    await this.db.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_profiles_name_lower" ON ${table} (LOWER("name"))`);
    await seedRequiredProfiles(this.db.manager);
  }
  async list() {
    const profiles = await this.db.getRepository(FleetProfileEntity).find();
    const rank = (profile: FleetProfileEntity) => { const index = REQUIRED_PROFILES.findIndex(baseline => baseline.builtinKey === profile.builtinKey); return index < 0 ? 3 : index; };
    return profiles.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }
  async findOne(id: string): Promise<FleetProfileEntity> {
    const profile = await this.db.getRepository(FleetProfileEntity).findOneBy({id});
    if (!profile) throw new NotFoundException('Profile not found.');
    return profile;
  }
  async fetch(request: ProfileFetchRequest): Promise<FetchResponse<ProfileSummary>> {
    if (!Number.isInteger(request.pageIndex) || request.pageIndex < 0 || request.pageIndex > 1000000 || !Number.isInteger(request.pageSize) || request.pageSize < 1 || request.pageSize > 100) {
      throw new BadRequestException('Invalid profile page.');
    }
    const query = this.db.getRepository(FleetProfileEntity).createQueryBuilder('profile')
      .select(['profile.id', 'profile.name', 'profile.description', 'profile.revision', 'profile.builtinKey']);
    applyProfileFilter(query, request.filter);
    query.orderBy("CASE profile.builtinKey WHEN 'bronze' THEN 0 WHEN 'silver' THEN 1 WHEN 'gold' THEN 2 ELSE 3 END", 'ASC')
      .addOrderBy('LOWER(profile.name)', 'ASC').addOrderBy('profile.id', 'ASC')
      .skip(request.pageIndex * request.pageSize).take(request.pageSize);
    const [profiles, totalNumberOfRows] = await query.getManyAndCount();
    return {rows: profiles.map(({id, name, description, revision, builtinKey}) => ({id, name, description, revision, builtinKey})), totalNumberOfRows};
  }
  async duplicate(id: string, revision?: number): Promise<FleetProfileEntity> {
    try {
      return await this.db.transaction(async manager => {
        // Serialize duplicate clicks for the same source so copy names remain deterministic.
        const source = await manager.findOne(FleetProfileEntity, {where: {id}, lock: {mode: 'pessimistic_write'}});
        if (!source) throw new NotFoundException('Profile not found.');
        if (revision !== undefined && revision !== source.revision) throw new ConflictException('The source profile changed. Refresh the overview before duplicating.');
        let number = 1;
        let name: string;
        do {
          const suffix = number === 1 ? ' copy' : ` copy ${number}`;
          name = source.name.slice(0, 100 - suffix.length) + suffix;
          number++;
        } while (await manager.getRepository(FleetProfileEntity).createQueryBuilder('profile').where('LOWER(profile.name) = LOWER(:name)', {name}).getExists());
        return this.insert(manager, {name, description: source.description, configuration: structuredClone(source.configuration) as unknown as Record<string, unknown>});
      });
    } catch (error) {
      if (error.code === '23505') throw new ConflictException('That copy name was just taken. Try Duplicate again.');
      throw error;
    }
  }
  private configuration(input: unknown) {
    try { return normalizeConfiguration(input); }
    catch (error) { throw new BadRequestException(error.message); }
  }
  private async checkName(manager: EntityManager, name: string, exceptId?: string): Promise<void> {
    const query = manager.getRepository(FleetProfileEntity).createQueryBuilder('profile').where('LOWER(profile.name) = LOWER(:name)', { name });
    if (exceptId) query.andWhere('profile.id != :exceptId', {exceptId});
    if (await query.getExists()) throw new ConflictException('A profile with this name already exists.');
  }
  private async insert(manager: EntityManager, dto: SaveFleetProfileDto, composition?: ProfileComposition) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Profile name is required.');
    if (REQUIRED_PROFILES.some(profile => profile.name.toLowerCase() === name.toLowerCase())) throw new ConflictException('Bronze, Silver, and Gold are reserved baseline profiles.');
    await this.checkName(manager, name);
    return manager.save(FleetProfileEntity, manager.create(FleetProfileEntity, {
      name, description: dto.description || '', configuration: this.configuration(dto.configuration), composition: composition || null, revision: 1,
    }));
  }
  async create(dto: SaveFleetProfileDto) {
    try { return await this.db.transaction(manager => this.insert(manager, dto)); }
    catch (error) { if (error.code === '23505') throw new ConflictException('A profile with this name already exists.'); throw error; }
  }
  async update(id: string, dto: UpdateFleetProfileDto) {
    try {
      return await this.db.transaction(async manager => {
        const profile = await manager.findOne(FleetProfileEntity, {where: {id}, lock: {mode: 'pessimistic_write'}});
        if (!profile) throw new NotFoundException('Profile not found.');
        if (dto.revision !== profile.revision) throw new ConflictException('This profile changed since you opened it. Reload before saving.');
        if (profile.builtinKey && dto.name.trim() !== profile.name) throw new BadRequestException('Baseline profile names cannot be changed.');
        await this.checkName(manager, dto.name.trim(), id);
        const configuration = this.configuration(dto.configuration);
        const composition = equalSetting(profile.configuration, configuration) ? profile.composition : null;
        Object.assign(profile, { name: dto.name.trim(), description: dto.description || '', configuration, composition, revision: profile.revision + 1 });
        return manager.save(profile);
      });
    } catch (error) { if (error.code === '23505') throw new ConflictException('A profile with this name already exists.'); throw error; }
  }
  async remove(id: string, revision: number): Promise<void> {
    await this.db.transaction(async manager => {
      const profile = await manager.findOne(FleetProfileEntity, {where: {id}, lock: {mode: 'pessimistic_write'}});
      if (!profile) throw new NotFoundException('Profile not found.');
      if (profile.builtinKey) throw new BadRequestException('Bronze, Silver, and Gold are required and cannot be deleted.');
      if (profile.revision !== revision) throw new ConflictException('This profile changed. Reload before deleting.');
      await manager.remove(profile);
    });
  }
  async combine(dto: CombineFleetProfilesDto) {
    if (new Set(dto.sourceIds).size !== dto.sourceIds.length) throw new BadRequestException('Select each source only once.');
    const temporary = dto.temporarySources || [];
    if (temporary.some(source => !/^temp:[\w-]+$/.test(source.id)) || new Set(temporary.map(source => source.id)).size !== temporary.length) throw new BadRequestException('Temporary sources need distinct temp: identifiers.');
    const storedIds = dto.sourceIds.filter(id => !temporary.some(source => source.id === id));
    if (storedIds.some(id => !isUUID(id))) throw new BadRequestException('Invalid source profile identifier.');
    return this.db.transaction(async manager => {
      const stored = storedIds.length ? await manager.find(FleetProfileEntity, {where: {id: In(storedIds)}, lock: {mode: 'pessimistic_read'}}) : [];
      const available: ProfileSource[] = [...stored, ...temporary.map(source => ({...source, configuration: this.configuration(source.configuration)}))];
      const sources = dto.sourceIds.map(id => {
        const source = available.find(profile => profile.id === id);
        if (!source) throw new NotFoundException('A source profile no longer exists.');
        if (dto.expectedRevisions?.[id] !== undefined && source.revision !== dto.expectedRevisions[id]) throw new ConflictException('A source profile changed. Reload profiles and review the combination again.');
        return source;
      });
      let result;
      try { result = combineProfiles(sources, dto.strategy, dto.resolutions); }
      catch (error) { throw new BadRequestException(error.message); }
      if (dto.saveAs) {
        if (!result.configuration) throw new BadRequestException('Resolve every conflicting field before saving.');
        result.savedProfile = await this.insert(manager, {...dto.saveAs, configuration: result.configuration as unknown as Record<string, unknown>}, result.composition);
      }
      return result;
    }).catch(error => {
      if (error.code === '23505') throw new ConflictException('A profile with this name already exists.');
      throw error;
    });
  }
}
