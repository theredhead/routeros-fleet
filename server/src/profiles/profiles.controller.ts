import { Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { FetchProfilesDto, DuplicateProfileDto } from './profile-fetch.dto';
import { ProfilesService } from './profiles.service';
import { CombineFleetProfilesDto, SaveFleetProfileDto, UpdateFleetProfileDto } from './profiles.dto';

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly service: ProfilesService) {}
  @Get() list() { return this.service.list(); }
  @Post('fetch') fetch(@Body() dto: FetchProfilesDto) { return this.service.fetch(dto); }
  @Get(':id') findOne(@Param('id', ParseUUIDPipe) id: string) { return this.service.findOne(id); }
  @Post(':id/duplicate') duplicate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DuplicateProfileDto) { return this.service.duplicate(id, dto.revision); }
  @Post('combine') combine(@Body() dto: CombineFleetProfilesDto) { return this.service.combine(dto); }
  @Post() create(@Body() dto: SaveFleetProfileDto) { return this.service.create(dto); }
  @Put(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFleetProfileDto) { return this.service.update(id, dto); }
  @Delete(':id') remove(@Param('id', ParseUUIDPipe) id: string, @Query('revision', ParseIntPipe) revision: number) { return this.service.remove(id, revision); }
}
