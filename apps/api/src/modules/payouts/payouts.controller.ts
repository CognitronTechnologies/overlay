import { Body, Controller, ForbiddenException, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, Matches } from 'class-validator';
import { PayoutsService } from './payouts.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import type { AuthUser } from '../../common/crypto';
import { writeThrottle } from '../../common/throttling';

class RunPayoutsDto {
  @IsOptional()
  @Matches(/^\d{4}-W\d{2}$/, {
    message: 'period must be an ISO week, e.g. 2026-W29',
  })
  period?: string;
}

@Controller('payouts')
export class PayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  /** Earnings summary + payout history for the calling tipster (OB-024). */
  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('tipster')
  me(@CurrentUser() user: AuthUser) {
    if (!user.tipsterId) throw new ForbiddenException('Not a tipster account');
    return this.payouts.getEarnings(user.tipsterId);
  }

  /** Admin-triggered regular weekly payout batch (run every Tuesday). */
  @Post('run')
  @Throttle(writeThrottle())
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  run(@Body() dto: RunPayoutsDto) {
    return this.payouts.runScheduled(dto.period);
  }

  /** Tipster requests an off-schedule payout — created awaiting admin approval. */
  @Post('request')
  @Throttle(writeThrottle())
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('tipster')
  request(@CurrentUser() user: AuthUser) {
    if (!user.tipsterId) throw new ForbiddenException('Not a tipster account');
    return this.payouts.requestOnDemand(user.tipsterId);
  }
}
