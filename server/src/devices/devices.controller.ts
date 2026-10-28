import { DeviceInspectionService } from './device-inspection.service';
import { TestDeviceCredentialsDto } from './dto/test-device-credentials.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { Header, StreamableFile, Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';

@Controller('devices')
export class DevicesController {
  constructor(private svc: DevicesService, private readonly inspection: DeviceInspectionService) {}
  @Post('test-credentials') testCredentials(@Body() dto: TestDeviceCredentialsDto) { return this.svc.testCredentials(dto); }
  @Post() create(@Body() dto: CreateDeviceDto) { return this.svc.create(dto); }
  @Get() findAll(@Query('customerId') customerId?: string) { return this.svc.findAll(customerId); }
  @Post(':id/test-login') testStoredLogin(@Param('id') id: string) { return this.svc.verifyStoredLogin(id); }
  @Header('Cache-Control', 'no-store')
  @Get(':id/initial-backup') async initialBackup(@Param('id') id: string) {
    return new StreamableFile(await this.svc.downloadInitialBackup(id), {type: 'application/octet-stream', disposition: 'attachment; filename=initial.backup'});
  }
  @Get(':id/details') @Header('Cache-Control', 'no-store') details(@Param('id') id: string) { return this.inspection.stored(id); }
  @Get(':id/inspection') @Header('Cache-Control', 'no-store') inspect(@Param('id') id: string) { return this.inspection.live(id); }
  @Get(':id') findOne(@Param('id') id: string) { return this.svc.findOne(id); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateDeviceDto) { return this.svc.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.svc.remove(id); }
}
