import { Body, Controller, Get, Header, Post, Put } from '@nestjs/common';
import { CommunicationSettingsService } from './communication-settings.service';
import { CommunicationService } from './communication.service';
import { ProbeCommunicationDto, SaveCommunicationSettingsDto } from './communication.dto';
@Controller('communication')
export class CommunicationController {
  constructor(private readonly settings: CommunicationSettingsService, private readonly communication: CommunicationService) {}
  @Get('settings') @Header('Cache-Control', 'no-store') get() { return this.settings.get(); }
  @Put('settings') save(@Body() dto: SaveCommunicationSettingsDto) { return this.settings.save(dto); }
  @Post('probe') probe(@Body() dto: ProbeCommunicationDto) { return this.communication.probe(dto.host, dto.communication); }
}
