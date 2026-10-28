import { DeviceCommunicationDto } from '../../communication/communication.dto';
import { Transform, Type } from 'class-transformer';
import { IsIP, IsNotEmpty, IsString, MaxLength, ValidateNested, IsOptional } from 'class-validator';

export class TestDeviceCredentialsDto {
  @IsIP() mgmtIp: string;
  @Transform(({value}) => typeof value === 'string' ? value.trim() : value)
  @IsString() @IsNotEmpty() @MaxLength(256) username: string;
  // An explicitly supplied empty password is valid for routers configured that way.
  @IsString() @MaxLength(4096) password: string;
  @IsOptional() @ValidateNested() @Type(() => DeviceCommunicationDto) communication?: DeviceCommunicationDto;
}
