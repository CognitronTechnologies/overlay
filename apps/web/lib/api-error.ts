export interface ApiErrorDetail {
  code?: string;
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function messageText(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const messages = value.filter((item): item is string => typeof item === 'string');
    return messages.length ? messages.join(', ') : null;
  }
  return null;
}

export async function readApiError(response: Response, fallback: string): Promise<ApiErrorDetail> {
  const body: unknown = await response.json().catch(() => null);
  if (!isRecord(body)) return { message: fallback };

  const nested = isRecord(body.message) ? body.message : null;
  const code = typeof body.code === 'string'
    ? body.code
    : typeof nested?.code === 'string'
      ? nested.code
      : undefined;
  const message = messageText(nested?.message) ?? messageText(body.message) ?? fallback;

  return { ...(code ? { code } : {}), message };
}
