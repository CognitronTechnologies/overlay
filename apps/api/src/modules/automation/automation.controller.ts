import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { writeThrottle } from '../../common/throttling';
import { AutomationIngestGuard } from './automation-auth.guard';
import { ArticleDraftDto, FinishRunDto, FreeTipDraftDto, StartRunDto } from './automation.dto';
import { AutomationService } from './automation.service';

@Controller('automation')
@UseGuards(AutomationIngestGuard)
export class AutomationController {
  constructor(private readonly automation: AutomationService) {}

  @Post('drafts/articles')
  @Throttle(writeThrottle())
  article(@Body() dto: ArticleDraftDto) {
    return this.automation.createArticleDraft(dto);
  }

  @Post('drafts/free-tips')
  @Throttle(writeThrottle())
  freeTip(@Body() dto: FreeTipDraftDto) {
    return this.automation.createFreeTipDraft(dto);
  }

  @Post('runs')
  @Throttle(writeThrottle())
  startRun(@Body() dto: StartRunDto) {
    return this.automation.startRun(dto);
  }

  @Post('runs/:id/finish')
  @Throttle(writeThrottle())
  finishRun(@Param('id') id: string, @Body() dto: FinishRunDto) {
    return this.automation.finishRun(id, dto);
  }
}
