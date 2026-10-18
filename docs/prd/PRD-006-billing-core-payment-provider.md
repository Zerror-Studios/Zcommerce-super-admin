# PRD-006 — Billing core and configurable platform payment provider (console pointer)

| Field | Value |
|---|---|
| Status | **Implemented** in the working tree 2026-10-18 (not committed, not on UAT) |
| Owner | Anand (owner) · drafted by Claude Code 2026-10-18 |
| Repos affected | zcom-backend (source of truth) · zcom-super-admin |
| Source-of-truth PRD | `../../../zcom-backend/docs/prd/PRD-006-billing-core-payment-provider.md` |
| Created / Updated | 2026-10-18 / 2026-10-18 |
| Approved by / on | Anand (owner) / 2026-10-18 |

The requirements, the provider contract and the open questions live in the backend PRD. This repo only gained the provider setting.

## Scope in this repo

Settings › Billing rules › **Payment provider** (`components/settings/BillingRulesSettings.tsx`): a select over Manual, Razorpay and Nimbbl, saved through `updatePlatformSettings(input.billing.provider)`, and a chip from `platformSettings.billing.configured` saying whether the server has that provider's webhook secret. Types: `PlatformSettings.billing`, `PlatformSettingsApi.billing`, `PlatformPaymentProvider` in `types/index.ts`; adapters in `lib/api-adapters.ts`; fragment in `graphql/settings.ts`. Only `settings:manage` can change it (owner).

## Implementation log

- 2026-10-18 · Built with PRD-006. tsc clean, 49/49 operations valid, 33 vitest tests, build OK.
