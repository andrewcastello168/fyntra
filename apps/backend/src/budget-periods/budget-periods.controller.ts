import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.type';
import { BudgetPeriodsService } from './budget-periods.service';

@Controller('budget-periods')
@UseGuards(SupabaseAuthGuard)
export class BudgetPeriodsController {
  constructor(private readonly budgetPeriodsService: BudgetPeriodsService) {}

  @Get('active')
  findActive(@Req() request: AuthenticatedRequest) {
    return this.budgetPeriodsService.findActive(request.user.id);
  }
}
