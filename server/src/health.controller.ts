import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private readonly db: DataSource) {}
  @Get() async check() {
    try { await this.db.query('SELECT 1'); }
    catch { throw new ServiceUnavailableException({ status: 'degraded', database: 'unavailable', uptime: process.uptime() }); }
    return { status: 'ok', database: 'connected', uptime: process.uptime(), checkedAt: new Date().toISOString() };
  }
}
