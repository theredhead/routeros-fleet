import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsIP, IsOptional, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';
import { STRATEGY_IDS, StrategyId } from './communication-types';
export class CommunicationMethodDto {
  @IsIn(STRATEGY_IDS) id: StrategyId;
  @IsBoolean() enabled: boolean;
  @IsInt() @Min(1) @Max(65535) port: number;
  @IsBoolean() acceptSelfSignedCertificates: boolean;
}
export class DeviceCommunicationDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(5) @ArrayUnique(method => method?.id)
  @ValidateNested({each: true}) @Type(() => CommunicationMethodDto) methods: CommunicationMethodDto[];
  @IsOptional() @IsIn(STRATEGY_IDS) selectedStrategy?: StrategyId;
  @IsOptional() @IsString() @Matches(/^SHA256:[A-Za-z0-9+/]{43}=?$/) sshHostKeyFingerprint?: string;
}
export class SaveCommunicationSettingsDto {
  @IsArray() @ArrayMinSize(5) @ArrayMaxSize(5) @ArrayUnique(method => method?.id)
  @ValidateNested({each: true}) @Type(() => CommunicationMethodDto) methods: CommunicationMethodDto[];
  @IsInt() @Min(0) revision: number;
}
export class ProbeCommunicationDto {
  @IsIP() host: string;
  @ValidateNested() @Type(() => DeviceCommunicationDto) communication: DeviceCommunicationDto;
}
