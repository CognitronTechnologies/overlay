import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AffiliatesService } from './affiliates.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import type { AuthUser } from '../../common/crypto';

import { CreateBookmakerDto } from './dto/create-bookmaker.dto';
import { UpdateBookmakerDto } from './dto/update-bookmaker.dto';
import { CreateAffiliateOfferDto } from './dto/create-affiliate-offer.dto';
import { UpdateAffiliateOfferDto } from './dto/update-affiliate-offer.dto';
import { TrackAffiliateClickDto } from './dto/track-affiliate-click.dto';

@Controller()
export class AffiliatesController {
  constructor(private readonly affiliates: AffiliatesService) {}

  // ---- public ----

  /** List active bookmakers. */
  @Get('affiliates')
  listAffiliates(
    @Query('featured') featured?: string,
    @Query('country') country?: string,
  ) {
    return this.affiliates.listBookmakers({
      featured: featured === 'true',
      country,
    });
  }

  /** Homepage featured bookmakers. */
  @Get('affiliates/featured')
  featuredBookmakers() {
    return this.affiliates.listFeaturedBookmakers();
  }

  /** Data for the dedicated Free Bets page. */
  @Get('affiliates/free-bets')
  freeBetsPage(@Query('country') country?: string) {
    return this.affiliates.getFreeBetsPage(country);
  }

  /** Single bookmaker. */
  @Get('affiliates/:slug')
  bookmaker(@Param('slug') slug: string) {
    return this.affiliates.getBookmaker(slug);
  }

  /** Track an affiliate click. */
  @Post('affiliates/:slug/click')
  trackClick(
    @Param('slug') slug: string,
    @Body() dto: TrackAffiliateClickDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.affiliates.trackClick(slug, dto, user);
  }

  // ---- admin dashboard ----

  @Get('admin/affiliates/dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  dashboard() {
    return this.affiliates.dashboard();
  }

  // ---- admin bookmakers ----

  @Get('admin/affiliates/bookmakers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  adminBookmakers(
    @Query('search') search?: string,
    @Query('active') active?: string,
    @Query('featured') featured?: string,
  ) {
    return this.affiliates.adminBookmakers({
      search,
      active,
      featured,
    });
  }

  @Post('admin/affiliates/bookmakers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  createBookmaker(@Body() dto: CreateBookmakerDto) {
    return this.affiliates.createBookmaker(dto);
  }

  @Get('admin/affiliates/bookmakers/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  adminBookmaker(@Param('id') id: string) {
    return this.affiliates.adminBookmaker(id);
  }

  @Patch('admin/affiliates/bookmakers/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateBookmaker(
    @Param('id') id: string,
    @Body() dto: UpdateBookmakerDto,
  ) {
    return this.affiliates.updateBookmaker(id, dto);
  }

  @Delete('admin/affiliates/bookmakers/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  deleteBookmaker(@Param('id') id: string) {
    return this.affiliates.deleteBookmaker(id);
  }

  // ---- admin offers ----

  @Get('admin/affiliates/bookmakers/:id/offers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  bookmakerOffers(@Param('id') bookmakerId: string) {
    return this.affiliates.bookmakerOffers(bookmakerId);
  }

  @Post('admin/affiliates/bookmakers/:id/offers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  createOffer(
    @Param('id') bookmakerId: string,
    @Body() dto: CreateAffiliateOfferDto,
  ) {
    return this.affiliates.createOffer(bookmakerId, dto);
  }

  @Get('admin/affiliates/offers/:offerId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  offer(@Param('offerId') offerId: string) {
    return this.affiliates.offer(offerId);
  }

  @Patch('admin/affiliates/offers/:offerId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateOffer(
    @Param('offerId') offerId: string,
    @Body() dto: UpdateAffiliateOfferDto,
  ) {
    return this.affiliates.updateOffer(offerId, dto);
  }

  @Delete('admin/affiliates/offers/:offerId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  deleteOffer(@Param('offerId') offerId: string) {
    return this.affiliates.deleteOffer(offerId);
  }

  // ---- admin analytics ----

  @Get('admin/affiliates/clicks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  clicks(
    @Query('bookmaker') bookmaker?: string,
    @Query('offer') offer?: string,
    @Query('country') country?: string,
    @Query('source') source?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.affiliates.clicks({
      bookmaker,
      offer,
      country,
      source,
      from,
      to,
    });
  }
}