// Pure authorization helpers for the blog authoring workflow (OB-071).
//
// Kept free of Nest decorators / DB access so it can be unit-tested with
// Node's native type-stripping test runner.

export type AuthorRole = 'user' | 'tipster' | 'admin';

export interface AuthoringActor {
  userId: string;
  role: AuthorRole;
}

export interface TipsterApproval {
  status: string;
}

/**
 * Whether a principal may author articles at all. Admins always can; tipsters
 * may author only once approved (an active tipster account).
 */
export function canAuthorArticles(
  actor: AuthoringActor,
  tipster?: TipsterApproval | null,
): boolean {
  if (actor.role === 'admin') return true;
  if (actor.role === 'tipster') return tipster?.status === 'active';
  return false;
}

/**
 * Whether a principal may edit/delete a specific article. Admins may manage
 * any article; authors (tipsters) may manage only their own.
 */
export function canManageArticle(
  actor: AuthoringActor,
  article: { authorId: string },
): boolean {
  if (actor.role === 'admin') return true;
  return actor.role === 'tipster' && article.authorId === actor.userId;
}
