import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';

@Controller('devices')
export class DevicesController {
  constructor(private svc: DevicesService) {}
  @Post() create(@Body() dto: CreateDeviceDto) { return this.svc.create(dto); }
  @Get() findAll(@Query('customerId') customerId?: string) { return this.svc.findAll(customerId); }
  @Get(':id') findOne(@Param('id') id: string) { return this.svc.findOne(id); }
  @Delete(':id') remove(@Param('id') id: string) { return this.svc.remove(id); }
}
