import { IsIn, IsString, MinLength } from 'class-validator';

export class RefreshSessionDto {
  @IsString()
  @MinLength(1)
  refreshToken!: string;

  @IsIn(['sim', 'prod'])
  type!: 'sim' | 'prod';
}
