/**
 * User/tipster avatar. Shows the uploaded/chosen image when present, otherwise
 * a deterministic generated avatar (DiceBear) seeded by the username so it's
 * stable per user.
 *
 * Plain <img> (not next/image) so no domain config is needed and it works in
 * both server and client components.
 */
import { generatedAvatarUrl } from '../lib/avatar';

export default function Avatar({
  src,
  seed,
  size = 40,
  alt = '',
  style,
}: {
  src?: string | null;
  seed?: string | null;
  size?: number;
  alt?: string;
  style?: React.CSSProperties;
}) {
  const url = src && src.length > 0 ? src : generatedAvatarUrl(seed);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
