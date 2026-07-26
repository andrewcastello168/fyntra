import { Type } from 'class-transformer';
import { IsInt, IsPositive } from 'class-validator';

export class DeleteAccountDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  accountId!: number;
}
