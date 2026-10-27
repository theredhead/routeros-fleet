import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type JobType = 'config' | 'firmware' | 'health';
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'rolled_back' | 'cancelled';

@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() deviceId: string;
  @Column({ default: 'config' }) type: JobType;
  @Column({ default: 'queued' }) status: JobStatus;
  @Column({ nullable: true }) step: string;

  @Column({ default: false }) dryRun: boolean;
  @Column({ type: 'jsonb', nullable: true }) plan: any;    // computed ops (add/update/remove) per menu
  @Column({ type: 'jsonb', nullable: true }) result: any;  // what was actually applied
  @Column({ type: 'jsonb', nullable: true }) backup: any;  // pre-apply snapshot for rollback
  @Column({ type: 'text', nullable: true }) error: string;

  @CreateDateColumn() createdAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) startedAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) finishedAt: Date;
}
