import { describe, expect, it } from "vitest";

import type { PlatformImageGuideline } from "../types/platform-api";
import {
  editImageGuidelineRow,
  IMAGE_GUIDELINE_DEFAULTS,
  imageGuidelineDraftOf,
  imageGuidelineErrorsFromServer,
  imageGuidelineLabel,
  imageGuidelineOverrides,
  imageGuidelinesChanged,
  imageRatioLabel,
  imageSizeLabel,
  resetImageGuidelineRow,
  validateImageGuidelines,
} from "./image-guidelines.util";

// ─── Fixtures ─────────────────────────────────────────────────────────────

function serverRows(
  overrides: Partial<Record<string, Partial<PlatformImageGuideline>>> = {},
): PlatformImageGuideline[] {
  return Object.entries(IMAGE_GUIDELINE_DEFAULTS).map(([slot, size]) => ({
    slot,
    ...size,
    ratio: imageRatioLabel(size.width, size.height),
    note: null,
    isCustom: false,
    ...overrides[slot],
  }));
}

function failure(extensions: Record<string, unknown>, message = "Bad size") {
  return { message, graphQLErrors: [{ message, extensions }] };
}

const slotOf = (rows: { slot: string }[], slot: string) =>
  rows.findIndex((row) => row.slot === slot);

// ─── Tests ────────────────────────────────────────────────────────────────

describe("image guideline labels", () => {
  it("names known slots and humanises unknown ones", () => {
    expect(imageGuidelineLabel("COLLECTION_BANNER_DESKTOP")).toBe(
      "Collection banner · desktop",
    );
    expect(imageGuidelineLabel("HERO_VIDEO_POSTER")).toBe("Hero video poster");
  });

  it("matches core's ratio and size labels", () => {
    expect(imageRatioLabel(2400, 1350)).toBe("16:9");
    expect(imageRatioLabel(1200, 630)).toBe("1.9:1");
    expect(imageRatioLabel(1600, null)).toBeNull();
    expect(imageSizeLabel(1600, null)).toBe("1600 wide");
    expect(imageSizeLabel(2048, 2048)).toBe("2048 × 2048");
  });
});

describe("imageGuidelineOverrides", () => {
  it("sends nothing for an untouched store", () => {
    const draft = imageGuidelineDraftOf(serverRows());
    expect(imageGuidelineOverrides(draft)).toEqual([]);
    expect(imageGuidelinesChanged(draft, draft)).toBe(false);
  });

  it("keeps the server's custom rows and adds edited ones", () => {
    const initial = imageGuidelineDraftOf(
      serverRows({
        PRODUCT: {
          width: 1536,
          height: 2048,
          minWidth: 1536,
          minHeight: 2048,
          isCustom: true,
        },
      }),
    );
    const index = slotOf(initial, "COLLECTION_BANNER_MOBILE");
    const draft = initial.map((row, i) =>
      i === index ? editImageGuidelineRow(row, "height", "1920") : row,
    );
    draft[index] = editImageGuidelineRow(draft[index], "minHeight", "");
    expect(imageGuidelinesChanged(initial, draft)).toBe(true);
    expect(imageGuidelineOverrides(draft)).toEqual([
      {
        slot: "PRODUCT",
        width: 1536,
        height: 2048,
        minWidth: 1536,
        minHeight: 2048,
        note: null,
      },
      {
        slot: "COLLECTION_BANNER_MOBILE",
        width: 1080,
        height: 1920,
        minWidth: 750,
        minHeight: 1920,
        note: null,
      },
    ]);
  });

  it("drops a reset row and a custom row equal to its default", () => {
    const initial = imageGuidelineDraftOf(
      serverRows({ AVATAR: { width: 500, isCustom: true } }),
    );
    const avatar = slotOf(initial, "AVATAR");
    const reset = initial.map((row, i) =>
      i === avatar ? resetImageGuidelineRow(row) : row,
    );
    expect(reset[avatar].custom).toBe(false);
    expect(reset[avatar].width).toBe("400");
    expect(imageGuidelineOverrides(reset)).toEqual([]);

    const product = slotOf(initial, "PRODUCT");
    const same = reset.map((row, i) =>
      i === product ? editImageGuidelineRow(row, "width", " 2048 ") : row,
    );
    expect(imageGuidelineOverrides(same)).toEqual([]);
  });

  it("sends a default-sized row that carries a note", () => {
    const draft = imageGuidelineDraftOf(serverRows());
    const logo = slotOf(draft, "LOGO_WIDE");
    draft[logo] = editImageGuidelineRow(draft[logo], "note", " PNG, clear ");
    expect(imageGuidelineOverrides(draft)).toEqual([
      {
        slot: "LOGO_WIDE",
        width: 1200,
        height: 300,
        minWidth: 600,
        minHeight: 150,
        note: "PNG, clear",
      },
    ]);
  });
});

describe("validateImageGuidelines", () => {
  it("checks only custom rows, with core's rules", () => {
    const draft = imageGuidelineDraftOf(serverRows());
    const at = (slot: string) => slotOf(draft, slot);
    draft[at("PRODUCT")] = editImageGuidelineRow(
      draft[at("PRODUCT")],
      "width",
      "9000",
    );
    draft[at("AVATAR")] = editImageGuidelineRow(
      draft[at("AVATAR")],
      "minWidth",
      "500",
    );
    draft[at("BLOG_INLINE")] = editImageGuidelineRow(
      draft[at("BLOG_INLINE")],
      "minHeight",
      "100",
    );
    draft[at("LOGO_WIDE")] = editImageGuidelineRow(
      draft[at("LOGO_WIDE")],
      "width",
      "",
    );
    expect(validateImageGuidelines(draft)).toEqual({
      PRODUCT: "Whole pixels, 1 to 8000.",
      AVATAR: "The minimum width must be at most the width.",
      BLOG_INLINE: "Set a height before a minimum height.",
      LOGO_WIDE: "Enter a width.",
    });
  });
});

describe("imageGuidelineErrorsFromServer", () => {
  const slots = ["PRODUCT", "AVATAR"];

  it("puts INVALID_IMAGE_GUIDELINE on its slot, else on the form", () => {
    const reason = "INVALID_IMAGE_GUIDELINE";
    expect(
      imageGuidelineErrorsFromServer(
        failure({ code: "BAD_USER_INPUT", reason, field: "AVATAR" }),
        slots,
      ),
    ).toEqual({ AVATAR: "Bad size" });
    expect(
      imageGuidelineErrorsFromServer(
        failure({ code: "BAD_USER_INPUT", reason, field: "NOPE" }),
        slots,
      ),
    ).toEqual({ form: "Bad size" });
  });

  it("leaves other failures to the toast", () => {
    expect(
      imageGuidelineErrorsFromServer(failure({ code: "FORBIDDEN" }), slots),
    ).toBeNull();
    expect(imageGuidelineErrorsFromServer(new Error("down"), slots)).toBeNull();
  });
});
