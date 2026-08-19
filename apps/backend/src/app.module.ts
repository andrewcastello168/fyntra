import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { TransactionsModule } from './transactions/transactions.module';
import { AccountsModule } from './accounts/accounts.module';
import { BudgetPeriodsModule } from './budget-periods/budget-periods.module';
import { DashboardModule } from './home/dashboard.module';
import { TransactionDraftsModule } from './transaction-drafts/transaction-drafts.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    DatabaseModule,
    AuthModule,
    TransactionsModule,
    AccountsModule,
    BudgetPeriodsModule,
    DashboardModule,
    TransactionDraftsModule,
    HealthController,
  ],
})
export class AppModule {}
