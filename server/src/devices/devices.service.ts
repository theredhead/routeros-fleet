import { DeviceCommunication } from '../communication/communication-types';
import { CREDENTIAL_STORAGE_ISSUE } from '../common/actionable-issue';
import { createHash } from 'node:crypto';
import { TestDeviceCredentialsDto } from './dto/test-device-credentials.dto';
import { RouterOsClientService } from '../routeros/router-os-client.service';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { Job } from '../entities/job.entity';
import { BadGatewayException, BadRequestException, ConflictException, ForbiddenException, GatewayTimeoutException, HttpException, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
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
    private router: RouterOsClientService,
  ) {}

  async testCredentials(dto: TestDeviceCredentialsDto): Promise<{verified: true; routerosVersion: string; model?: string; communication?: DeviceCommunication}> {
    try {
      const resource = await this.router.verifyLogin({host: dto.mgmtIp, username: dto.username.trim(), password: dto.password, communication: dto.communication});
      return {verified: true, routerosVersion: resource.version, communication: resource.communication, ...(resource.model ? {model: resource.model} : {})};
    } catch (error) {
      // Never expose Axios errors: their request config contains the supplied credentials.
      if (error instanceof HttpException) throw error;
      if (error?.response?.status === 401) throw new UnauthorizedException({code: 'ROUTER_LOGIN_REJECTED', message: 'RouterOS rejected the username or password.', instructions: 'Check the RouterOS username and password, then retry enrollment. An empty password is supported when the router is configured that way.', severity: 'error'});
      if (error?.response?.status === 403) throw new ForbiddenException({code: 'ROUTER_ACCESS_DENIED', message: 'This account cannot access the selected RouterOS service.', instructions: 'Use a RouterOS account with access to the selected service and permission to read system resource information.', severity: 'error'});
      if (['ECONNABORTED', 'ETIMEDOUT'].includes(error?.code)) throw new GatewayTimeoutException({code: 'ROUTER_TIMEOUT', message: 'The RouterOS connection timed out.', instructions: 'Check the management address, network connectivity and the selected service’s availability from the API server, then retry.', severity: 'error'});
      throw new BadGatewayException({code: 'ROUTER_UNREACHABLE', message: 'Could not verify access to the selected RouterOS service.', instructions: 'Check the selected communication methods, ports, trust settings and service availability from the API server, then retry.', severity: 'error'});
    }
  }

  /** Verify supplied credentials before atomically storing enrollment and encrypted login. */
  async create(dto: CreateDeviceDto): Promise<Device> {
    if (dto.customerId && !await this.customers.existsBy({ id: dto.customerId })) {
      throw new NotFoundException('Customer not found');
    }
    if (typeof dto.username !== 'string' || !dto.username.trim() || typeof dto.password !== 'string') {
      throw new BadRequestException('Provide a username and password together. The password may be empty.');
    }
    const macAddress = dto.macAddress?.toUpperCase();
    const duplicate = await this.devices.findOne({ where: [
      { mgmtIp: dto.mgmtIp }, ...(macAddress ? [{ macAddress }] : []),
    ] });
    if (duplicate) throw new ConflictException('This device is already known.');

    try { this.crypto.assertConfigured(); }
    catch { throw new ServiceUnavailableException(CREDENTIAL_STORAGE_ISSUE); }
    const verified = await this.testCredentials({mgmtIp: dto.mgmtIp, username: dto.username, password: dto.password, communication: dto.communication});
    const passwordEncrypted = this.crypto.encrypt(dto.password);

    let device: Device;
    try {
      device = await this.devices.manager.transaction(async manager => {
        const saved = await manager.save(Device, manager.create(Device, {
          customerId: dto.customerId || null,
          hostname: dto.hostname.trim(),
          mgmtIp: dto.mgmtIp,
          macAddress,
          serialNumber: dto.serialNumber,
          model: verified?.model || dto.model || 'unknown',
          routerosVersion: verified?.routerosVersion || dto.routerosVersion,
          licenseLevel: dto.licenseLevel,
          communication: verified.communication,
          status: 'online',
          lastSeenAt: new Date(),
        }));
        await manager.save(DeviceCredential, manager.create(DeviceCredential, {
          deviceId: saved.id,
          username: dto.username.trim(),
          passwordEncrypted,
          permissions: dto.permissions || 'read,write,test,policy',
        }));
        // Read the persisted encrypted login, rather than trusting the submitted values.
        const stored = await manager.findOneByOrFail(DeviceCredential, {deviceId: saved.id});
        const credentials = {host: saved.mgmtIp, username: stored.username, password: this.crypto.decrypt(stored.passwordEncrypted), communication: saved.communication};
        await this.testCredentials({mgmtIp: credentials.host, username: credentials.username, password: credentials.password, communication: credentials.communication});
        return saved;
      });
    } catch (error) {
      if (error.code === '23505') throw new ConflictException('This device is already known.');
      throw error;
    }

    return this.sanitized(device.id);
  }

  async verifyStoredLogin(id: string) {
    const device = await this.devices.findOneBy({id});
    if (!device) throw new NotFoundException('Device not found');
    const credential = await this.creds.findOneBy({deviceId: id});
    if (!credential) throw new BadRequestException('Device has no stored credentials.');
    return this.testCredentials({mgmtIp: device.mgmtIp, username: credential.username, password: this.crypto.decrypt(credential.passwordEncrypted), communication: device.communication});
  }

  async downloadInitialBackup(id: string): Promise<Buffer> {
    const device = await this.devices.createQueryBuilder('device').addSelect('device.initialBackupEncrypted').where('device.id = :id', {id}).getOne();
    if (!device?.initialBackupEncrypted || !device.initialBackup) throw new NotFoundException('Initial backup not found');
    const backup = Buffer.from(this.crypto.decrypt(device.initialBackupEncrypted), 'base64');
    if (backup.length !== device.initialBackup.size || createHash('sha256').update(backup).digest('hex') !== device.initialBackup.sha256) throw new ServiceUnavailableException('Initial backup integrity check failed.');
    return backup;
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

  async update(id: string, dto: UpdateDeviceDto): Promise<any> {
    try {
      await this.devices.manager.transaction(async manager => {
        const device = await manager.findOne(Device, {where: {id}, lock: {mode: 'pessimistic_write'}});
        if (!device) throw new NotFoundException('Device not found');
        if (dto.customerId && !await manager.existsBy(Customer, {id: dto.customerId})) throw new NotFoundException('Customer not found');
        if (await manager.existsBy(Job, {deviceId: id, status: In(['queued', 'running'])})) throw new ConflictException('Wait for active jobs to finish before editing this device.');
        const duplicate = await manager.findOne(Device, {where: [
          {id: Not(id), mgmtIp: dto.mgmtIp || device.mgmtIp},
          ...(dto.macAddress ? [{id: Not(id), macAddress: dto.macAddress.toUpperCase()}] : []),
        ]});
        if (duplicate) throw new ConflictException('Another device already uses that IP or MAC address.');
        if (dto.hostname !== undefined) device.hostname = dto.hostname;
        if (dto.mgmtIp !== undefined) device.mgmtIp = dto.mgmtIp;
        if (dto.customerId !== undefined) device.customerId = dto.customerId;
        if (dto.macAddress !== undefined) device.macAddress = dto.macAddress?.toUpperCase() || null;
        if (dto.model !== undefined) device.model = dto.model?.trim() || 'unknown';
        await manager.save(Device, device);
      });
    } catch (error) {
      if (error.code === '23505') throw new ConflictException('Another device already uses that IP or MAC address.');
      throw error;
    }
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.devices.manager.transaction(async manager => {
      const device = await manager.findOne(Device, {where: {id}, lock: {mode: 'pessimistic_write'}});
      if (!device) throw new NotFoundException('Device not found');
      if (await manager.existsBy(Job, {deviceId: id, status: In(['queued', 'running'])})) throw new ConflictException('Wait for active jobs to finish before deleting this device.');
      await manager.remove(Device, device);
    });
  }

  private sanitize(d: Device): any {
    const clone: any = { ...d };
    delete clone.initialBackupEncrypted;
    if (clone.credential) delete clone.credential.passwordEncrypted; // never leak the blob
    return clone;
  }

  private async sanitized(id: string): Promise<any> {
    return this.findOne(id);
  }
}
