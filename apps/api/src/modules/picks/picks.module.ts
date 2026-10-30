import { Module } from '@nestjs/common';
import { PicksController } from './picks.controller';
import { PicksService } from './picks.service';
import { PrismaService } from '../../prisma.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';
import { OptionalJwtAuthGuard } from '../../common/jwt-auth.guard';

@Module({
  imports: [SubscriptionsModule, NotificationsModule, AuthModule],
  controllers: [PicksController],
  providers: [PicksService, PrismaService, OptionalJwtAuthGuard],
  exports: [PicksService],
})
export class PicksModule {}
