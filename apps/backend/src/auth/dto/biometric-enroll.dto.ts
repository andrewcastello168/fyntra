import { IsOptional, IsString, IsUUID } from 'class-validator';

export class BiometricEnrollDto {
  @IsUUID()
  deviceId!: string;

  @IsOptional()
  @IsString()
  deviceName?: string;
}
