import { IsBoolean, IsIP, IsOptional, IsString } from 'class-validator';
export class UpsertConfigProfileDto {
  @IsBoolean() dhcpEnabled: boolean;

  @IsOptional() @IsString() dhcpInterface?: string; // e.g. bridge1
  @IsOptional() @IsString() subnetCidr?: string;     // e.g. 192.168.1.0/24
  @IsOptional() @IsIP() gatewayIp?: string;          // e.g. 192.168.1.1
  @IsOptional() @IsIP() dnsServer?: string;          // e.g. 192.168.1.1
  @IsOptional() @IsString() poolName?: string;       // e.g. dhcp_pool
  @IsOptional() @IsIP() poolStart?: string;          // e.g. 192.168.1.2
  @IsOptional() @IsIP() poolEnd?: string;            // e.g. 192.168.1.254
  @IsOptional() @IsBoolean() prune?: boolean;
}
