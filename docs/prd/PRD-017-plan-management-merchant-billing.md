# PRD-017 — Plan management and merchant billing (pointer: zcom-super-admin)

| Field | Value |
|---|---|
| Status | **Approved** 2026-10-26 (mirrors the source of truth; owner: "please review and approve the six drafted follow-up PRDs", every recommendation accepted, D1–D13; D8 pre-tax prices gated on the CA). **Console FR-4.1–4.5 and FR-3.2 implemented 2026-10-26** (working tree; not committed or deployed) |
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

### Console build (2026-10-26, working tree; not committed or deployed)

Against backend PRD-017 §5.1 as built (exact names). `validate:clients` 65/65; vitest 132 (new: `lib/plan-catalog.util.test.ts` 15, covering the drawer state and the versioning notice, FR-7.3); build and lint pass. D8 (pre-tax wording) gated: prices carry no tax wording.

| Backend FR | Status | As built |
|---|---|---|
| FR-4.1 Settings › Plans | DONE | `/settings/plans` (`components/settings/PlansSettings.tsx`): `platformPlans(includeInactive: true)` grouped global → custom per store (`groupPlans`), version, status chip, public / hidden / custom, both prices, `tenantCount`, `subscriberCount`, `pendingCount`, "Show archived"; `PlanEditorModal` (a dialog; the kit has no drawer) with "Unlimited" per limit (sent as 0), display fields in place, the inline versioning notice when in use (`versioningNoticeOf`), only changed fields sent (`toPlanUpdateInput`), server field errors from `extensions.field`, `PLAN_IN_USE` / `ACTIVE_VERSION_EXISTS` copy; `ArchivePlanDialog` (replacement required while in use, names the count); `MigratePlanDialog` (notice days, default 30, shows the server's `scheduled` / `alreadyScheduled` / `deferredForNotice`). Read needs `plans:read`; actions `plans:manage`, with a two-step notice when MFA is off. **Deviation:** no pre-run migration count query exists in the contract, so the dialog shows the plan's `subscriberCount` before and the server's counts after |
| FR-4.2 Store detail › Billing | DONE | plan + version, pending change, eligible plans only (`ChangePlanDialog`), PRD-016 preview, "Create custom plan for this store" (`PlanEditorModal` with `tenantId`) |
| FR-4.3 Billing › Invoices | DONE (no status history) | `/billing/invoices` (`components/billing/InvoicesTab.tsx`): `platformInvoices` with status, due-date and search filters on the server (store filter on the store page), 100 a page with Load more (`platformInvoices` offset policy), detail dialog with the line amounts, existing actions (`InvoiceRowActions`, confirmed and re-read). Status history from `subscription_event` is not built: `PlatformInvoice` has no history field |
| FR-4.4 Coupons by plan id | DONE (2026-10-26, second pass) | Discount form: "Limit to specific plans" multi-select of every version and custom plan (`platformPlans(includeInactive: true)`, `couponPlanOptions`: global first, newest version first, status shown); `appliesToPlanIds` always sent on save (an empty list returns the coupon to the tier rule); the "Applies to" column and search show the picked versions (`couponScopeLabel`); `extensions.field: appliesToPlanIds` lands on the field |
| FR-4.5 Store edit form | DONE (2026-10-26, second pass) | Store page › Store details (`StoreDetailsCard`): name, owner name / email / phone, billing email, GSTIN, timezone, currency through `updateTenant` with only the changed fields (cleared optional fields sent as null; `storeDetailsPatch`); local checks, then server errors on `extensions.field`; the domain is read-only with a link to Go live (PRD-018 FR-4 has shipped). Grace override and notes keep their controls |
| FR-1.6 migration dry run | DONE (2026-10-26, second pass) | Migrate stores shows `previewPlanMigration` (scheduled / deferred / already scheduled) for the picked target and notice before the run; replaces the earlier "subscriberCount before" deviation |
| FR-3.2 Billing rules | DONE | bank-transfer instructions (≤ 2000) and support contact (≤ 200) on Settings › Billing rules, saved with the rules; the `checkoutAvailable` chip stays |

### AI settings in the plan editor (2026-10-27, backend PRD-017 D14; working tree, not committed or deployed)
- Settings › Plans › Edit gains a **ZCOM AI** section: "Ask ZCOM and AI insights" and "Daily summary" switches, questions per week and monthly token budget (0 = none), Claude connector calls per week with a "Fair use" checkbox (-1). The note says the change applies in place to the stores on this version, without a new version, and points to the store's AI card for one store.
- An AI-only edit sends just the AI keys (`toPlanUpdateInput`), so the plan never versions; `commercialTermsChanged` ignores them. LEGACY versions now have "Edit" too, with only the display fields and the AI section (their terms are locked).
- `PLAN_FIELDS` selects the AI fields; `PlatformPlanUpdateInput` takes partial limits/features. Tests: `plan-catalog.util.test.ts` +2; vitest 234/234, `tsc -b` clean.
- Fix (same day, found on the first local save): the editor copied Apollo's `__typename` into `features`, so every plan save that sent features failed GraphQL validation (`PlatformPlanFeaturesInput` has no `__typename`), and comparing `__typename` made every save look like a commercial change. `planToDraft` now copies only the known feature keys and `sameRecord` skips `__typename`; test +1 (vitest 235).
