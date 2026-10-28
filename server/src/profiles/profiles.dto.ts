import { Type, Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import type { ConflictStrategy } from '../configuration';

export class SaveFleetProfileDto {
  @Transform(({value}) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsObject() configuration: Record<string, unknown>;
}
export class UpdateFleetProfileDto extends SaveFleetProfileDto {
  @IsInt() @Min(1) revision: number;
}
class TemporarySourceDto {
  @IsString() @MaxLength(100) id: string;
  @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsObject() configuration: Record<string, unknown>;
}
class SaveCombinationDto {
  @Transform(({value}) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
}
export class CombineFleetProfilesDto {
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(30) @IsString({each: true}) sourceIds: string[];
  @IsIn(['first-locks', 'last-wins', 'user-selects']) strategy: ConflictStrategy;
  @IsOptional() @IsObject() resolutions?: Record<string, string>;
  @IsOptional() @IsObject() expectedRevisions?: Record<string, number>;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @ValidateNested({each: true}) @Type(() => TemporarySourceDto) temporarySources?: TemporarySourceDto[];
  @IsOptional() @ValidateNested() @Type(() => SaveCombinationDto) saveAs?: SaveCombinationDto;
}
