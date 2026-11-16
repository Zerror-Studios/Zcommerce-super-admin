# PRD-045 — Merchandising: manual order, desktop and mobile images, image guidelines (pointer: zcom-super-admin)

| Field | Value |
|---|---|
| Status | **Approved** 2026-11-16 (owner) · **Implemented (console)** 2026-11-16 (working tree; not committed, deployed or run in a browser; deploy the backend first) |
| Source-of-truth PRD | [`../../../zcom-backend/docs/prd/PRD-045-merchandising-order-and-banners.md`](../../../zcom-backend/docs/prd/PRD-045-merchandising-order-and-banners.md) |
| Created / Updated | 2026-11-16 / 2026-11-16 |

Requirements, contract and decisions live in the source-of-truth PRD. This repo implements only **D7** (§5.6): Zerror sets each store's image guideline overrides in the console. Manual order and desktop/mobile images are dashboard, kit and storefront work.

## UX notes (this repo)

- **Where:** the store page's **Settings** tab, an **Image guidelines** card under Store details (`#image-guidelines`).
- **Read view** (every role with the store page): one row per slot, in the server's slot order, with a human label ("Product images", "Collection banner · desktop" …), the size (W × H, or "W wide" when any height goes), the ratio ("Any" without a height), the minimum and the note. A **Custom** chip marks a slot the store overrides; the description counts them or says "All platform defaults".
- **Edit** (`platform:tenants:manage` only), in place like the Profile card: per slot Width, Height, Min width, Min height (whole pixels, 1–8000) and an optional Note (≤ 160). Editing a field makes the row custom; **Reset** puts the slot back to the platform default. A blank minimum uses the size; a blank height means any height.
- **Save** sends `updateTenant.imageGuidelines` with every custom row that differs from its default (the list replaces all overrides; `[]` clears them). Local checks mirror core `cleanImageGuidelineOverrides`; a server `INVALID_IMAGE_GUIDELINE` lands on the row named by `extensions.field`, anything else is a toast. Leaving the page with unsaved edits asks first (`useUnsavedChangesGuard`).
- **States:** skeleton rows while loading, an inline error with Retry, an empty state if the server sends no slots.
- The console keeps a **copy** of core `IMAGE_GUIDELINE_DEFAULTS` (`src/lib/image-guidelines.util.ts`) for Reset and to drop rows equal to their default; the server's `isCustom` stays the truth for what is shown. Keep the copy equal to core.

## Implementation log (this repo)

| Item | Files |
|---|---|
| D7 card | `src/components/clients/StoreImageGuidelinesCard.tsx`, `src/pages/ClientDetail.tsx` (Settings tab) |
| Operations | `src/graphql/image-guidelines.ts` (`PlatformTenantImageGuidelines`, `UpdateTenantImageGuidelines`), `src/types/platform-api.ts` (`PlatformImageGuideline`, `PlatformImageGuidelineInput`, `UpdateTenantInput.imageGuidelines`) |
| Rules | `src/lib/image-guidelines.util.ts` |
| Tests | `src/lib/image-guidelines.util.test.ts` (9) |

**Checks (2026-11-16):** `tsc -b` clean; vitest **392 in 59 files**, all green; `validate:ops` 0 invalid (both new operations ok against the backend working-tree schema); oxlint clean on the new files; `lint:hex` 0, `lint:px` 18/18. The backend `validate:clients` manifest was not regenerated (owner/backend step).
