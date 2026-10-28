import { Column, Entity, PrimaryColumn } from 'typeorm';
import { CommunicationMethod } from './communication-types';
@Entity('communication_settings')
export class CommunicationSettingsEntity {
  @PrimaryColumn() id: string;
  @Column({type: 'jsonb'}) methods: CommunicationMethod[];
  @Column({default: 1}) revision: number;
}
