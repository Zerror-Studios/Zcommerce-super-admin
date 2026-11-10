/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * <Thumb> (round 3 C6/C7, spec §12.4): every small photo in a table, grid or card.
 *
 * - A fixed box (`size`, or `width` × `height`): the row never moves when the image arrives.
 * - A soft placeholder until then: the media's dominant `color`, or its 16px blurred `placeholder` (a data URI),
 *   else the neutral sunken grey. The photo fades in over 160ms (`--zc-dur-fill`).
 * - Small copies when the media record lists them (`variants`: 64/128/256/512px, WebP and AVIF, made on upload by
 *   the media service, PRD-037): `<picture>` with an AVIF and a WebP `srcset` and `sizes` = the box, so a 40px
 *   thumbnail loads the 128px file on a retina screen. Without variants it falls back to the original URL
 *   (today's records: plain S3 / CDN URLs, no resize service), so nothing breaks before the backfill.
 * - `width`/`height` set, `decoding="async"`; `priority` (the first 6 rows) loads eagerly with
 *   `fetchpriority="high"`, everything else is `loading="lazy"`.
 *
 * Media fields read (any of them may be missing): `url` or `path` (the original), `variants[] { width format url }`,
 * `placeholder`, `color`, `alt` / `altText`.
 */
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { cx } from "./cx";
import { srcSetOf, thumbSrc, variantsOf, type ThumbMedia } from "./thumb-src";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ThumbProps {
  /** The media record (asset, media file or variant image). */
  media?: ThumbMedia | null;
  /** Shortcut for a bare URL (no variants or placeholder known). */
  src?: string | null;
  /** Square box in px (default 40, the 64px-row thumbnail). */
  size?: number;
  /** A non-square box: both in px. */
  width?: number;
  height?: number;
  /** One of the first 6 visible rows / cards: load now, `fetchpriority="high"`. */
  priority?: boolean;
  /** Overrides the media's alt text ("" = decorative). */
  alt?: string;
  /** "round" for avatars; "rounded" (default) uses the 9px thumb radius. */
  shape?: "rounded" | "round";
  /** Fill the parent instead of a fixed box (cover tiles, grid cards whose box is set by the parent). */
  fill?: boolean;
  /** No 1px inner line (photos on cards that have their own edge). */
  flat?: boolean;
  className?: string;
  imgClassName?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Thumb({
  media,
  src,
  size = 40,
  width,
  height,
  priority = false,
  alt,
  shape = "rounded",
  fill = false,
  flat = false,
  className,
  imgClassName,
}: ThumbProps) {
  const record: ThumbMedia | null = media ?? (src ? { url: src } : null);
  const boxWidth = width ?? size;
  const boxHeight = height ?? size;
  const fallback = thumbSrc(record, boxWidth);
  const avif = variantsOf(record, "avif");
  const webp = variantsOf(record, "webp");
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Already in the browser cache: show it at once (no fade, no placeholder flash).
  useLayoutEffect(() => {
    const image = imgRef.current;
    if (image?.complete && image.naturalWidth > 0 && fallback) setLoadedSrc(fallback);
  }, [fallback]);

  const loaded = !!fallback && loadedSrc === fallback;
  const failed = !!fallback && failedSrc === fallback;
  const style: CSSProperties = {
    ...(fill ? {} : { width: boxWidth, height: boxHeight }),
    ...(record?.color ? { backgroundColor: record.color } : {}),
    ...(record?.placeholder && !loaded ? { backgroundImage: `url("${record.placeholder}")` } : {}),
  };
  const sizes = `${boxWidth}px`;
  const altText = alt ?? record?.alt ?? record?.altText ?? "";

  return (
    <span
      className={cx(
        "zc-thumb",
        shape === "round" && "zc-thumb--round",
        flat && "zc-thumb--flat",
        fill && "size-full",
        className,
      )}
      style={style}
      data-loaded={loaded || undefined}
    >
      {fallback && !failed ? (
        <picture>
          {avif.length ? <source type="image/avif" srcSet={srcSetOf(avif)} sizes={sizes} /> : null}
          {webp.length ? <source type="image/webp" srcSet={srcSetOf(webp)} sizes={sizes} /> : null}
          <img
            ref={imgRef}
            src={fallback}
            width={boxWidth}
            height={boxHeight}
            alt={altText}
            decoding="async"
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            draggable={false}
            onLoad={() => setLoadedSrc(fallback)}
            onError={() => setFailedSrc(fallback)}
            className={imgClassName}
          />
        </picture>
      ) : altText ? (
        <span className="sr-only">{altText}</span>
      ) : null}
    </span>
  );
}
