import { IsEmail, IsOptional, IsString } from 'class-validator';
export class CreateCustomerDto {
  @IsString() name: string;
  @IsOptional() @IsString() contactName?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @IsString() plan?: string;
}
