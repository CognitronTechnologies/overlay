import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import type { AuthUser } from '../../common/crypto';

import type { CreateBookmakerDto } from './dto/create-bookmaker.dto';
import type { UpdateBookmakerDto } from './dto/update-bookmaker.dto';
import type { CreateAffiliateOfferDto } from './dto/create-affiliate-offer.dto';
import type { UpdateAffiliateOfferDto } from './dto/update-affiliate-offer.dto';
import type { TrackAffiliateClickDto } from './dto/track-affiliate-click.dto';

@Injectable()
export class AffiliatesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- public ----

  /**
   * Returns the active bookmakers visible to the public.
   *
   * Optional filters:
   *  - featured
   *  - visitor country (geo-gating)
   */
  async listBookmakers(params: {
    featured?: boolean;
    country?: string;
  }) {
    const { featured, country } = params;

    return this.prisma.bookmaker.findMany({
      where: {
        isActive: true,
        ...(featured ? { isFeatured: true } : {}),
        ...(country
          ? {
              supportedCountries: {
                has: country.toUpperCase(),
              },
            }
          : {}),
      },
      include: {
        offers: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  /** Homepage featured bookmakers. */
  async listFeaturedBookmakers() {
    return this.listBookmakers({ featured: true });
  }

  /**
   * Data powering the dedicated Free Bets page.
   *
   * Returns featured bookmakers and geo-filtered active offers.
   */
  async getFreeBetsPage(country?: string) {
    const [featured, bookmakers] = await Promise.all([
      this.listBookmakers({ featured: true, country }),
      this.listBookmakers({ country }),
    ]);

    return {
      featured,
      bookmakers,
      disclosure:
        'Overlay Bets partners with selected bookmakers and may earn a commission if you register through affiliate links. This never influences our rankings or betting recommendations.',
    };
  }

  /** Single bookmaker by slug. */
  async getBookmaker(slug: string) {
    const bookmaker = await this.prisma.bookmaker.findFirst({
      where: { slug, isActive: true },
      include: {
        offers: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!bookmaker) throw new NotFoundException('Bookmaker not found');
    return bookmaker;
  }

  /**
   * Records an affiliate click and returns the final destination URL.
   */
  async trackClick(
    slug: string,
    dto: TrackAffiliateClickDto,
    user?: AuthUser,
  ) {
    const bookmaker = await this.prisma.bookmaker.findFirst({
      where: { slug, isActive: true },
      include: { offers: true },
    });

    if (!bookmaker) {
      throw new NotFoundException('Bookmaker not found');
    }

    const offer = dto.offerId
      ? bookmaker.offers.find(
          (o) => o.id === dto.offerId && o.isActive,
        )
      : null;

    await this.prisma.affiliateClick.create({
      data: {
        bookmakerId: bookmaker.id,
        offerId: offer?.id,
        userId: user?.userId,
        source: dto.source,
        page: dto.page,
        country: dto.country,
      },
    });

    return {
      redirectUrl:
        offer?.destinationUrl ??
        bookmaker.destinationUrl ??
        bookmaker.website,
    };
  }

  // ---- admin dashboard ----

  /**
   * Affiliate analytics shown on the admin dashboard.
   */
  async dashboard() {
    const [
      totalClicks,
      clicksToday,
      activeBookmakers,
      activeOffers,
      topBookmakers,
      topOffers,
    ] = await Promise.all([
      this.prisma.affiliateClick.count(),

      this.prisma.affiliateClick.count({
        where: {
          clickedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),

      this.prisma.bookmaker.count({ where: { isActive: true } }),

      this.prisma.affiliateOffer.count({ where: { isActive: true } }),

      this.prisma.bookmaker.findMany({
        take: 10,
        orderBy: { clicks: { _count: 'desc' } },
        select: {
          id: true,
          name: true,
          slug: true,
          _count: { select: { clicks: true } },
        },
      }),

      this.prisma.affiliateOffer.findMany({
        take: 10,
        orderBy: { clicks: { _count: 'desc' } },
        include: {
          bookmaker: { select: { id: true, name: true } },
          _count: { select: { clicks: true } },
        },
      }),
    ]);

    return {
      summary: {
        totalClicks,
        clicksToday,
        activeBookmakers,
        activeOffers,
      },
      topBookmakers,
      topOffers,
    };
  }

  // ---- admin bookmakers ----

  /**
   * Admin bookmaker listing. Includes inactive rows.
   */
  async adminBookmakers(filters: {
    search?: string;
    active?: string;
    featured?: string;
  }) {
    return this.prisma.bookmaker.findMany({
      where: {
        ...(filters.search
          ? {
              OR: [
                { name: { contains: filters.search, mode: 'insensitive' } },
                { slug: { contains: filters.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(filters.active != null
          ? { isActive: filters.active === 'true' }
          : {}),
        ...(filters.featured != null
          ? { isFeatured: filters.featured === 'true' }
          : {}),
      },
      include: {
        _count: { select: { offers: true, clicks: true } },
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  /** Single bookmaker for editing. */
  async adminBookmaker(id: string) {
    const bookmaker = await this.prisma.bookmaker.findUnique({
      where: { id },
      include: {
        offers: { orderBy: { createdAt: 'desc' } },
        _count: { select: { clicks: true } },
      },
    });

    if (!bookmaker) throw new NotFoundException('Bookmaker not found');
    return bookmaker;
  }

  /** Creates a bookmaker. */
  async createBookmaker(dto: CreateBookmakerDto) {
    return this.prisma.bookmaker.create({ data: dto });
  }

  /** Updates a bookmaker. */
  async updateBookmaker(id: string, dto: UpdateBookmakerDto) {
    const existing = await this.prisma.bookmaker.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Bookmaker not found');

    return this.prisma.bookmaker.update({ where: { id }, data: dto });
  }

  /** Soft delete: sets isActive to false. */
  async deleteBookmaker(id: string) {
    const existing = await this.prisma.bookmaker.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Bookmaker not found');

    return this.prisma.bookmaker.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ---- admin offers ----

  /** Returns every offer belonging to a bookmaker. */
  async bookmakerOffers(bookmakerId: string) {
    return this.prisma.affiliateOffer.findMany({
      where: { bookmakerId },
      include: {
        bookmaker: { select: { id: true, name: true, slug: true } },
        _count: { select: { clicks: true } },
      },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /** Creates an affiliate offer. */
  async createOffer(bookmakerId: string, dto: CreateAffiliateOfferDto) {
    const bookmaker = await this.prisma.bookmaker.findUnique({
      where: { id: bookmakerId },
    });
    if (!bookmaker) throw new NotFoundException('Bookmaker not found');

    return this.prisma.affiliateOffer.create({
      data: { ...dto, bookmakerId },
    });
  }

  /** Single offer. */
  async offer(offerId: string) {
    const result = await this.prisma.affiliateOffer.findUnique({
      where: { id: offerId },
      include: {
        bookmaker: { select: { id: true, name: true, slug: true } },
        _count: { select: { clicks: true } },
      },
    });

    if (!result) throw new NotFoundException('Offer not found');
    return result;
  }

  /** Updates an offer. */
  async updateOffer(offerId: string, dto: UpdateAffiliateOfferDto) {
    const existing = await this.prisma.affiliateOffer.findUnique({
      where: { id: offerId },
    });
    if (!existing) throw new NotFoundException('Offer not found');

    return this.prisma.affiliateOffer.update({
      where: { id: offerId },
      data: dto,
    });
  }

  /** Soft delete: sets isActive to false. */
  async deleteOffer(offerId: string) {
    const existing = await this.prisma.affiliateOffer.findUnique({
      where: { id: offerId },
    });
    if (!existing) throw new NotFoundException('Offer not found');

    return this.prisma.affiliateOffer.update({
      where: { id: offerId },
      data: { isActive: false },
    });
  }

  // ---- admin analytics ----

  /**
   * Click reporting with optional filters:
   * bookmaker, offer, source, country, date range.
   */
  async clicks(filters: {
    bookmaker?: string;
    offer?: string;
    country?: string;
    source?: string;
    from?: string;
    to?: string;
  }) {
    return this.prisma.affiliateClick.findMany({
      where: {
        ...(filters.bookmaker ? { bookmakerId: filters.bookmaker } : {}),
        ...(filters.offer ? { offerId: filters.offer } : {}),
        ...(filters.country
          ? { country: filters.country.toUpperCase() }
          : {}),
        ...(filters.source ? { source: filters.source } : {}),
        ...(filters.from || filters.to
          ? {
              clickedAt: {
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                ...(filters.to ? { lte: new Date(filters.to) } : {}),
              },
            }
          : {}),
      },
      include: {
        bookmaker: { select: { id: true, name: true, slug: true } },
        offer: { select: { id: true, title: true } },
      },
      orderBy: { clickedAt: 'desc' },
    });
  }
}