import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.type';
import { CreateTransactionDraftDto } from './dto/create-transaction-draft.dto';
import { TransactionDraftsService } from './transaction-drafts.service';

@Controller('transaction-drafts')
@UseGuards(SupabaseAuthGuard)
export class TransactionDraftsController {
  constructor(
    private readonly transactionDraftsService: TransactionDraftsService,
  ) {}

  @Post()
  create(
    @Body() createTransactionDraftDto: CreateTransactionDraftDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transactionDraftsService.create(
      createTransactionDraftDto,
      request.user.id,
    );
  }
}
