import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../entities/device.entity';
import { DeviceCredential } from '../entities/device-credential.entity';
import { ConfigProfile } from '../entities/config-profile.entity';
import { CryptoService } from '../common/crypto.service';
import { Creds, RouterOsClientService } from '../routeros/router-os-client.service';
import { DhcpRendererService } from '../routeros/dhcp-renderer.service';
import { UpsertConfigProfileDto } from './dto/upsert-config-profile.dto';

@Injectable()
export class ConfigProfilesService {
  constructor(
    @InjectRepository(Device) private devices: Repository<Device>,
    @InjectRepository(ConfigProfile) private profiles: Repository<ConfigProfile>,
    @InjectRepository(DeviceCredential) private creds: Repository<DeviceCredential>,
    private client: RouterOsClientService,
    private renderer: DhcpRendererService,
    private crypto: CryptoService,
  ) {}

  async get(deviceId: string): Promise<ConfigProfile> {
    const p = await this.profiles.findOne({ where: { deviceId } });
    if (!p) throw new NotFoundException('No config profile for this device yet');
    return p;
  }

  async upsert(deviceId: string, dto: UpsertConfigProfileDto): Promise<ConfigProfile> {
    const device = await this.devices.findOne({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Device not found');
    let p = await this.profiles.findOne({ where: { deviceId } });
    if (!p) {
      p = this.profiles.create({ deviceId, desiredState: null });
    }
    Object.assign(p, dto);
    return this.profiles.save(p);
  }

  /** Read the live DHCP setup from the device so the editor can prefill. */
  async currentDhcp(deviceId: string): Promise<any> {
    const device = await this.devices.findOne({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Device not found');
    const cred = await this.creds.findOne({ where: { deviceId } });
    if (!cred) throw new BadRequestException('Device has no stored credential');
    const c: Creds = { host: device.mgmtIp, username: cred.username, password: this.crypto.decrypt(cred.passwordEncrypted) };
    return this.renderer.readCurrent(c);
  }
}
