import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DevicesService } from './devices.service';
import { DeviceCredential, Job, AuditLog } from '../entities';
import { CryptoService } from '../common/crypto.service';
import { CommunicationService } from '../communication/communication.service';
import { inspectRouter, redactDeviceData } from './device-inspection';
@Injectable()
export class DeviceInspectionService {
  constructor(private readonly devices: DevicesService, private readonly crypto: CryptoService, private readonly communication: CommunicationService,
    @InjectRepository(DeviceCredential) private readonly credentials: Repository<DeviceCredential>,
    @InjectRepository(Job) private readonly jobs: Repository<Job>, @InjectRepository(AuditLog) private readonly audit: Repository<AuditLog>) {}
  async stored(id: string) {
    const device = await this.devices.findOne(id);
    const [jobs, audit] = await Promise.all([
      this.jobs.findAndCount({where: {deviceId: id}, order: {createdAt: 'DESC'}, take: 100}),
      this.audit.findAndCount({where: {deviceId: id}, order: {createdAt: 'DESC'}, take: 100}),
    ]);
    return redactDeviceData({checkedAt: new Date().toISOString(), device, jobs: {records: jobs[0], total: jobs[1], limit: 100}, audit: {records: audit[0], total: audit[1], limit: 100}});
  }
  async live(id: string) {
    const device = await this.devices.findOne(id);
    const credential = await this.credentials.findOneBy({deviceId: id});
    const checkedAt = new Date().toISOString();
    if (!credential) return {checkedAt, status: 'unavailable', message: 'No stored credentials. Stored device data remains available.'};
    try {
      const snapshot = await inspectRouter(this.communication, {host: device.mgmtIp, username: credential.username, password: this.crypto.decrypt(credential.passwordEncrypted), communication: device.communication});
      return {checkedAt, status: 'available', ...snapshot};
    } catch {
      return {checkedAt, status: 'unavailable', message: 'Could not read the router. Check stored credentials, enabled communication methods, trust settings and connectivity.'};
    }
  }
}
