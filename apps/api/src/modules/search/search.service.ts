import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

/**
 * Global search across the public surfaces: verified tipsters and published
 * articles (Content & News). Case-insensitive substring match on the fields a
 * user would search by, plus exact tag matches for articles. Kept deliberately
 * simple (Prisma `contains`) — a small, indexed dataset doesn't need full-text
 * search yet.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(rawQuery: string) {
    const q = (rawQuery ?? '').trim();
    if (q.length < 2) {
      return { query: q, tipsters: [], articles: [] };
    }
    const term = q.toLowerCase();

    const [tipsters, articles] = await Promise.all([
      this.prisma.tipster.findMany({
        where: {
          status: 'active',
          OR: [
            { displayName: { contains: q, mode: 'insensitive' } },
            { user: { username: { contains: q, mode: 'insensitive' } } },
            { bio: { contains: q, mode: 'insensitive' } },
            { sports: { has: term } },
          ],
        },
        take: 8,
        select: {
          userId: true,
          displayName: true,
          country: true,
          subscriptionPriceCents: true,
          user: { select: { username: true, avatarUrl: true } },
          stats: { select: { yield: true, clvAvg: true, sampleSize: true } },
        },
      }),
      this.prisma.article.findMany({
        where: {
          status: 'published',
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { excerpt: { contains: q, mode: 'insensitive' } },
            { body: { contains: q, mode: 'insensitive' } },
            { tags: { has: term } },
          ],
        },
        orderBy: { publishedAt: 'desc' },
        take: 8,
        select: {
          slug: true,
          title: true,
          excerpt: true,
          category: true,
          readingMinutes: true,
          publishedAt: true,
        },
      }),
    ]);

    return {
      query: q,
      tipsters: tipsters.map((t) => ({
        tipsterId: t.userId,
        name: t.displayName ?? t.user?.username ?? null,
        avatarUrl: t.user?.avatarUrl ?? null,
        country: t.country,
        yield: t.stats?.yield ?? null,
        clvAvg: t.stats?.clvAvg ?? null,
        sampleSize: t.stats?.sampleSize ?? null,
        subscriptionPriceCents: t.subscriptionPriceCents,
      })),
      articles: articles.map((a) => ({
        slug: a.slug,
        title: a.title,
        excerpt: a.excerpt,
        category: a.category,
        readingMinutes: a.readingMinutes,
        publishedAt: a.publishedAt,
      })),
    };
  }
}
