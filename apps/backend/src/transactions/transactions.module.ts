import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { DatabaseModule } from '../database/database.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule, DatabaseModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
