import { Controller, Get, Req, Request, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from 'src/auth/types/authenticated-request.type';
import { DashboardService } from './dashboard.service';
import { SupabaseAuthGuard } from 'src/auth/guards/supabase-auth.guard';

@Controller('home')
@UseGuards(SupabaseAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getTotalAccount(@Req() request: AuthenticatedRequest) {
    return this.dashboardService.getSummary(request.user.id);
  }
}
