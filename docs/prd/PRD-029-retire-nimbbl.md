# PRD-029 — Retire Nimbbl (pointer: zcom-super-admin)

| Field | Value |
|---|---|
| Status | **Approved for FR-5 removal** 2026-11-23 (owner, D3) · **Implemented (console)** 2026-11-23 (working tree; not committed, deployed or run in a browser; deploy the backend first) |
| Source-of-truth PRD | [`../../../zcom-backend/docs/prd/PRD-029-retire-nimbbl.md`](../../../zcom-backend/docs/prd/PRD-029-retire-nimbbl.md) (§8.1 D3) |
| Created / Updated | 2026-11-23 / 2026-11-23 |

Requirements, contract and decisions live in the source-of-truth PRD. This repo implements only the console part of D3.

## In this console

- **Settings › Billing rules › Payment provider** offers Manual and Razorpay (Stripe exists only in the type, as before): `PlatformPaymentProvider` is `MANUAL | RAZORPAY | STRIPE` (`src/types/index.ts`, `PlatformSettingsApi.billing.provider`), matching the backend enum. A stored `NIMBBL` reaches the console as `MANUAL`. The settings search no longer matches "nimbbl".
- **History stays readable:** `paymentGatewayEnum` and the platform payment / gateway-mix types keep `NIMBBL` (payments taken before the shutdown), and `display-labels.util.ts` still labels it "Nimbbl" (gateways, app providers).
- **Store signals are unchanged in shape:** the health issue now reads "Payment app Nimbbl has shut down", the attention item "<store> still points checkout at Nimbbl, which has shut down…" (rule `PAYMENT_APP_RETIRING`), the setup check "Nimbbl has shut down. Make another payment app primary for checkout.", and the `storesOnNimbbl` metric stays. The console shows the server's text; only comments and test fixtures carried the old "being retired" wording.

## Implementation log (this repo)

| Date | Entry |
|---|---|
| 2026-11-23 | `src/types/index.ts`, `src/types/platform-api.ts`, `src/components/settings/BillingRulesSettings.tsx` (NIMBBL option removed), `src/components/settings/settings-sections.ts` (keyword), comments in `src/lib/health-factors.util.ts` and `src/lib/store-health-rows.util.ts`, fixtures in four `src/lib/*.test.ts`. `tsc -b` clean, vitest 433/433, `validate:clients` 156/156 operations, 0 failures. |
