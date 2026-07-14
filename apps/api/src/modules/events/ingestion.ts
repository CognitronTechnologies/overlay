/**
 * Pure helpers for fixture ingestion (OB-045 / OB-046).
 *
 * Kept free of Nest/Prisma so the config parsing and vendor-data validation can
 * be unit-tested in isolation. The scheduled ingestion job reads the configured
 * sport keys and the service validates each provider event before upserting, so
 * malformed vendor rows never reach the database.
 */
import type { ProviderEvent } from '../../integrations/sports/sports-provider.interface';

/**
 * Parse the INGEST_SPORTS env (comma-separated vendor sport keys, e.g.
 * "soccer_epl,basketball_nba") into a clean, de-duplicated list.
 */
export function parseIngestSports(raw: string | undefined): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))];
}

/**
 * Validate a provider event before it's persisted. Guards against missing ids,
 * blank team names and invalid/absent start times — the common shapes of bad
 * vendor data — so ingestion is resilient to partial upstream responses.
 */
export function isValidProviderEvent(e: ProviderEvent): boolean {
  return (
    typeof e.vendorEventId === 'string' &&
    e.vendorEventId.trim().length > 0 &&
    typeof e.sport === 'string' &&
    e.sport.trim().length > 0 &&
    typeof e.home === 'string' &&
    e.home.trim().length > 0 &&
    typeof e.away === 'string' &&
    e.away.trim().length > 0 &&
    e.startTime instanceof Date &&
    !Number.isNaN(e.startTime.getTime())
  );
}
