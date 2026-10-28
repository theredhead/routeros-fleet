import { BadRequestException, Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, ParseIntPipe, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsObject, IsString, MaxLength, Min } from 'class-validator';
import { Repository } from 'typeorm';
import { OVERVIEW_FIELDS, OverviewFilter, OverviewKey, filterError } from './filter-definition';
import { SavedFilterEntity } from './saved-filter.entity';

export class SaveFilterDto {
  @IsIn(Object.keys(OVERVIEW_FIELDS)) view: OverviewKey;
  @Transform(({value}) => typeof value === 'string' ? value.trim() : value)
  @IsString() @IsNotEmpty() @MaxLength(100) name: string;
  @IsObject() expression: OverviewFilter;
}
export class UpdateFilterDto extends SaveFilterDto { @IsInt() @Min(1) revision: number; }

@Controller('filters')
export class FiltersController {
  constructor(@InjectRepository(SavedFilterEntity) private readonly filters: Repository<SavedFilterEntity>) {}
  @Get() list(@Query('view') view: OverviewKey) {
    if (!Object.hasOwn(OVERVIEW_FIELDS, view)) throw new BadRequestException('Unknown overview.');
    return this.filters.find({where: {view}, order: {name: 'ASC'}});
  }
  @Get(':id') async get(@Param('id', ParseUUIDPipe) id: string) {
    const filter = await this.filters.findOneBy({id});
    if (!filter) throw new NotFoundException('Saved filter no longer exists.');
    return filter;
  }
  private check(dto: SaveFilterDto): void {
    const error = filterError(dto.view, dto.expression);
    if (error) throw new BadRequestException(error);
    if (!dto.name?.trim() || dto.name.length > 100) throw new BadRequestException('Enter a filter name of at most 100 characters.');
  }
  @Post() async create(@Body() dto: SaveFilterDto) {
    this.check(dto);
    try { return await this.filters.save(this.filters.create({view: dto.view, name: dto.name.trim(), expression: dto.expression})); }
    catch (error) { if (error?.code === '23505') throw new ConflictException('A filter with that name already exists in this overview.'); throw error; }
  }
  @Put(':id') async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFilterDto) {
    this.check(dto);
    try {
      const result = await this.filters.update({id, view: dto.view, revision: dto.revision}, {name: dto.name.trim(), expression: dto.expression, revision: dto.revision + 1});
      if (!result.affected) throw new ConflictException('This saved filter changed or was deleted. Load it again before saving.');
      return {id, view: dto.view, name: dto.name.trim(), expression: dto.expression, revision: dto.revision + 1};
    } catch (error) { if (error?.code === '23505') throw new ConflictException('A filter with that name already exists in this overview.'); throw error; }
  }
  @Delete(':id/:revision') async remove(@Param('id', ParseUUIDPipe) id: string, @Param('revision', ParseIntPipe) revision: number) {
    if (!Number.isSafeInteger(revision) || revision < 1) throw new BadRequestException('Invalid filter revision.');
    const result = await this.filters.delete({id, revision});
    if (!result.affected) throw new ConflictException('This saved filter changed or was deleted. Load it again before deleting.');
    return {id};
  }
}
