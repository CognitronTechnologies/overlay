/**
 * Generated-avatar helpers (DiceBear). Users who don't upload a photo can pick
 * one of these friendly generated avatars; the chosen SVG URL is stored as the
 * user's avatarUrl. Kept in one place so the picker and the display component
 * stay in sync.
 */

/** Friendly generated-avatar styles offered in the picker. */
export const AVATAR_STYLES = [
  'initials',
  'adventurer',
  'avataaars',
  'big-smile',
  'fun-emoji',
  'lorelei',
  'notionists',
  'micah',
  'open-peeps',
  'thumbs',
  'bottts',
] as const;

export type AvatarStyle = (typeof AVATAR_STYLES)[number];

/** The style used for the default fallback avatar. */
export const DEFAULT_AVATAR_STYLE: AvatarStyle = 'adventurer';

/** Base URL prefix all generated avatars share (used for server-side validation). */
export const DICEBEAR_PREFIX = 'https://api.dicebear.com/';

/** Build a DiceBear SVG URL for a given style + seed. */
export function dicebearUrl(style: string, seed: string): string {
  return `${DICEBEAR_PREFIX}9.x/${style}/svg?seed=${encodeURIComponent(
    seed || 'overlay',
  )}`;
}

/** The deterministic fallback avatar for a user (used when none is chosen). */
export function generatedAvatarUrl(seed?: string | null): string {
  return dicebearUrl(DEFAULT_AVATAR_STYLE, seed || 'overlay');
}

/** A set of generated avatar options to choose from, one per style. */
export function avatarOptions(seed: string): { style: string; url: string }[] {
  return AVATAR_STYLES.map((style) => ({
    style,
    url: dicebearUrl(style, seed || 'overlay'),
  }));
}
