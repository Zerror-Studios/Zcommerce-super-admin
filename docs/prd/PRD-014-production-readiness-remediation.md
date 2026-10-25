# PRD-014 — Production-readiness remediation (pointer: zcom-super-admin)

| Field | Value |
|---|---|
| Status | **Approved** 2026-10-25 (mirrors the source of truth); Wave 0 console items (W0-F) implemented 2026-10-25, not deployed |
| Source-of-truth PRD | `../../../zcom-backend/docs/prd/PRD-014-production-readiness-remediation.md` |
| Audit | `../../../zcom-backend/docs/audits/2026-10-25-production-readiness/` (findings FE-01, UX-23 in `E-clients-journeys.md`; PLT-01, PLT-02, PLT-03 in `C-platform-billing-apps.md`) |
| Repos affected | zcom-backend (source of truth) · zcom-frontend · **zcom-super-admin (this repo: FR-0.7, the console part of FR-0.9 and FR-0.10, decision D6)** · storefronts/* |
| Created / Updated | 2026-10-25 / 2026-10-25 |

All requirements, decisions and the wave plan live in the source-of-truth PRD. This file lists **this repo's** share of Wave 0.

## This repo's work (Wave 0, W0-F)

| FR / decision | Finding | What changed | Files |
|---|---|---|---|
| FR-0.7 | FE-01 | The CSP `connect-src` allows the API origin `https://api.zerrorstudios.com` (the origin of the production `VITE_GATEWAY_URL`), so the console can call the API and refresh its session. A unit test parses `vercel.json` and asserts it. `vercel.json` is the only header source in this repo (no Amplify `customHttp.yml`, no CSP meta tag) | `vercel.json`, `src/lib/vercel-csp.test.ts` |
| FR-0.9 | UX-23 | The store page's synthetic "Performance" chart (a made-up six-month series from the 30-day totals) is removed; no console query has a per-store monthly series. Plan usage never divides by a missing or zero limit: such a limit reads "No limit" with no bar, an unmeasured value reads "—", and a metric with neither (bandwidth today) is hidden. No invented default limits when the plan is unknown | `src/components/clients/ClientOverviewTab.tsx`, `src/components/clients/ClientUsageTab.tsx`, `src/lib/api-adapters.ts` (`usageBarOf`, + tests), `src/types/index.ts` |
| FR-0.10 / D6 | PLT-03 (interim), PLT-01 | Change plan always sends `effective: PERIOD_END`; "Apply now" is shown disabled with the reason ("Immediate plan changes need prorated invoicing. Schedule the change for the end of the period."), and the button reads "Schedule change". A `PRORATION_NOT_AVAILABLE` reason from the server maps to the same copy. Record payment (store page and Collections invoice row) cannot be submitted twice: a ref guard plus a disabled, loading button while the request is in flight; the success toast shows only after the server answers. The server's amount and duplicate checks surface inline through `extensions.reason` (known reasons get console copy, others show the server's `BAD_USER_INPUT` message) | `src/components/clients/SubscriptionActions.tsx`, `src/components/billing/InvoiceRowActions.tsx`, `src/lib/mutation-errors.ts` |
| FR-0.10 / D6 follow-up (2026-10-25, after the backend contract landed) | PLT-03, SEC-04 | **Scheduled change:** `PlatformSubscriptionFields` selects `pendingPlanId` and `pendingBillingCycle`; the Subscription card says "Scheduled change: moves to {plan}, billed {cycle} on {renewal date}, the next renewal" (`scheduledPlanChangeOf`, + tests). **Trial:** "Apply now" is enabled only for a `TRIAL` subscription (a trial changes at once under either timing); everything else sends `PERIOD_END`. **Activate without payment:** a new dialog (store page, `billing:manage` only, `TRIAL` or `PAST_DUE`) with an explicit warning and a required reason calls `activateTenantSubscription(override: true, reason)`. `FORBIDDEN` with reason `PAYMENT_REQUIRED` (activation or `reactivate` on a trial without a payment) shows the console's own copy; the Apollo link no longer shows its "You don't have permission" toast for that business-rule reason. **Invoice record payment:** `recordInvoicePayment(id: …)` already sends the invoice id (`id` is the invoice); the schema has no separate `invoiceId` argument, so nothing changed | `src/graphql/subscriptions.ts` (`ACTIVATE_TENANT_SUBSCRIPTION`), `src/types/platform-api.ts`, `src/types/index.ts`, `src/lib/api-adapters.ts` (+ tests), `src/lib/mutation-errors.ts`, `src/lib/apollo-client.ts`, `src/components/clients/SubscriptionActions.tsx` |
| Hygiene | — | `npm audit fix` (no `--force`): Vite 8.3.0 → 8.3.5 in the lockfile (high). Left: `vitest` 3 → `tinypool` (critical) and `@vitest/mocker` (moderate), dev-only, fixed only by vitest 5 (a major) | `package-lock.json` |

## Contract

Additive only: `PlatformSubscriptionFields` gained `pendingPlanId` and `pendingBillingCycle`, and the new operation `ActivateTenantSubscription` calls `activateTenantSubscription(tenantId, override, reason)`. `changeTenantPlan` sends `PERIOD_END` (or `NOW` for a trial); `recordInvoicePayment` and `recordSubscriptionPayment` are unchanged. All 45 operations validate against the supergraph recomposed at 14:53 on 2026-10-25.

## Implementation log

- 2026-10-25 · W0-F · Items above. Checks: `tsc -b` clean, vitest 49/49 (43 before; +2 CSP, +4 usage bars), `npm run build` OK with an https gateway URL, `npm run validate:ops` 0 invalid, workspace contract validator 44/44 valid, oxlint only the pre-existing warnings, `lint:hex` 0. Not run in a browser or against a live gateway.
- 2026-10-25 · W0-F follow-up · Scheduled plan change, trial-only "Apply now", "Activate without payment" override, `PAYMENT_REQUIRED` mapping (table above). Checks: `tsc -b` clean, vitest 52/52 (+3 scheduled-change tests), build OK, `validate:ops` 0 invalid, workspace contract validator 45/45 valid against the 14:53 supergraph, oxlint no warnings in touched files, `lint:hex` 0. Not run in a browser.
