import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../entities/device.entity';
import { DeviceCredential } from '../entities/device-credential.entity';
import { Customer } from '../entities/customer.entity';
import { CryptoService } from '../common/crypto.service';
import { CreateDeviceDto } from './dto/create-device.dto';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device) private devices: Repository<Device>,
    @InjectRepository(DeviceCredential) private creds: Repository<DeviceCredential>,
    @InjectRepository(Customer) private customers: Repository<Customer>,
    private crypto: CryptoService,
  ) {}

  /** Enroll a device: create the record + encrypt and store its REST credential. */
  async create(dto: CreateDeviceDto): Promise<Device> {
    const customer = await this.customers.findOne({ where: { id: dto.customerId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const device = await this.devices.save(
      this.devices.create({
        customerId: dto.customerId,
        hostname: dto.hostname,
        mgmtIp: dto.mgmtIp,
        serialNumber: dto.serialNumber,
        model: dto.model || 'unknown',
        routerosVersion: dto.routerosVersion,
        licenseLevel: dto.licenseLevel,
        status: 'enrolled',
      }),
    );

    await this.creds.save(
      this.creds.create({
        deviceId: device.id,
        username: dto.username,
        passwordEncrypted: this.crypto.encrypt(dto.password),
        permissions: dto.permissions || 'read,write,test,policy',
      }),
    );

    return this.sanitized(device.id);
  }

  async findAll(customerId?: string): Promise<any[]> {
    const where = customerId ? { customerId } : {};
    const list = await this.devices.find({ where, relations: { customer: true }, order: { createdAt: 'DESC' } });
    return list.map((d) => this.sanitize(d));
  }

  async findOne(id: string): Promise<any> {
    const d = await this.devices.findOne({ where: { id }, relations: { customer: true, credential: true, configProfile: true } });
    if (!d) throw new NotFoundException('Device not found');
    return this.sanitize(d);
  }

  async remove(id: string): Promise<void> {
    const d = await this.devices.findOne({ where: { id } });
    if (!d) throw new NotFoundException('Device not found');
    await this.creds.delete({ deviceId: id });
    await this.devices.remove(d);
  }

  private sanitize(d: Device): any {
    const clone: any = { ...d };
    if (clone.credential) delete clone.credential.passwordEncrypted; // never leak the blob
    return clone;
  }

  private async sanitized(id: string): Promise<any> {
    return this.findOne(id);
  }
}
