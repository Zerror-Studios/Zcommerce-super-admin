# PRD-007 — Store admin login on shared platform hosts (pointer: zcom-super-admin)

| Field | Value |
|---|---|
| Status | **Approved** 2026-10-18 (mirrors the source of truth) |
| Source-of-truth PRD | `../../../zcom-backend/docs/prd/PRD-007-shared-host-admin-login.md` |
| Created / Updated | 2026-10-18 / 2026-10-18 |
| Related | `../../../zcom-backend/docs/adr/ADR-003-platform-host-topology.md` |

Requirements, decisions (Q1–Q9) and the contract live in the source-of-truth PRD. This file lists only **this repo's** share.

## This repo's share

- ADR-003 / FR-7: the console moves to `platform.zcommerce.com`, `VITE_GATEWAY_URL=https://api.zcommerce.com/v1/graphql`.
- FR-6.1: "Log in to store" opens `https://admin.zcommerce.com/store/{slug}` (the backend builds the URL from `PLATFORM_TENANT_ADMIN_URL_TEMPLATE`); no console code change expected beyond verification.

## Implementation log

- 2026-10-18: drafted; nothing implemented.
- 2026-10-18: approved. No console code change: the backend now builds the "Log in to store" link as `https://admin.zcommerce.com/store/<slug>/#impersonation=<grant>` and `isSafeAdminUrl` (https) accepts it. Production env: `VITE_GATEWAY_URL=https://api.zcommerce.com/v1/graphql` (README); the backend lists `https://platform.zcommerce.com` in `CORS_ORIGINS`.
