import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavedFilterEntity } from './saved-filter.entity';
import { FiltersController } from './filters.controller';

@Module({imports: [TypeOrmModule.forFeature([SavedFilterEntity])], controllers: [FiltersController]})
export class FiltersModule {}
