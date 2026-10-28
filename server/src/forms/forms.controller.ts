import { BadRequestException, Body, ConflictException, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsInt, IsObject, Min } from 'class-validator';
import { Repository } from 'typeorm';
import { FormSchemaEntity } from './form-schema.entity';
import { schemaError } from './form-schema-validation';

class SaveFormDto {
  @IsObject() schema: Record<string, unknown>;
  @IsInt() @Min(0) revision: number;
}

@Controller('development/forms')
export class FormsController {
  constructor(@InjectRepository(FormSchemaEntity) private readonly forms: Repository<FormSchemaEntity>) {}

  @Get() list() { return this.forms.find({order: {id: 'ASC'}}); }

  @Put(':id') async save(@Param('id') id: string, @Body() dto: SaveFormDto) {
    if (!/^[a-zA-Z0-9._-]{1,250}$/.test(id)) throw new BadRequestException('Invalid form ID.');
    const error = schemaError(dto.schema, id);
    if (error) throw new BadRequestException(error);
    if (Buffer.byteLength(JSON.stringify(dto.schema)) > 200_000) throw new BadRequestException('Form schema is too large.');
    if (dto.revision === 0) {
      try {
        await this.forms.insert({id, schema: dto.schema, revision: 1});
        return this.forms.findOneByOrFail({id});
      }
      catch (error) {
        if (error?.code === '23505') throw new ConflictException('This form changed elsewhere. Load it again before saving.');
        throw error;
      }
    }
    const result = await this.forms.update({id, revision: dto.revision}, {schema: dto.schema, revision: dto.revision + 1});
    if (!result.affected) throw new ConflictException('This form changed elsewhere. Load it again before saving.');
    return this.forms.findOneByOrFail({id});
  }

  @Delete(':id/:revision') async restore(@Param('id') id: string, @Param('revision') revision: string) {
    const result = await this.forms.delete({id, revision: Number(revision)});
    if (!result.affected) throw new ConflictException('This form changed elsewhere. Load it again before restoring.');
    return {id};
  }
}
