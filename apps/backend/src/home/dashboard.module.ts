import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { SupabaseModule } from 'src/supabase/supabase.module';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [SupabaseModule, DatabaseModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
