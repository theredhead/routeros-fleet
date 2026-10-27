import { IsIP, IsOptional, IsString } from 'class-validator';
export class CreateDeviceDto {
  @IsString() customerId: string;
  @IsString() hostname: string;
  @IsIP() mgmtIp: string;

  @IsOptional() @IsString() serialNumber?: string;
  @IsOptional() @IsString() model?: string;        // e.g. RB760iGS
  @IsOptional() @IsString() routerosVersion?: string; // e.g. 7.23.8
  @IsOptional() @IsString() licenseLevel?: string;     // e.g. level5

  // least-privilege per-device REST user, stored encrypted at rest
  @IsString() username: string;
  @IsString() password: string;
  @IsOptional() @IsString() permissions?: string;
}
