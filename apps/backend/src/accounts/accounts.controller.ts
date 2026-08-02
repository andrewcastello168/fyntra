import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import type { AuthenticatedRequest } from 'src/auth/types/authenticated-request.type';
import { DeleteAccountDto } from './dto/delete-account.dto';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post('/accounts')
  @UseGuards(SupabaseAuthGuard)
  create(
    @Body() createAccountDto: CreateAccountDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const userId = request.user.id;

    return this.accountsService.create(createAccountDto, userId);
  }

  @Get('/accounts')
  @UseGuards(SupabaseAuthGuard)
  findAll(@Req() request: AuthenticatedRequest) {
    return this.accountsService.findAll(request.user.id);
  }

  @Delete('/accounts')
  @UseGuards(SupabaseAuthGuard)
  delete(
    @Body() deleteAccountDto: DeleteAccountDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.accountsService.delete(deleteAccountDto, request.user.id);
  }
}
