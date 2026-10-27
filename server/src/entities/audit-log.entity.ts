import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn() id: number;
  @Column({ nullable: true }) deviceId: string;
  @Column({ nullable: true }) customerId: string;
  @Column({ default: 'system' }) actor: string;
  @Column() action: string;
  @Column({ nullable: true }) entityType: string;
  @Column({ nullable: true }) entityId: string;
  @Column({ type: 'jsonb', nullable: true }) before: any;
  @Column({ type: 'jsonb', nullable: true }) after: any;
  @CreateDateColumn() createdAt: Date;
}
