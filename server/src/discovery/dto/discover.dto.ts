import { IsInt, Min, Max, IsOptional, IsString, MaxLength } from 'class-validator';

export class DiscoverDto {
  /** MAC (AA:BB:CC:DD:EE:FF or AABBCCDDEEFF) or IP / CIDR (192.168.1.1 or 192.168.1.0/24). */
  @IsString() @MaxLength(64)
  identifier: string;

  /** Optional subnet to scan when only a MAC is given. Defaults to local interface subnet. */
  @IsOptional() @IsString()
  subnet?: string;

  /** Concurrency for ping sweep (default 32). */
  @IsOptional() @IsInt() @Min(1) @Max(128)
  concurrency?: number;
}
