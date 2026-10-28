import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { Device } from './device.entity';

/**
 * The DESIRED state for a device. This is the source of truth the reconciler
 * converges reality toward. Typed columns cover today's DHCP domain; `desiredState`
 * (JSONB) is where future domains (firewall, VLAN, wireless, VPN) live so growth =
 * new fields + a new renderer, not a rewrite.
 */
@Entity('config_profiles')
export class ConfigProfile {
  @PrimaryGeneratedColumn('uuid') id: string;
  @OneToOne(() => Device, (d) => d.configProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deviceId' })
  device: Device;
  @Column({ unique: true }) deviceId: string;

  // --- DHCP domain ---
  @Column({ default: false }) dhcpEnabled: boolean;
  @Column({ nullable: true }) dhcpInterface: string; // e.g. bridge1
  @Column({ nullable: true }) subnetCidr: string;    // e.g. 192.168.1.0/24
  @Column({ nullable: true }) gatewayIp: string;     // e.g. 192.168.1.1
  @Column({ nullable: true }) dnsServer: string;     // e.g. 192.168.1.1
  @Column({ nullable: true }) poolName: string;      // e.g. dhcp_pool
  @Column({ nullable: true }) poolStart: string;     // e.g. 192.168.1.2
  @Column({ nullable: true }) poolEnd: string;       // e.g. 192.168.1.254
  @Column({ default: false }) prune: boolean;        // remove unmanaged records on apply

  // --- Future domains (declarative, renderer-driven) ---
  @Column({ type: 'jsonb', nullable: true }) desiredState: any;

  @UpdateDateColumn() updatedAt: Date;
}
