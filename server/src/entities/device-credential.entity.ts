import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToOne } from 'typeorm';
import { Device } from './device.entity';

@Entity('device_credentials')
export class DeviceCredential {
  @PrimaryGeneratedColumn('uuid') id: string;
  @OneToOne(() => Device, (d) => d.credential) device: Device;
  @Column({ unique: true }) deviceId: string;

  // Least-privilege per-device REST user.
  @Column() username: string;
  // AES-256-GCM encrypted at rest (iv:tag:ciphertext, base64). Never plaintext.
  @Column() passwordEncrypted: string;
  @Column({ nullable: true, default: 'read,write,test,policy' }) permissions: string;

  @CreateDateColumn() createdAt: Date;
}
