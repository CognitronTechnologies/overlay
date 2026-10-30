import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { AutomationController } from './automation.controller';
import { AutomationIngestGuard } from './automation-auth.guard';
import { AutomationService } from './automation.service';
import { EditorialController } from './editorial.controller';
import { EditorialService } from './editorial.service';

@Module({
  controllers: [AutomationController, EditorialController],
  providers: [PrismaService, AutomationIngestGuard, AutomationService, EditorialService],
})
export class AutomationModule {}
