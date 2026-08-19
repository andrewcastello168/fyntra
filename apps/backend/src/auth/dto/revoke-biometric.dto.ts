import { IsUUID } from 'class-validator';

export class RevokeBiometricDto {
  @IsUUID()
  deviceId!: string;
}
