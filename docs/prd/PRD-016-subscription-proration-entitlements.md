# PRD-016 — Subscription proration, entitlements and dunning (pointer: zcom-super-admin)

| Field | Value |
|---|---|
| Status | **Approved** 2026-10-26 (mirrors the source of truth; D6/D7 gated for the dunning switch-on) · **console implemented 2026-10-26** (working tree; not committed or deployed; ships after the backend, rollout step 2) |
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

### Console build (2026-10-26, working tree; not committed or deployed)

Against the built backend contract (backend PRD-016 §5.2 as built). `validate:clients` 65/65 operations; vitest 132 (new: `lib/platform-billing.util.test.ts` 19, `lib/mutation-errors.test.ts` 3); `npm run build` and lint pass (warnings only, same `set-state-in-effect` pattern as before).

| Share | Status | As built |
|---|---|---|
| Plan change dialog (FR-2..FR-7) | DONE | `components/clients/ChangePlanDialog.tsx`: plans from `platformPlans(tenantId)` filtered by `planChangeOptions` (ACTIVE + the current version, never another store's custom plan); `previewTenantPlanChange` table (credit, charge, due now, next invoice) and `overLimits` warnings before confirm; `NOW` allowed outside a trial; a NOW downgrade (the preview answers `DOWNGRADE_AT_PERIOD_END`) offers the override with a required reason (`changeTenantPlan(override: true, reason)`). **Deviation:** the preview takes no `override`, so the credit an override creates can't be shown before the change; the dialog says the unused part becomes credit, and the Credits list shows it after |
| Reactivate with override (FR-18) | DONE (ship-together) | `REACTIVATE_TENANT_SUBSCRIPTION` always sends `override: Boolean!` and `reason`; dialog with an override switch (default on for CANCELLED / SUSPENDED) and a reason required with it (`reactivationVariables`). `REACTIVATE_TENANT` (store menu) sends `override` + `reason` too; the override switch needs `billing:manage`; `PAYMENT_REQUIRED` is explained in the dialog |
| Flagged tab (FR-19) | DONE | `/billing/flagged` (`components/payments/FlaggedPaymentsTab.tsx`): `platformPayments(filter: {flagged: true})`, reason labels, paid vs expected; Apply (open invoices of the store, `amountDue` shown, the server decides full / over / partial), Refunded outside, Dismiss, note required; `PAYMENT_ALREADY_RESOLVED` reloads the list |
| Store Billing card (FR-15, FR-16, FR-20, FR-21) | DONE | `components/clients/ClientPlatformBilling.tsx`: billing state chip (orders paused, pause / suspension dates), plan version, scheduled change, `creditBalance`, store invoices (`billingReason`, restart, paid, still owed, "Partially paid" derived), `platformCredits`; Issue credit, Record refund (pick a successful payment), each confirmed and re-read |
| Settings › Billing (FR-14, FR-16) | DONE (switch-on GATED) | `EntitlementsModeCard` (OFF / LOG / ENFORCE with a confirmation; the server audits before/after; an optional note since the second pass, below) and `DunningSettingsCard` (timings 0–365, suspension on or after the pause); the switch is locked while dunning is off and the console never sends `enabled: true` (it can only switch a running dunning off), with the "Switch-on gated: legal timeline must be confirmed (PRD-016 D6/D7)" note. Both save a partial `updatePlatformSettings` input; the Billing rules save never sends them |
| Coupons by plan id (FR-22) | DONE (2026-10-26, second pass) | the picker by id is PRD-017 FR-4.4 (see that pointer); tier-name coupons keep working |
| Forced downgrade preview (FR-3, FR-6) | DONE (2026-10-26, second pass) | once the override is on, `ChangePlanDialog` asks `previewTenantPlanChange(override: true)` and shows its rows plus "Credit issued to the store" (`creditIssued`, also shown for a monthly → yearly change) |
| Plan-limit mode note (FR-14) | DONE (2026-10-26, second pass) | the mode-change confirmation has an optional "Note for the audit log" sent as `PlatformSettingsInput.note` (max 500) |
| Confirmations and gating | DONE | every suspend / override / refund / credit / resolve asks first; `billing:manage`, `settings:manage`, `plans:manage` mirrored in the UI (the backend still enforces) |
