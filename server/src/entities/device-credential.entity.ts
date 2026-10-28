import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { Device } from './device.entity';

@Entity('device_credentials')
export class DeviceCredential {
  @PrimaryGeneratedColumn('uuid') id: string;
  @OneToOne(() => Device, (d) => d.credential, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deviceId' })
  device: Device;
  @Column({ unique: true }) deviceId: string;

  // Per-device RouterOS account used by the configured communication strategies.
  @Column() username: string;
  // AES-256-GCM encrypted at rest (iv:tag:ciphertext, base64). Never plaintext.
  @Column() passwordEncrypted: string;
  @Column({ nullable: true, default: 'read,write,test,policy' }) permissions: string;

  @CreateDateColumn() createdAt: Date;
}
