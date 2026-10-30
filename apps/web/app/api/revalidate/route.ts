import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { API_URL } from '../../../lib/api';
import { roleHasPermission, type Role } from '@overlay/shared/rbac';

type RevalidationKind = 'article' | 'free-tip';

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization || !/^Bearer\s+\S+$/.test(authorization)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let session: Response;
  try {
    session = await fetch(`${API_URL}/api/auth/me`, {
      headers: { authorization },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return NextResponse.json({ error: 'Could not verify session' }, { status: 503 });
  }
  if (!session.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const profile = await session.json().catch(() => null) as { role?: string } | null;
  if (!profile?.role || !roleHasPermission(profile.role as Role, 'content:moderate')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const payload = await request.json().catch(() => null) as {
    kind?: RevalidationKind;
    slugs?: unknown;
  } | null;
  if (payload?.kind !== 'article' && payload?.kind !== 'free-tip') {
    return NextResponse.json({ error: 'Invalid content kind' }, { status: 400 });
  }
  const slugs = payload.slugs === undefined ? [] : payload.slugs;
  if (!Array.isArray(slugs) || slugs.length > 10 || slugs.some((slug) => typeof slug !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(slug))) {
    return NextResponse.json({ error: 'Invalid article slugs' }, { status: 400 });
  }

  if (payload.kind === 'article') {
    revalidateTag('articles', { expire: 0 });
    for (const slug of slugs as string[]) revalidateTag(`article:${slug}`, { expire: 0 });
    revalidatePath('/blog', 'page');
    revalidatePath('/blog/[slug]', 'page');
    revalidatePath('/news', 'page');
  } else {
    revalidateTag('free-tips', { expire: 0 });
    revalidatePath('/', 'page');
    revalidatePath('/tips', 'page');
  }
  revalidatePath('/sitemap.xml');
  return NextResponse.json({ revalidated: true });
}
