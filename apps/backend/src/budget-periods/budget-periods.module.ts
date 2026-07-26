import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { BudgetPeriodsController } from './budget-periods.controller';
import { BudgetPeriodsService } from './budget-periods.service';

@Module({
  imports: [SupabaseModule, DatabaseModule],
  controllers: [BudgetPeriodsController],
  providers: [BudgetPeriodsService],
})
export class BudgetPeriodsModule {}
