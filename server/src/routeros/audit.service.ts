import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

export interface AuditEntry {
  deviceId?: string;
  customerId?: string;
  actor?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  before?: any;
  after?: any;
}

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private repo: Repository<AuditLog>) {}

  async record(e: AuditEntry): Promise<void> {
    try {
      await this.repo.save(this.repo.create({ actor: 'system', ...e }));
    } catch {
      // auditing must never break the mutation path
    }
  }
}
