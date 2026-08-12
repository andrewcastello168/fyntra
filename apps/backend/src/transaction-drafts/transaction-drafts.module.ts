import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { DatabaseModule } from '../database/database.module';
import { TransactionDraftsController } from './transaction-drafts.controller';
import { TransactionDraftsService } from './transaction-drafts.service';

@Module({
  imports: [AiModule, SupabaseModule, DatabaseModule],
  controllers: [TransactionDraftsController],
  providers: [TransactionDraftsService],
})
export class TransactionDraftsModule {}
