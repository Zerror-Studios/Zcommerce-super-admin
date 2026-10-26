# PRD-018 — Tenant data lifecycle (pointer: zcom-super-admin)

| Field | Value |
|---|---|
| Status | **Approved** 2026-10-26 (mirrors the source of truth; owner: "please review and approve the six drafted follow-up PRDs", every recommendation accepted, D1–D19; D5 restricted admin mode an explicit tenant-boundary yes; the legal assumptions L1–L12 and D2, D4, D11, D14, D16, D18, D19 gated on the owner's lawyer, CA for L2). **Console: ungated FRs implemented 2026-10-26** (working tree; not committed or deployed); FR-3 gated |
| Source-of-truth PRD | [`../../../zcom-backend/docs/prd/PRD-018-tenant-data-lifecycle.md`](../../../zcom-backend/docs/prd/PRD-018-tenant-data-lifecycle.md) |
| Approved by / on | Workspace owner / 2026-10-26 (backend PRD §8.1) |
| Created / Updated | 2026-10-26 / 2026-10-26 |
| Findings | PLT-09, PLT-10, PLT-29 (backend audit Appendix C) |

Requirements, decisions, the security model (§7.2) and the contract live in the source-of-truth PRD. This file holds only **this repo's** UX and implementation notes (backend §6 "Console").

## This repo's work

| Backend FR | Screen / change | Notes |
|---|---|---|
| FR-1.1, FR-1.2 | **Store detail › Lifecycle** (new tab on `stores/:id`) | Status and category chips; money-in-flight panel (`tenantMoneyInFlight`; show "partial" when the server says so). Suspend dialog: category select (default `POLICY`), reason, the panel inside the dialog. Reactivate with a confirmation |
| FR-2.1, FR-2.3 | Delete and restore | Delete: type the slug; with money in flight list the blockers; "Delete anyway" only for the platform owner, reason required (`FORBIDDEN` / `OWNER_ONLY` otherwise). Restore with the grace countdown ("Data will be purged on …") |
| FR-3.1 | Exports | Request (one running at a time: `CONFLICT` / `EXPORT_RUNNING`), list, download (24 h link) |
| FR-2.5 | **Stores list** | "Purged stores" view (`platformPurgedTenants`, server paging) and a DELETED (in grace) filter |
| FR-4 | **Store detail › Go live** (new tab) | Gated phase E. Domain verification with a copyable TXT record, "Check now" and its last error; the checklist with pass / fail / unknown / waived icons and text; "Mark live" with waivers and a reason. The domain field of the store edit form (PRD-017 FR-4.5) becomes read-only with a link here |
| §5.1 | **Data requests** overview | `platformDataRequestStats`: counts per store, overdue highlighted; never any shopper data |

## Implementation notes

- New documents in `src/graphql/tenants.ts` (`SuspendTenant` gains `category`; `DeleteTenant` gains `force`, `forceReason`; `RestoreTenant`, `TenantMoneyInFlight`, `RequestTenantExport`, `TenantExports`, `StartDomainVerification`, `CheckDomainVerification`, `TenantGoLiveChecklist`, `MarkTenantLive`, `PlatformPurgedTenants`, `PlatformDataRequestStats`); adapters and vitest cases in `src/lib/`.
- Every destructive action has a confirmation and shows the server answer before any toast; errors map `extensions.reason` (`MONEY_IN_FLIGHT` with counts, `PURGE_STARTED`, `DOMAIN_TAKEN`, `CHECKLIST_FAILED`, `INVALID_DOMAIN`, `RESERVED_DOMAIN`, and `TENANT_CHANGED` when a delete loses a race, review CP2-07).
- Impersonating a `POLICY`-suspended store (to settle orders) uses the existing "Log in to store"; the store opens in restricted mode.
- Rollout follows the backend phases A–E (§9); phase D waits for the lawyer.

## Implementation log

- 2026-10-26 · Pointer created on approval. Not started.

### Console build (2026-10-26, working tree; not committed or deployed)

Against backend PRD-018 §5.1 as built (exact names; no deviation from the contract). `validate:clients` 75/75 operations; vitest 145 (new `lib/tenant-lifecycle.util.test.ts`, 11 cases); `npm run build` with `VITE_GATEWAY_URL`, lint (warnings only, all pre-existing patterns), `lint:hex`, `check:synced` pass. Deploy the backend first: `updateTenant.domain` answers `USE_DOMAIN_VERIFICATION`, and the console no longer sends a domain there.

**UX deviation:** the store page stays one page with sections (owner's no-tabs decision, 2026-10-16), so "Lifecycle" and "Go live" are sections on `stores/:id`, not tabs. Delete is shown to the platform owner only (the backend has refused other roles since Q10).

| Backend FR | Status | As built |
|---|---|---|
| FR-1.1 categories | DONE | `SUSPEND_TENANT` sends `category` (default POLICY, each with its restricted-mode consequence in the select); a suspended store can change category ("Change category"; same category refused locally and by the server); chips on the Lifecycle section |
| FR-1.2 money in flight | DONE | `MoneyInFlightPanel` (`tenantMoneyInFlight`, network-only, Refresh, the `partial` warning) on the Lifecycle section and inside the suspend and delete dialogs |
| FR-1.8 stale payments | DONE | Billing › Stuck store payments (`/billing/stuck`) and the store's list on Lifecycle (`platformStalePendingPayments`, billing:read; `partial` shown) |
| FR-2.1 guarded delete | DONE | `DELETE_TENANT` with `force` / `forceReason`; `MONEY_IN_FLIGHT` keeps the dialog open and lists the blocking counts from `extensions.counts`; "Delete anyway" only for PLATFORM_OWNER with a required reason (`OWNER_ONLY` is a business FORBIDDEN in the Apollo link: no permission toast) |
| FR-2.3 restore | DONE | `RESTORE_TENANT` from the store page (menu and Lifecycle) with "Data will be purged on …" and days left; disabled after `purgeAfter`; `PURGE_STARTED` copy |
| FR-2.5 purged list | DONE | Stores › "Deleted and purged stores": deleted in grace (`platformTenants(filter: {status: [DELETED]})`, opens the store page) and purged (`platformPurgedTenants`), 50 a page with Load more |
| FR-3.1 exports, §5.1 data-request stats | GATED | not in the schema (D2 legal gate); no UI |
| FR-4.1–4.3 go live | DONE | Go live section (`StoreGoLiveCard`): status chip, verify a domain (local shape check, then `INVALID_DOMAIN` / `RESERVED_DOMAIN` / `DOMAIN_TAKEN` on the field), the TXT record with copy buttons, Check now with its last error, the checklist with icons and text, Run again, Mark live with waivers (`payment_app`, `legal_pages`) and a required reason; `CHECKLIST_FAILED` names the failing checks |
| FR-4.4 domain change | DONE | `updateTenant` never sends `domain` (`ClientsProvider` and the store details form); the domain is read-only with a link to Go live; a serving domain stays while a new one verifies (copy says so) |

Files: `src/graphql/tenants.ts`, `src/graphql/billing.ts`, `src/types/platform-api.ts`, `src/types/index.ts`, `src/lib/api-adapters.ts`, `src/lib/tenant-lifecycle.util.ts` (+ test), `src/lib/storeStatus.ts` (Deleted badge), `src/lib/apollo-client.ts` (`OWNER_ONLY`, `platformPurgedTenants` paging, `TenantPurgeRecord` key), `src/providers/ClientsProvider.tsx`, `src/components/clients/{StoreLifecycleCard,MoneyInFlightPanel,StoreGoLiveCard,RemovedStoresPanel,storeActions,ClientsTable,ClientsPageContent}.tsx` (`ClientDangerZone.tsx` removed), `src/components/payments/StalePendingPayments.tsx`, `src/pages/{ClientDetail,Billing}.tsx`, `src/config/navigation.ts`, `src/copy.ts`.
