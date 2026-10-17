# PRD-002 — Platform audit remediation (pointer: zcom-super-admin)

| Field | Value |
|---|---|
| Status | **Approved** 2026-10-14 (mirrors the source of truth); round 1 (WS-G) done in the working tree; round 2 needed no change here (integration check only); round 3 (verification findings) needed no change here either (no V-finding touched this repo) |
| Source-of-truth PRD | `../../../zcom-backend/docs/prd/PRD-002-audit-remediation.md` |
| Repos affected | zcom-super-admin (this repo), zcom-backend, zcom-frontend, storefronts/rare-element, storefronts/deveshe-dreams |
| Created / Updated | 2026-10-14 / 2026-10-14 |

All requirements, decisions, the rollout order and the full implementation log live in the source-of-truth PRD. This file only lists **this repo's** share of the work. Findings and statuses: [`../audits/2026-10-14-super-admin-audit.md`](../audits/2026-10-14-super-admin-audit.md).

## This repo's requirements

| Ref | Work in zcom-super-admin | Files |
|---|---|---|
| SA-1 (code side) | `X-Robots-Tag: noindex` header, robots meta, `robots.txt`. Real access control is Vercel protection (owner) | `vercel.json`, `index.html`, `public/robots.txt` |
| SA-2 | "At risk · in grace" bucket for overdue stores inside their grace period, with drill-down and tests | `src/lib/subscriptionHealth.ts` |
| SA-3 | Previous-month snapshot computed from that month's rows | `src/lib/subscriptionReports.ts` |
| SA-4 | One MRR definition (ACTIVE, mrr > 0, started, latest per client, trials excluded); trend over full history | `src/lib/revenueReports.ts` |
| SA-5 | UTC date maths, one rounding rule, latest subscription per client | `src/lib/*` |
| SA-6 | CSV formula escaping; object URL revoked after a delay | `rowsToCsv`, `downloadCsv` |
| SA-7 | Backend plan, status and gateway enums with display labels | `src/types/index.ts` |
| SA-8 | `npm ci`, build and vitest verified | — |

## Verification
- Round 1 (WS-G): build OK; vitest 45/45 (was 13); lint unchanged (0 errors, 10 warnings).
- Round 2 integration check (2026-10-14): build OK; vitest 45/45. No round 2 finding touched this repo.

## Owner actions
1. Turn on Vercel password or SSO protection (PRD-002 §7.6; SA-1).
2. Confirm the SA-7 tier mapping (Free→STARTER ₹0, Starter→PREMIUM, Pro→PLUS, Enterprise→ENTERPRISE) and the PENDING→ACTIVE-with-amount-due convention.

## Open (this repo)
- 4 npm audit findings in the lockfile (2 critical), not yet triaged.
- The console still runs on mock data (`src/lib/mockData.ts`); connecting it to a platform API is a separate T1 PRD.

## Implementation log
- 2026-10-14: WS-G done (SA-1 to SA-7 fixed, SA-8 resolved, dead code removed). See the source-of-truth PRD §8, "WS-G".
- 2026-10-14: round 2 integration check passed for this repo (build, 45/45 tests); pointer PRD added in the round 2 docs pass.
