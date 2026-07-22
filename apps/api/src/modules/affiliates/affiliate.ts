// Pure authorization/display helpers for the affiliate module.
//
// Kept free of Nest decorators / DB access so it can be unit-tested with
// Node's native type-stripping test runner.

export interface BookmakerRecord {
  id: string;
  destinationUrl: string | null;
  trackingParams: string | null;
  supportedCountries: string[];
  isActive: boolean;
}

export interface AffiliateOfferRecord {
  id: string;
  destinationUrl: string;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
}

/**
 * Whether a bookmaker may be displayed to a visitor in a given country.
 * The bookmaker must be active and the country must be in its supported list.
 */
export function canDisplayBookmaker(bookmaker: BookmakerRecord, country: string,): boolean {
  if (!bookmaker.isActive) return false;
  return bookmaker.supportedCountries.includes(country.toUpperCase());
}

/**
 * Whether an affiliate offer is currently active based on its schedule.
 * An offer with no start/end dates is always active (assuming isActive is true).
 */
export function isOfferActive(offer: AffiliateOfferRecord): boolean {
  if (!offer.isActive) return false;
  const now = new Date();
  if (offer.startsAt && offer.startsAt > now) return false;
  if (offer.endsAt && offer.endsAt < now) return false;
  return true;
}

/**
 * Whether an offer may be displayed to a visitor.
 * Both the bookmaker geo-gate and the offer schedule must pass.
 */
export function canDisplayOffer(
  bookmaker: BookmakerRecord,
  offer: AffiliateOfferRecord,
  country: string,
): boolean {
  if (!canDisplayBookmaker(bookmaker, country)) return false;
  return isOfferActive(offer);
}

/**
 * Resolve the final affiliate destination URL with tracking parameters
 * appended. Returns null when no destination exists.
 */
export function resolveAffiliateDestination(
  bookmaker: BookmakerRecord,
): string | null {
  if (!bookmaker.destinationUrl) return null;
  if (!bookmaker.trackingParams) return bookmaker.destinationUrl;
  const separator = bookmaker.destinationUrl.includes('?') ? '&' : '?';
  return `${bookmaker.destinationUrl}${separator}${bookmaker.trackingParams}`;
}