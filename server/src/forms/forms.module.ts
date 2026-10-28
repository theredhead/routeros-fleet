import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormSchemaEntity } from './form-schema.entity';
import { FormsController } from './forms.controller';

@Module({imports: [TypeOrmModule.forFeature([FormSchemaEntity])], controllers: [FormsController]})
export class FormsModule {}
