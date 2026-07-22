import { Module } from '@nestjs/common';
import { AffiliatesController } from './affiliates.controller';
import { AffiliatesService } from './affiliates.service';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [AffiliatesController],
  providers: [AffiliatesService, PrismaService],
  exports: [AffiliatesService],
})
export class AffiliatesModule {}