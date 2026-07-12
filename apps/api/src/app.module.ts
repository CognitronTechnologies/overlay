import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuthModule } from './modules/auth/auth.module';
import { PicksModule } from './modules/picks/picks.module';
import { StatsModule } from './modules/stats/stats.module';
import { SettlementModule } from './workers/settlement.module';

/**
 * Modular monolith root. Each feature is a Nest module with a clear boundary
 * (see docs/ARCHITECTURE.md §3.2). Subscriptions, payouts, notifications and
 * admin are stubbed in and land across Phases 3.
 */
@Module({
  imports: [AuthModule, PicksModule, StatsModule, SettlementModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
