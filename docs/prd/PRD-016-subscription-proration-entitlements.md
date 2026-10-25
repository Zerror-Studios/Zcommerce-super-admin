# PRD-016 — Subscription proration, entitlements and dunning (pointer: zcom-super-admin)

| Field | Value |
|---|---|
| Status | **Approved** 2026-10-26 (mirrors the source of truth; D6/D7 gated for the dunning switch-on) · not started |
| Source-of-truth PRD | [`../../../zcom-backend/docs/prd/PRD-016-subscription-proration-entitlements.md`](../../../zcom-backend/docs/prd/PRD-016-subscription-proration-entitlements.md) |
| Approved by / on | Anand (owner), 2026-10-26: "please review and approve the six drafted follow-up PRDs" (every recommendation accepted; backend §8.1 D1–D18) |
| Created / Updated | 2026-10-26 / 2026-10-26 |
| Related | PRD-017 pointer (plan management, store Billing) · PRD-014 pointer (D6 period-end plan changes, "Activate without payment") |

Requirements, decisions and the contract live in the source-of-truth PRD. This file lists only **this repo's** share: FR-26 and the console side of FR-18/FR-19/FR-21/FR-22. It ships right after the backend deploy (rollout step 2), because `reactivateTenantSubscription` then needs `override` + `reason`.

## This repo's share

- **Plan change dialog:** `previewTenantPlanChange` table (credit, charge, due now, next invoice) with over-limit warnings; `NOW` enabled outside a trial (replaces the D6 "disabled with explanation"); the downgrade-now override asks for a reason and shows the credit it creates.
- **Billing › Transactions › Flagged tab** (`platformPayments(filter: { flagged: true })`): `failureReason` (`AMOUNT_MISMATCH`, `SUBSCRIPTION_NOT_PAYABLE`, `INVOICE_NOT_OPEN`), expected vs paid; actions Apply (pick an open invoice; partial shows `amountDue`), Refunded outside, Dismiss, each with a required note (`resolveFlaggedPlatformPayment`); `PAYMENT_ALREADY_RESOLVED` reloads the row.
- **Store detail › Billing card:** `billingState`, orders-pause and suspension dates, `creditBalance` and `platformCredits`, open invoices with `billingReason` (PERIOD/PRORATION; `kind` is PRD-019's document type) / `amountPaid` / `amountDue` (`PARTIALLY_PAID` chip); "Issue credit" (`issuePlatformCredit`), "Record refund" (`recordPlatformRefund`), "Reactivate (override)" with a required reason (the current button sends neither).
- **Settings › Billing:** dunning timings and the `dunning.enabled` switch (with a note that it stays off until the merchant terms are published, D6), and the entitlement mode `OFF` / `LOG` / `ENFORCE` (`platform:settings:manage`).
- **Coupons:** pick plans by id (`appliesToPlanIds`), including store-custom plans.
- **Confirmations** before any action that suspends, overrides or refunds; permission gating on `platform:billing:manage` / `platform:settings:manage`.
- **Checks:** vitest for the preview and review flows; `validate:clients`; the console contract notes updated in the same change.

## Implementation log

Not started.
