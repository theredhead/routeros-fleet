import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ConfigProfilesService } from './config-profiles.service';
import { DhcpConfigJobService } from '../routeros/dhcp-config-job.service';
import { UpsertConfigProfileDto } from './dto/upsert-config-profile.dto';

@Controller('devices')
export class ConfigProfilesController {
  constructor(
    private profiles: ConfigProfilesService,
    private jobs: DhcpConfigJobService,
  ) {}

  @Get(':deviceId/config-profile') get(@Param('deviceId') id: string) { return this.profiles.get(id); }
  @Put(':deviceId/config-profile') upsert(@Param('deviceId') id: string, @Body() dto: UpsertConfigProfileDto) { return this.profiles.upsert(id, dto); }

  /** Live DHCP state from the device (for prefilling the editor). */
  @Get(':deviceId/dhcp/current') currentDhcp(@Param('deviceId') id: string) { return this.profiles.currentDhcp(id); }

  /** Read-only plan of what apply() would do. */
  @Post(':deviceId/dhcp/dry-run') dryRun(@Param('deviceId') id: string) { return this.jobs.dryRun(id); }

  /** Start an apply job (runs in background). Returns the job to poll. */
  @Post(':deviceId/dhcp/apply') apply(@Param('deviceId') id: string) { return this.jobs.apply(id); }
}
