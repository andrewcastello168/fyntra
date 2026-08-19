import { IsString, IsUUID, Matches } from 'class-validator';

export class BiometricLoginDto {
  @IsUUID()
  deviceId!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  credential!: string;
}
