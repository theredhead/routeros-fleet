import { Transform } from 'class-transformer';
import { IsIP, IsMACAddress, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

/** Fleet metadata only; editing it does not reconfigure the physical router. */
export class UpdateDeviceDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({value}) => typeof value === 'string' ? value.trim() : value)
  @IsString() @IsNotEmpty() hostname?: string;
  @ValidateIf((_object, value) => value !== undefined) @IsIP() mgmtIp?: string;
  @IsOptional() @IsUUID() customerId?: string | null;
  @IsOptional() @IsMACAddress() macAddress?: string | null;
  @IsOptional() @IsString() model?: string;
}
