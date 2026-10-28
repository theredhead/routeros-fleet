import { Body, Controller, Post } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { DiscoverDto } from './dto/discover.dto';

@Controller('discover')
export class DiscoveryController {
  constructor(private svc: DiscoveryService) {}

  @Post()
  discover(@Body() dto: DiscoverDto) {
    return this.svc.discover(dto.identifier, dto.subnet, dto.concurrency);
  }
}
