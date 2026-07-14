/**
 * Storage for onboarding identity documents (OB-020).
 *
 * Primary backend is Supabase Storage (private bucket, signed-URL reads) when
 * SUPABASE_SERVICE_ROLE_KEY is configured. For zero-config local development we
 * fall back to a local uploads directory (UPLOAD_DIR, default ./uploads). The
 * stored path is prefixed with its backend (`supabase:` / `local:`) so reads
 * can be resolved regardless of which environment wrote it.
 *
 * We validate the MIME type and size before persisting so the endpoint can't be
 * used to stash arbitrary/oversized files.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import {
  createSignedUrl,
  storageConfigured,
  uploadObject,
} from '../../integrations/storage/supabase-storage';

/** Accepted identity-document MIME types. */
export const ALLOWED_DOC_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

/** Max identity-document size in bytes (5 MB). */
export const MAX_DOC_BYTES = 5 * 1024 * 1024;

/** The subset of a Multer file this helper needs (avoids an @types/multer dep). */
export interface UploadedDoc {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export class InvalidDocumentError extends Error {}

function uploadDir(): string {
  return process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');
}

/** Build a random, non-guessable object key preserving the file extension. */
function objectKey(originalName: string): string {
  const ext = extname(originalName).toLowerCase().slice(0, 10);
  return `${randomUUID()}${ext}`;
}

/**
 * Validate and persist an identity document, returning a backend-prefixed
 * storage path and the original filename. Throws {@link InvalidDocumentError}
 * for a missing, oversized or wrong-type file.
 */
export async function storeIdentityDocument(
  file: UploadedDoc | undefined,
): Promise<{ path: string; name: string }> {
  if (!file || !file.buffer?.length) {
    throw new InvalidDocumentError('An identity document is required');
  }
  if (!ALLOWED_DOC_MIME.has(file.mimetype)) {
    throw new InvalidDocumentError(
      'Document must be a JPG, PNG, WEBP or PDF file',
    );
  }
  if (file.size > MAX_DOC_BYTES) {
    throw new InvalidDocumentError('Document must be 5 MB or smaller');
  }

  const key = objectKey(file.originalname);

  if (storageConfigured()) {
    await uploadObject(key, file.buffer, file.mimetype);
    return { path: `supabase:${key}`, name: file.originalname };
  }

  // Local dev fallback: write to the uploads directory.
  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, key), file.buffer);
  return { path: `local:${key}`, name: file.originalname };
}

/**
 * Resolve a stored identity-document path into a readable URL for review, or
 * null when it can't be served (e.g. a local-dev file in a hosted environment).
 * Supabase-backed docs return a short-lived signed URL.
 */
export async function resolveIdentityDocumentUrl(
  storedPath: string | null,
  expiresIn = 300,
): Promise<string | null> {
  if (!storedPath) return null;
  const [backend, ...rest] = storedPath.split(':');
  const key = rest.join(':');
  if (backend === 'supabase' && storageConfigured()) {
    return createSignedUrl(key, expiresIn);
  }
  return null;
}
