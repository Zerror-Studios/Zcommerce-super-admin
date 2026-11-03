# PRD-031 — Store setup, store profile and configuration checks (pointer: zcom-super-admin)

| Field | Value |
|---|---|
| Status | **Approved** 2026-11-03 (owner: "approve with the recommended answer", D1–D9) · **Implemented** 2026-11-03 (working tree; not committed, deployed or run in a browser; deploy the backend first) |
| Source-of-truth PRD | [`../../../zcom-backend/docs/prd/PRD-031-store-setup-and-profile.md`](../../../zcom-backend/docs/prd/PRD-031-store-setup-and-profile.md) |
| Created / Updated | 2026-11-03 / 2026-11-03 |
| Related | PRD-005 FR-3.3 (provisioning), PRD-018 FR-4.3 (go-live checklist), PRD-025 FR-2 (store profile), PRD-029 (Nimbbl retired) |

Requirements, contract and decisions live in the source-of-truth PRD. This repo implements **FR-B2** and the console side of **FR-B1**, **FR-D2** and **FR-D3**.

## UX notes (this repo)

- **Add store** has a "Business details (optional)" card under Owner. It is collapsed ("Add details") and opens on its own when one of its fields has an error. It holds:
  - the billing contact email, GSTIN, and the business name printed on the store's invoices;
  - the PRD-025 profile (category, source, account manager, city, state, planned go-live, tags), with the same controls as the store page's Profile card.

  Only the filled-in fields are sent. Email and GSTIN are checked locally. A server field error lands on its input, through `extensions.field` or the `INVALID_*` reason.
- **After Add store** the console opens the new store's Overview, which now starts with the **Setup** card. That is how the confirmation shows the setup checks. The one-time-password dialog appears only for an older server.
- **Setup card** (`platformStoreSetup`, `platform:tenants:read`):
  - It sits on the store's Overview and above the go-live checklist on the Go live section.
  - It shows "x of 11 done". Rows are ordered Missing (amber), then Check (grey), then Done (green), each with the server's detail. A Refresh button re-reads it.
  - When the store database can't be reached (`STORE_DB_UNAVAILABLE`), it shows an inline message instead of an error.
  - The console shows no links (staff open the store instead).
- **Provisioning steps** gain "Standard shopper emails" (`notifications`) and "Invoice settings" (`storeSettings`). "Default apps" no longer names Nimbbl.

## Implementation log (this repo)

| FR | Files |
|---|---|
| FR-B1, FR-B2 | `src/pages/AddClient.tsx`, `src/components/clients/add-store/BusinessDetailsSection.tsx`, `src/types/platform-api.ts` (`CreateTenantInput` fields), `src/lib/store-setup.util.ts` (`businessDetailsInput`, `validateBusinessDetails`, `businessDetailsErrorsFromServer`) |
| FR-D2, FR-D3 | `src/components/clients/StoreSetupCard.tsx`, `src/graphql/tenants.ts` (`PLATFORM_STORE_SETUP`), `src/types/platform-api.ts` (`PlatformStoreSetupCheck`), `src/lib/store-setup.util.ts` (labels, tone, order), `src/pages/ClientDetail.tsx` |
| FR-C (labels) | `src/components/clients/OnboardingCard.tsx` now uses `provisioningStepLabel` |
| Tests | `src/lib/store-setup.util.test.ts` (5) |

**Checks (2026-11-03):**
- `tsc -b` is clean.
- vitest: **326 in 52 files** (+5).
- `check:synced`: 61 files, 0 differ. `validate:ops`: 0 invalid.
- `lint:hex` 0; `lint:px` 29/36. oxlint on the touched files: one existing warning in `ClientDetail.tsx:260` (old code).
- `vite build` passes (with `VITE_GATEWAY_URL`).
- Not run in a browser. The backend manifest is regenerated in zcom-backend.
