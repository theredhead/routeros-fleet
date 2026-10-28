import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('app_form_schemas')
export class FormSchemaEntity {
  @PrimaryColumn() id: string;
  @Column({type: 'jsonb'}) schema: Record<string, unknown>;
  @Column({default: 1}) revision: number;
  @UpdateDateColumn() updatedAt: Date;
}
