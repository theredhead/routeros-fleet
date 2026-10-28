import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunicationSettingsEntity } from './communication-settings.entity';
import { CommunicationSettings, DEFAULT_METHODS, DeviceCommunication } from './communication-types';
import { SaveCommunicationSettingsDto } from './communication.dto';
@Injectable()
export class CommunicationSettingsService {
  constructor(@InjectRepository(CommunicationSettingsEntity) private readonly settings: Repository<CommunicationSettingsEntity>) {}
  async get(): Promise<CommunicationSettings> {
    const saved = await this.settings.findOneBy({id: 'global'});
    return saved ? {methods: saved.methods, revision: saved.revision} : {methods: structuredClone(DEFAULT_METHODS), revision: 0};
  }
  async save(dto: SaveCommunicationSettingsDto): Promise<CommunicationSettings> {
    if (!dto.methods.some(method => method.enabled)) throw new BadRequestException('Enable at least one communication method.');
    if (dto.revision === 0) {
      try { await this.settings.insert({id: 'global', methods: dto.methods, revision: 1}); }
      catch (error) { if (error.code === '23505') throw new ConflictException('Communication settings changed. Reload before saving.'); throw error; }
    } else {
      const result = await this.settings.update({id: 'global', revision: dto.revision}, {methods: dto.methods, revision: dto.revision + 1});
      if (!result.affected) throw new ConflictException('Communication settings changed. Reload before saving.');
    }
    return this.get();
  }
  async resolve(override?: DeviceCommunication): Promise<DeviceCommunication> {
    const global = await this.get();
    const enabled = new Set(global.methods.filter(method => method.enabled).map(method => method.id));
    const methods = (override?.methods || global.methods).filter(method => method.enabled && enabled.has(method.id));
    if (!methods.length) throw new BadRequestException('No selected communication methods are globally enabled. Review communication settings.');
    return {methods, sshHostKeyFingerprint: override?.sshHostKeyFingerprint, selectedStrategy: override?.selectedStrategy};
  }
}
