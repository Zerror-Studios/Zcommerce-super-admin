# PRD-030 — Interim invoice PDF (pointer: zcom-super-admin)

| Field | Value |
|---|---|
| Status | **Approved** 2026-11-03 (owner: "Approve with the Recommended answer", D1–D7) · **Implemented** 2026-11-03 (working tree; not committed, deployed or run in a browser; deploy the backend first) |
| Source-of-truth PRD | [`../../../zcom-backend/docs/prd/PRD-030-interim-invoice-pdf.md`](../../../zcom-backend/docs/prd/PRD-030-interim-invoice-pdf.md) |
| Created / Updated | 2026-11-03 / 2026-11-03 |
| Related | PRD-017 FR-4.3 (store invoices), PRD-019 FR-B1 / FR-B7 (legal profile and the tax invoice that replace this) |

Requirements, contract and decisions live in the source-of-truth PRD. This repo implements **FR-10** and the console side of **FR-8**.

## UX notes (this repo)

- **Store › Billing & plan › Invoices:**
  - "Download PDF" sits in the open-invoice actions menu (beside Record payment, Apply discount code and Void) and in the other invoices' row menu (beside View and Copy number).
  - The Invoice pop-up footer has the same button.
  - All three are shown with `platform:billing:read`. The download is audited on the server.
- **Settings › Billing rules › Invoice issuer:**
  - Fields: legal name (required), address (1–4 lines), billing email, phone, website.
  - The card has its own "Save issuer", sent as a partial `updatePlatformSettings({ billing: { issuer } })`, and needs `settings:manage` + `billing:manage`.
  - `INVALID_ISSUER` errors show under the field named in `extensions.field`.
  - Until the issuer is saved, downloads toast "Add the invoice issuer in Settings › Billing rules…".
- The Billing rules Save never sends `issuer`, so it can't clear it.

## Implementation log (this repo)

| FR | Files |
|---|---|
| FR-10 | `src/hooks/use-invoice-pdf.ts`, `src/lib/invoice-pdf.util.ts` (decode, save, error copy, issuer draft helpers) and its test, `src/components/billing/InvoiceParts.tsx`, `src/components/billing/InvoiceRowActions.tsx`, `src/components/clients/StorePaymentsCard.tsx`, `src/graphql/billing.ts` (`PLATFORM_INVOICE_PDF`) |
| FR-8 | `src/components/settings/InvoiceIssuerCard.tsx`, `src/components/settings/BillingRulesSettings.tsx`, `src/graphql/settings.ts` (`issuer` in the settings fragment), `src/types/platform-api.ts`, `src/types/index.ts`, `src/lib/api-adapters.ts` |

**Checks (2026-11-03):**
- `tsc -b` is clean.
- vitest: **321 in 51 files** (+3).
- `check:synced`: 61 files, 0 differ. `validate:ops`: 0 invalid (the manifest has 120 operations, regenerated in zcom-backend).
- `lint:hex` 0; `lint:px` 29/36; oxlint clean on the touched files.
- `vite build` passes (with `VITE_GATEWAY_URL` set).
- Not run in a browser.
