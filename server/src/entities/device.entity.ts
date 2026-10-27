import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToOne } from 'typeorm';
import { Customer } from './customer.entity';
import { DeviceCredential } from './device-credential.entity';
import { ConfigProfile } from './config-profile.entity';

export type DeviceStatus = 'unenrolled' | 'enrolled' | 'online' | 'offline' | 'error';

@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn('uuid') id: string;

  // Tenancy key: every device-scoped row carries customerId.
  @ManyToOne(() => Customer, (c) => c.devices, { onDelete: 'CASCADE' }) customer: Customer;
  @Column() customerId: string;

  @Column() hostname: string;
  @Column({ nullable: true }) serialNumber: string;
  @Column() mgmtIp: string;
  @Column({ nullable: true, default: 'unknown' }) model: string;
  @Column({ nullable: true }) routerosVersion: string;
  @Column({ nullable: true }) licenseLevel: string;

  @Column({ default: 'unenrolled' }) status: DeviceStatus;
  @Column({ nullable: true }) enrollmentTokenHash: string;
  @Column({ type: 'timestamptz', nullable: true }) lastSeenAt: Date;

  @OneToOne(() => DeviceCredential, (c) => c.device) credential: DeviceCredential;
  @OneToOne(() => ConfigProfile, (p) => p.device) configProfile: ConfigProfile;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
