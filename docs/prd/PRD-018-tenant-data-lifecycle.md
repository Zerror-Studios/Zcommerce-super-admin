# PRD-018 — Tenant data lifecycle (pointer: zcom-super-admin)

| Field | Value |
|---|---|
| Status | **Approved** 2026-10-26 (mirrors the source of truth; owner: "please review and approve the six drafted follow-up PRDs", every recommendation accepted, D1–D19; D5 restricted admin mode an explicit tenant-boundary yes; the legal assumptions L1–L12 and D2, D4, D11, D14, D16, D18, D19 gated on the owner's lawyer, CA for L2). Not started |
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
- Every destructive action has a confirmation and shows the server answer before any toast; errors map `extensions.reason` (`MONEY_IN_FLIGHT` with counts, `PURGE_STARTED`, `DOMAIN_TAKEN`, `CHECKLIST_FAILED`, `INVALID_DOMAIN`, `RESERVED_DOMAIN`).
- Impersonating a `POLICY`-suspended store (to settle orders) uses the existing "Log in to store"; the store opens in restricted mode.
- Rollout follows the backend phases A–E (§9); phase D waits for the lawyer.

## Implementation log

- 2026-10-26 · Pointer created on approval. Not started.
