/**
 * Store image guidelines (PRD-045 D7, §5.6)
 *
 * The recommended upload size of each image slot, as the store's Settings
 * › Image guidelines card shows and edits it. The server merges the
 * platform defaults with the store's overrides (`imageGuidelines`); the
 * console keeps a copy of the defaults only to offer "Reset" and to send
 * nothing for a row that matches its default. `updateTenant.imageGuidelines`
 * replaces every override, so Save always sends the full custom list.
 */

import type {
  PlatformImageGuideline,
  PlatformImageGuidelineInput,
} from "../types/platform-api";

// ─── Types ────────────────────────────────────────────────────────────────

export interface ImageGuidelineSize {
  width: number;
  /** null: any height (only the width matters). */
  height: number | null;
  minWidth: number;
  minHeight: number | null;
}

/** One editable row; the sizes are the input text. */
export interface ImageGuidelineDraftRow {
  slot: string;
  width: string;
  height: string;
  minWidth: string;
  minHeight: string;
  note: string;
  /** The store overrides this slot (the server said so, or it was edited). */
  custom: boolean;
}

export type ImageGuidelineDraftField =
  | "width"
  | "height"
  | "minWidth"
  | "minHeight"
  | "note";

/** Errors by slot, plus `form` for one that names no listed slot. */
export type ImageGuidelineErrors = Record<string, string | undefined>;

// ─── Constants ────────────────────────────────────────────────────────────

/** Largest width or height (px); core `IMAGE_GUIDELINE_MAX_PX`. */
export const IMAGE_GUIDELINE_MAX_PX = 8_000;

/** Longest note the server keeps; core trims to the same length. */
export const IMAGE_GUIDELINE_NOTE_MAX_LENGTH = 160;

/**
 * A copy of core `IMAGE_GUIDELINE_DEFAULTS`
 * (`zcom-backend/packages/core/src/media/image-guidelines.ts`), in slot
 * order. Keep the two equal: the server's `isCustom` stays the truth for
 * what is shown; this copy only fills "Reset" and drops unchanged rows.
 */
export const IMAGE_GUIDELINE_DEFAULTS: Record<string, ImageGuidelineSize> = {
  PRODUCT: { width: 2048, height: 2048, minWidth: 800, minHeight: 800 },
  COLLECTION_BANNER_DESKTOP: {
    width: 2400,
    height: 1350,
    minWidth: 1920,
    minHeight: 1080,
  },
  COLLECTION_BANNER_MOBILE: {
    width: 1080,
    height: 1350,
    minWidth: 750,
    minHeight: 938,
  },
  LOOKBOOK_COVER_DESKTOP: {
    width: 2400,
    height: 1350,
    minWidth: 1920,
    minHeight: 1080,
  },
  LOOKBOOK_COVER_MOBILE: {
    width: 1080,
    height: 1350,
    minWidth: 750,
    minHeight: 938,
  },
  LOOK_PHOTO: { width: 1600, height: 2000, minWidth: 1080, minHeight: 1350 },
  BLOG_COVER_DESKTOP: {
    width: 2400,
    height: 1350,
    minWidth: 1200,
    minHeight: 675,
  },
  BLOG_COVER_MOBILE: {
    width: 1080,
    height: 1350,
    minWidth: 750,
    minHeight: 938,
  },
  BLOG_INLINE: { width: 1600, height: null, minWidth: 800, minHeight: null },
  BLOG_CATEGORY: { width: 1200, height: 1200, minWidth: 600, minHeight: 600 },
  AVATAR: { width: 400, height: 400, minWidth: 200, minHeight: 200 },
  SOCIAL_SHARE: { width: 1200, height: 630, minWidth: 600, minHeight: 315 },
  LOGO_WIDE: { width: 1200, height: 300, minWidth: 600, minHeight: 150 },
  INVOICE_LOGO: { width: 600, height: 150, minWidth: 300, minHeight: 75 },
};

