import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { BuiltInProfileKey, DeviceConfiguration, ProfileComposition } from '../configuration';

/** Reusable fleet configuration; separate from legacy per-device DHCP desired state. */
@Entity('profiles')
@Index('IDX_profiles_name_lower', {synchronize: false})
export class FleetProfileEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) name: string;
  @Column({ default: '' }) description: string;
  @Column({ nullable: true, unique: true }) builtinKey: BuiltInProfileKey;
  @Column({ type: 'jsonb' }) configuration: DeviceConfiguration;
  @Column({ type: 'jsonb', nullable: true }) composition: ProfileComposition;
  @Column({ default: 1 }) revision: number;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
