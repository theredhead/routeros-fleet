import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { OverviewFilter, OverviewKey } from './filter-definition';

@Entity('saved_overview_filters')
@Index(['view', 'name'], {unique: true})
export class SavedFilterEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() view: OverviewKey;
  @Column() name: string;
  @Column({type: 'jsonb'}) expression: OverviewFilter;
  @Column({default: 1}) revision: number;
  @UpdateDateColumn() updatedAt: Date;
}
