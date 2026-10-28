import { Body, Controller, Get, Post } from '@nestjs/common';
import { Equals, IsString } from 'class-validator';
import { DevelopmentService } from './development.service';

export class ResetDatabaseDto {
  @IsString() @Equals('RESET DATABASE') confirmation: string;
}

@Controller('development')
export class DevelopmentController {
  constructor(private readonly service: DevelopmentService) {}
  @Get() diagnostics() { return this.service.diagnostics(); }
  @Post('reset') reset(@Body() dto: ResetDatabaseDto) { return this.service.reset(dto.confirmation); }
}
