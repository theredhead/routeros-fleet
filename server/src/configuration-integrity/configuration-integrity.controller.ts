import { Controller, Get, Header } from '@nestjs/common';
import { ConfigurationIntegrityService } from './configuration-integrity.service';

@Controller('configuration/issues')
export class ConfigurationIntegrityController {
  constructor(private readonly integrity: ConfigurationIntegrityService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  check() { return this.integrity.check(); }
}
