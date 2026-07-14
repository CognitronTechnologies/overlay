/**
 * Resilient JSON fetch for real sports-data vendors (OB-045).
 *
 * Live vendors rate-limit (HTTP 429) and have transient 5xx blips; without
 * retries a single 429 would fail an entire settlement cycle. This wrapper
 * retries retryable statuses with capped exponential backoff, honouring a
 * numeric `Retry-After` header when present. The retry-decision helpers are
 * pure so they can be unit-tested without the network.
 */

export const MAX_RETRIES = 3;

/** Retry on rate limits (429) and server errors (5xx); never on 4xx (else). */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

/**
 * Backoff before the next attempt. Prefers a numeric `Retry-After` (seconds,
 * capped at 30s); otherwise capped exponential backoff (0.5s, 1s, 2s, …, ≤8s).
 */
export function retryDelayMs(
  attempt: number,
  retryAfterHeader?: string | null,
): number {
  const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : NaN;
  if (Number.isFinite(retryAfter) && retryAfter >= 0) {
    return Math.min(retryAfter * 1000, 30_000);
  }
  return Math.min(500 * 2 ** attempt, 8_000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface FetchJsonOptions {
  /** Label used in thrown errors (e.g. the provider name). */
  label?: string;
  /** Max retry attempts after the first try (default {@link MAX_RETRIES}). */
  maxRetries?: number;
}

/**
 * Fetch JSON with retries on rate-limit / transient errors. Throws on a
 * non-retryable status or after exhausting retries.
 */
export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  opts: FetchJsonOptions = {},
): Promise<T> {
  const label = opts.label ?? 'sports';
  const maxRetries = opts.maxRetries ?? MAX_RETRIES;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      // Network error — retry with backoff if attempts remain.
      lastError = err;
      if (attempt < maxRetries) {
        await sleep(retryDelayMs(attempt));
        continue;
      }
      throw err;
    }

    if (res.ok) return (await res.json()) as T;

    if (isRetryableStatus(res.status) && attempt < maxRetries) {
      await sleep(retryDelayMs(attempt, res.headers.get('retry-after')));
      continue;
    }
    throw new Error(`${label} ${res.status} for ${url}`);
  }

  throw lastError ?? new Error(`${label} request failed for ${url}`);
}
