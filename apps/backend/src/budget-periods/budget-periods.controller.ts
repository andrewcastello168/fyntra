import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.type';
import { BudgetPeriodsService } from './budget-periods.service';
import { StartCycleDto } from './dto/start-cycle.dto';

@Controller('budget-periods')
@UseGuards(SupabaseAuthGuard)
export class BudgetPeriodsController {
  constructor(private readonly budgetPeriodsService: BudgetPeriodsService) {}

  @Get('active')
  findActive(@Req() request: AuthenticatedRequest) {
    return this.budgetPeriodsService.findActive(request.user.id);
  }

  @Post('from-income/:transactionId')
  startFromIncome(
    @Param('transactionId', ParseIntPipe) transactionId: number,
    @Body() startCycleDto: StartCycleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.budgetPeriodsService.startFromIncome(
      transactionId,
      startCycleDto,
      request.user.id,
    );
  }
}
