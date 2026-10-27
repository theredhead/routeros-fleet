import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { Device } from './device.entity';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column({ nullable: true }) contactName: string;
  @Column({ nullable: true }) contactEmail: string;
  @Column({ nullable: true, default: 'standard' }) plan: string;
  @OneToMany(() => Device, (d) => d.customer) devices: Device[];
  @CreateDateColumn() createdAt: Date;
}
