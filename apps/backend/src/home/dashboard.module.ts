import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [SupabaseModule, DatabaseModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
