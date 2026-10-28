import { DeviceCommunicationDto } from '../../communication/communication.dto';
import { Transform, Type } from 'class-transformer';
import { IsIP, IsMACAddress, IsNotEmpty, IsUUID, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
export class CreateDeviceDto {
  @IsOptional() @IsUUID() customerId?: string;
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @IsNotEmpty() hostname: string;
  @IsIP() mgmtIp: string;

  @IsOptional() @IsMACAddress() macAddress?: string;
  @IsOptional() @IsString() serialNumber?: string;
  @IsOptional() @IsString() model?: string;        // e.g. RB760iGS
  @IsOptional() @IsString() routerosVersion?: string; // e.g. 7.23.8
  @IsOptional() @IsString() licenseLevel?: string;     // e.g. level5

  // least-privilege per-device REST user, stored encrypted at rest
  @Transform(({value}) => typeof value === 'string' ? value.trim() : value)
  @IsString() @IsNotEmpty() @MaxLength(256) username: string;
  @IsString() @MaxLength(4096) password: string;
  @IsOptional() @IsString() permissions?: string;
  @IsOptional() @ValidateNested() @Type(() => DeviceCommunicationDto) communication?: DeviceCommunicationDto;
}
