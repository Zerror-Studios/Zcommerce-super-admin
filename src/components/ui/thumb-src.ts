/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Round 3 C7: which file a thumbnail loads (pure helpers behind <Thumb>, kept free of JSX so they can be tested).
 *
 * A media record may list small copies (`variants`, made on upload by the media service, PRD-037: 64/128/256/512px,
 * WebP and AVIF). A box loads the smallest copy at least twice its width (retina); without copies it loads the
 * original (`url` or `path`; today's records are plain S3 / CDN URLs with no resize service).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** One resized copy of an image (PRD-037): `width` in px, `format` "webp" | "avif" (or a MIME type). */
export interface ThumbVariant {
  width: number;
  format?: string | null;
  url: string;
}

/**
 * What a thumbnail needs from a media record. Catalog assets carry `path`, media files `url`; both work. The
 * optional fields come from the media service once it stores them (PRD-037); until then they are absent.
 */
export interface ThumbMedia {
  url?: string | null;
  path?: string | null;
  variants?: (ThumbVariant | null)[] | null;
  /** 16px blurred preview, a `data:image/…;base64,…` URI (under 400 bytes). */
  placeholder?: string | null;
  /** Dominant colour, "#RRGGBB". */
  color?: string | null;
  alt?: string | null;
  altText?: string | null;
}

export type ThumbFormat = "avif" | "webp" | "other";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** The original image URL of a media record. */
export const mediaUrl = (media?: ThumbMedia | null): string | undefined => media?.url || media?.path || undefined;

/** A copy's format from `format` ("webp", "image/avif") or, without it, the URL's extension. */
export const formatOf = (variant: ThumbVariant): ThumbFormat => {
  const format = (variant.format || variant.url.split("?")[0].split(".").pop() || "").toLowerCase();
  if (format.includes("avif")) return "avif";
  if (format.includes("webp")) return "webp";
  return "other";
};

/** The record's copies in one format, smallest first (empty or broken entries left out). */
export function variantsOf(media: ThumbMedia | null | undefined, format: ThumbFormat): ThumbVariant[] {
  return (media?.variants ?? [])
    .filter((variant): variant is ThumbVariant => !!variant?.url && variant.width > 0 && formatOf(variant) === format)
    .sort((a, b) => a.width - b.width);
}

/** `srcset` for a list of copies: "url 128w, url 256w". */
export const srcSetOf = (variants: ThumbVariant[]) =>
  variants.map((variant) => `${variant.url} ${variant.width}w`).join(", ");

/**
 * The URL a `<Thumb>` of this box loads by default: the smallest WebP (else any) copy at least twice the box
 * width (retina), else the largest copy, else the original. Use it to prefetch a page's thumbnails.
 */
export function thumbSrc(media: ThumbMedia | null | undefined, boxWidth = 40): string | undefined {
  const webp = variantsOf(media, "webp");
  const pool = webp.length ? webp : variantsOf(media, "other");
  if (!pool.length) return mediaUrl(media);
  return (pool.find((variant) => variant.width >= boxWidth * 2) ?? pool[pool.length - 1]).url;
}
