# PRD-019: GST invoicing, platform console (pointer)

| Field | Value |
|---|---|
| Status | **Approved** 2026-10-26. Not started. Tax content is gated on the owner's CA (backend PRD §8.1, §9: the SAC code, rate and place of supply, Q14/Q15) |
| Source-of-truth PRD | [`../../../zcom-backend/docs/prd/PRD-019-gst-invoicing.md`](../../../zcom-backend/docs/prd/PRD-019-gst-invoicing.md) |
| Approved by / on | Anand (owner), 2026-10-26: "please review and approve the six drafted follow-up PRDs" (every §8 recommendation accepted) |
| Rollout step | Backend §7.1 step 5 (Part B: core billing, platform-admin, then the console) |

Only this repo's notes are here; requirements, contract and decisions live in the backend PRD.

## This repo's part
- **Settings › Legal profile** (`updatePlatformLegalProfile`, `platform:settings:manage` + `platform:billing:manage`, audited): Zerror's legal name, GSTIN, address, state, PAN, SAC code and rate, signatory, prefix. A missing profile surfaces `PLATFORM_LEGAL_PROFILE_MISSING`.
- **Client detail › Billing profile:** legal name, address, state, GSTIN (validated; `INVALID_GSTIN`). A tenant without a state shows "billing profile incomplete".
- **Billing › Invoices:** `PlatformInvoice.kind` badges (`PROFORMA`, `TAX_INVOICE`, `CREDIT_NOTE`), tax lines, place of supply, Download, and "Issue credit note" for a paid period. Coupon and void actions appear on proformas only (`CONFLICT` reason `TAX_DOCUMENT_ISSUED` otherwise). Revenue views show taxable value and tax separately, net of credit notes.
- **Download** opens the presigned `downloadUrl` in a new tab (navigation, not `fetch`), so the `vercel.json` CSP `connect-src` doesn't need the S3 origin; resolve the field on click, never cache it.
- Loading, empty, error and success states; vitest for the badge and action rules.

## Implementation log
_Not started._
