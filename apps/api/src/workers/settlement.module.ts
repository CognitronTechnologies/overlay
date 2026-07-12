import { Module } from '@nestjs/common';
import { SettlementService } from './settlement.service';
import { PrismaService } from '../prisma.service';
import { StatsModule } from '../modules/stats/stats.module';
import { SportsModule } from '../integrations/sports/sports.module';

@Module({
  imports: [StatsModule, SportsModule],
  providers: [SettlementService, PrismaService],
  exports: [SettlementService],
})
export class SettlementModule {}
