import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma.service';
import { SettlementModule } from '../../workers/settlement.module';
import { ReportsModule } from '../reports/reports.module';
import { PayoutsModule } from '../payouts/payouts.module';

@Module({
  imports: [SettlementModule, ReportsModule, PayoutsModule],
  controllers: [AdminController],
  providers: [AdminService, PrismaService],
  exports: [AdminService],
})
export class AdminModule {}
