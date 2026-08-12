import { IsDateString, IsString, Matches, MaxLength } from 'class-validator';

export class CreateTransactionDraftDto {
  @IsString()
  @MaxLength(1000)
  text!: string;

  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'localDate must use YYYY-MM-DD format.',
  })
  localDate!: string;

  @IsString()
  @MaxLength(100)
  timeZone!: string;
}