const SLOT_LABELS: Record<string, string> = {
  PRODUCT: "Product images",
  COLLECTION_BANNER_DESKTOP: "Collection banner · desktop",
  COLLECTION_BANNER_MOBILE: "Collection banner · mobile",
  LOOKBOOK_COVER_DESKTOP: "Lookbook cover · desktop",
  LOOKBOOK_COVER_MOBILE: "Lookbook cover · mobile",
  LOOK_PHOTO: "Look photos",
  BLOG_COVER_DESKTOP: "Blog cover · desktop",
  BLOG_COVER_MOBILE: "Blog cover · mobile",
  BLOG_INLINE: "Blog images in the text",
  BLOG_CATEGORY: "Blog category image",
  AVATAR: "Avatars",
  SOCIAL_SHARE: "Social share image",
  LOGO_WIDE: "Wide logo",
  INVOICE_LOGO: "Invoice logo",
};

const PX_RULE_COPY = `Whole pixels, 1 to ${IMAGE_GUIDELINE_MAX_PX}.`;

// ─── Labels ───────────────────────────────────────────────────────────────

/** "Collection banner · desktop"; an unknown slot is humanised. */
export function imageGuidelineLabel(slot: string): string {
  const label = SLOT_LABELS[slot];
  if (label) return label;
  const words = slot.toLowerCase().split("_").filter(Boolean).join(" ");
  return words ? words[0].toUpperCase() + words.slice(1) : slot;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** Core `imageRatioLabel`: "16:9" for 2400 × 1350, "1.91:1" otherwise. */
export function imageRatioLabel(
  width: number,
  height: number | null,
): string | null {
  if (!height || !width) return null;
  const divisor = gcd(width, height);
  const w = width / divisor;
  const h = height / divisor;
  if (w <= 32 && h <= 32) return `${w}:${h}`;
  const value = Math.round((width / height) * 100) / 100;
  return value >= 1
    ? `${value}:1`
    : `1:${Math.round((height / width) * 100) / 100}`;
}

/** "2048 × 2048", or "1600 wide" when any height goes. */
export function imageSizeLabel(width: number, height: number | null): string {
  return height ? `${width} × ${height}` : `${width} wide`;
}

// ─── Draft ────────────────────────────────────────────────────────────────

const text = (value: number | null | undefined) =>
  value == null ? "" : String(value);

function rowOf(
  slot: string,
  size: ImageGuidelineSize,
  note: string,
  custom: boolean,
): ImageGuidelineDraftRow {
  return {
    slot,
    width: text(size.width),
    height: text(size.height),
    minWidth: text(size.minWidth),
    minHeight: text(size.minHeight),
    note,
    custom,
  };
}

/** The server's merged list as form rows; a missing known slot shows its default. */
export function imageGuidelineDraftOf(
  rows: readonly PlatformImageGuideline[],
): ImageGuidelineDraftRow[] {
  const bySlot = new Map(rows.map((row) => [row.slot, row]));
  const known = Object.keys(IMAGE_GUIDELINE_DEFAULTS).map((slot) => {
    const row = bySlot.get(slot);
    return row
      ? rowOf(slot, row, row.note ?? "", row.isCustom)
      : rowOf(slot, IMAGE_GUIDELINE_DEFAULTS[slot], "", false);
  });
  const unknown = rows
    .filter((row) => !(row.slot in IMAGE_GUIDELINE_DEFAULTS))
    .map((row) => rowOf(row.slot, row, row.note ?? "", row.isCustom));
  return [...known, ...unknown];
}

/** Editing any field makes the row the store's own. */
export function editImageGuidelineRow(
  row: ImageGuidelineDraftRow,
  field: ImageGuidelineDraftField,
  value: string,
): ImageGuidelineDraftRow {
  return { ...row, [field]: value, custom: true };
}

export function hasImageGuidelineDefault(slot: string): boolean {
  return slot in IMAGE_GUIDELINE_DEFAULTS;
}

/** Back to the platform default; a slot with no known default is kept. */
export function resetImageGuidelineRow(
  row: ImageGuidelineDraftRow,
): ImageGuidelineDraftRow {
  const size = IMAGE_GUIDELINE_DEFAULTS[row.slot];
  return size ? rowOf(row.slot, size, "", false) : row;
}

// ─── Validation and the override list ────────────────────────────────────

/** "" → null; anything else must be a whole number of pixels. */
function parsePx(value: string): number | null | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return "invalid";
  const n = Number(trimmed);
  return n >= 1 && n <= IMAGE_GUIDELINE_MAX_PX ? n : "invalid";
}

