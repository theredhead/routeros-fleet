import { Controller, Get, Param } from '@nestjs/common';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private svc: JobsService) {}
  @Get('device/:deviceId') forDevice(@Param('deviceId') id: string) { return this.svc.forDevice(id); }
  @Get(':id') findOne(@Param('id') id: string) { return this.svc.findOne(id); }
}
