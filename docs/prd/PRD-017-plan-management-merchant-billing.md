# PRD-017 — Plan management and merchant billing (pointer: zcom-super-admin)

| Field | Value |
|---|---|
| Status | **Approved** 2026-10-26 (mirrors the source of truth; owner: "please review and approve the six drafted follow-up PRDs", every recommendation accepted, D1–D13; D8 pre-tax prices gated on the CA). Not started |
| Source-of-truth PRD | [`../../../zcom-backend/docs/prd/PRD-017-plan-management-merchant-billing.md`](../../../zcom-backend/docs/prd/PRD-017-plan-management-merchant-billing.md) |
| Approved by / on | Workspace owner / 2026-10-26 (backend PRD §8.1) |
| Created / Updated | 2026-10-26 / 2026-10-26 |
| Findings | PLT-06, UX-25 (backend audit Appendices C and E) |

Requirements, decisions and the contract live in the source-of-truth PRD. This file holds only **this repo's** UX and implementation notes (backend FR-4, the console side of FR-1 and FR-3.2).

## This repo's work

| Backend FR | Screen / change | Notes |
|---|---|---|
| FR-4.1 | **Settings › Plans** (`settings/:section`, section `plans`; `platform:plans:read`, actions `platform:plans:manage`) | Group by tier and scope; version, status chip, public/hidden, both prices, `tenantCount`, `subscriberCount`, `pendingCount`. Create/edit drawer with an explicit "Unlimited" choice per limit; the versioning notice is inline copy, not a modal. Archive dialog requires a replacement while the plan is in use. "Migrate subscribers" dialog with notice days (default 30, D3) and the server's counts. Every action shows the server answer before any toast (UX-24 rule); field errors from `extensions.field`; `CONFLICT` reasons `PLAN_IN_USE`, `ACTIVE_VERSION_EXISTS` mapped to copy |
| FR-4.2 | **Store detail › Billing** (`stores/:id`) | Current plan with version, pending plan. "Change plan" lists only eligible plans from the server (never a LEGACY one). Keep the D6 behaviour already in `SubscriptionActions.tsx` until PRD-016 lands; then show `previewTenantPlanChange`. "Create custom plan for this store" opens the Plans drawer with `tenantId` preset |
| FR-4.3 | **Billing › Invoices** (`billing/:section`, section `invoices`) | `platformInvoices` with status, store, due-date and search filters, server paging through `src/lib/offset-paging.util.ts` (no 100 cap), detail drawer with status history and the existing actions (`InvoiceRowActions.tsx`: record payment, void, apply coupon), each confirmed and refetched |
| FR-4.4 | Coupons | Edit, deactivate and paging are already done (PRD-014 PLT-13). Only the plan picker by id (`appliesToPlanIds`) is added, when PRD-016 FR-22 lands |
| FR-4.5 | **Store edit form** on Store detail | Through the existing `UPDATE_TENANT` / `ClientsProvider.updateClient` (today wired only for the grace override and notes). The domain field becomes read-only with a link to the PRD-018 Go live tab once PRD-018 FR-4 ships |
| FR-3.2 | **Settings › Billing rules** | Two new text fields on `BillingRulesSettings.tsx`: bank-transfer instructions and support contact (`PlatformBillingSettingsInput`); the existing `checkoutAvailable` chip stays |

## Implementation notes

- New documents go in `src/graphql/plans.ts` (`CreatePlan`, `UpdatePlan`, `ArchivePlan`, `MigratePlanSubscribers`, `PlatformPlan`) and `src/graphql/billing.ts` (`PlatformInvoices`); types in `src/types/platform-api.ts`, adapters in `src/lib/api-adapters.ts` with vitest cases.
- Plan mutations need MFA (manage permission); a `FORBIDDEN` from a missing step-up uses the existing MFA flow.
- Vitest: the Plans drawer state and the versioning notice (backend FR-7.3); `validate:ops` passes against the composed schema.
- Rollout: after the backend catalog phase (backend §9 phase 1).

## Implementation log

- 2026-10-26 · Pointer created on approval. Not started.