/** The sizes as the server stores them (blank minimums = the size), or an error. */
function resolveRow(row: ImageGuidelineDraftRow): ImageGuidelineSize | string {
  const width = parsePx(row.width);
  const height = parsePx(row.height);
  const minWidth = parsePx(row.minWidth);
  const minHeight = parsePx(row.minHeight);
  if (width === null) return "Enter a width.";
  if (width === "invalid" || height === "invalid") return PX_RULE_COPY;
  if (minWidth === "invalid" || minHeight === "invalid") return PX_RULE_COPY;
  const resolvedMinWidth = minWidth ?? width;
  if (resolvedMinWidth > width) {
    return "The minimum width must be at most the width.";
  }
  if (height === null) {
    if (minHeight !== null) return "Set a height before a minimum height.";
    return { width, height: null, minWidth: resolvedMinWidth, minHeight: null };
  }
  const resolvedMinHeight = minHeight ?? height;
  if (resolvedMinHeight > height) {
    return "The minimum height must be at most the height.";
  }
  return {
    width,
    height,
    minWidth: resolvedMinWidth,
    minHeight: resolvedMinHeight,
  };
}

/** Core `cleanImageGuidelineOverrides` rules; empty when the form is fine. */
export function validateImageGuidelines(
  rows: readonly ImageGuidelineDraftRow[],
): ImageGuidelineErrors {
  const errors: ImageGuidelineErrors = {};
  for (const row of rows) {
    if (!row.custom) continue;
    const resolved = resolveRow(row);
    if (typeof resolved === "string") {
      errors[row.slot] = resolved;
    } else if (row.note.trim().length > IMAGE_GUIDELINE_NOTE_MAX_LENGTH) {
      errors[row.slot] =
        `Notes are at most ${IMAGE_GUIDELINE_NOTE_MAX_LENGTH} characters.`;
    }
  }
  return errors;
}

function equalsDefault(
  slot: string,
  size: ImageGuidelineSize,
  note: string,
): boolean {
  const base = IMAGE_GUIDELINE_DEFAULTS[slot];
  return (
    !!base &&
    !note &&
    base.width === size.width &&
    base.height === size.height &&
    base.minWidth === size.minWidth &&
    base.minHeight === size.minHeight
  );
}

/**
 * What Save sends: every custom row that differs from its default, in
 * row order. Rows that don't validate are left out (validate first).
 */
export function imageGuidelineOverrides(
  rows: readonly ImageGuidelineDraftRow[],
): PlatformImageGuidelineInput[] {
  const result: PlatformImageGuidelineInput[] = [];
  for (const row of rows) {
    if (!row.custom) continue;
    const resolved = resolveRow(row);
    if (typeof resolved === "string") continue;
    const note = row.note.trim();
    if (equalsDefault(row.slot, resolved, note)) continue;
    result.push({ slot: row.slot, ...resolved, note: note || null });
  }
  return result;
}

/** True when the form differs from what it started from. */
export function imageGuidelinesChanged(
  initial: readonly ImageGuidelineDraftRow[],
  draft: readonly ImageGuidelineDraftRow[],
): boolean {
  const key = (rows: readonly ImageGuidelineDraftRow[]) =>
    JSON.stringify(
      rows.map((row) => [
        row.slot,
        row.custom,
        row.width.trim(),
        row.height.trim(),
        row.minWidth.trim(),
        row.minHeight.trim(),
        row.note.trim(),
      ]),
    );
  return key(initial) !== key(draft);
}

// ─── Server errors ────────────────────────────────────────────────────────

interface GraphQLErrorLike {
  message?: string;
  extensions?: Record<string, unknown>;
}

/**
 * `BAD_USER_INPUT` + `INVALID_IMAGE_GUIDELINE` lands on its slot's row
 * (`extensions.field`), or on the form when the slot isn't listed; any
 * other failure is null so the caller toasts it.
 */
export function imageGuidelineErrorsFromServer(
  error: unknown,
  slots: readonly string[],
): ImageGuidelineErrors | null {
  const first = (error as { graphQLErrors?: GraphQLErrorLike[] })
    ?.graphQLErrors?.[0];
  const code = String(first?.extensions?.code ?? "");
  const reason = String(first?.extensions?.reason ?? "");
  if (code !== "BAD_USER_INPUT" || reason !== "INVALID_IMAGE_GUIDELINE") {
    return null;
  }
  const field = String(first?.extensions?.field ?? "");
  const message = first?.message || "Check this size.";
  return slots.includes(field) ? { [field]: message } : { form: message };
}
