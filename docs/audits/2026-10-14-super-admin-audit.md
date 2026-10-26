# zcom-super-admin audit (2026-10-14)

| | |
|---|---|
| **Scope** | Platform console (Vite 8, React 19, TS strict; mock data, fake sign-in; Vercel) |
| **Method** | Read-only code audit plus the machine-checked GraphQL contract. **[C]** confirmed in code, **[I]** inferred |
| **Cross-repo summary** | `../zcom-backend/docs/audits/2026-10-14-platform-audit.md` (top 15, remediation plan) |
| **Status** | **Remediated by PRD-002 WS-G (2026-10-14)**, pending re-audit. Open: owner actions (Vercel protection, confirm the SA-7 tier mapping) and npm audit findings (2026-10-25: `npm audit fix` applied; the vitest-chain ones need vitest 5) |

## Findings

| ID | Sev | Finding | Evidence | Fix |
|---|---|---|---|---|
| SA-1 | Medium | Fake sign-in (any non-blank credentials) on a public Vercel URL that search engines can index; data is mock-only | `src/providers/AuthProvider.tsx:28-29`; `vercel.json` | Vercel password or SSO protection; `noindex` header |
| SA-2 | Medium | An overdue store inside its grace period shows **Healthy** (no branch for `-grace ≤ daysUntilRenewal < 0` with an amount due), contradicting the overdue drill-down | `src/lib/subscriptionHealth.ts:93-136` | Add an "at-risk: overdue in grace" bucket plus a test |
| SA-3 | Medium | The previous-month snapshot uses **current** subscription state for pending and expected amounts, so month-over-month collected % is misleading | `src/lib/subscriptionReports.ts:268-285` | Compute from that month's rows |
| SA-4 | Low–Medium | `activeMrr` includes trial clients while `payingStores` excludes them; "MRR" trend is a 3-month average of bookings over the **filtered** range | `src/lib/revenueReports.ts:156-158` | Define MRR once; compute over full history |
| SA-5 | Low | Date maths: `Math.floor` vs `Math.round` across DST; local month bounds vs UTC transactions; `new Map(subscriptions…)` keeps only the last subscription per client | `src/lib/*` | UTC everywhere; handle multiple subscriptions |
| SA-6 | Low | CSV formula injection; object URL revoked immediately after `click()` | `rowsToCsv`, `downloadCsv` | Prefix risky cells; revoke after a tick |
| SA-7 | Low | Vocabulary differs from the backend: plans `Free/Starter/Pro/Enterprise` vs `STARTER/PREMIUM/PLUS/ENTERPRISE`; statuses differ; gateways `Stripe/Razorpay` vs backend `NIMBBL/RAZORPAY/STRIPE/MANUAL` | `src/types/index.ts`; backend `plan.model.ts:45`, `subscription.model.ts:37`, `billing.model.ts:50` | Settle in the super-admin integration PRD |
| SA-8 | Info | Typecheck and tests couldn't run: `node_modules` is not installed in this checkout. `vitest ^3` may not accept `vite ^8` as a peer [I] | — | `npm ci` then `npm run build && npm test` |

## Status (2026-10-14, PRD-002 WS-G)

| ID | Status |
|---|---|
| SA-1 | **Fixed in code** (`X-Robots-Tag`, robots meta, `robots.txt`). Owner action: Vercel password or SSO protection |
| SA-2 | **Fixed**: `isOverdueInGrace` / "At risk · in grace" bucket and drill-down, with tests |
| SA-3 | **Fixed**: month snapshot from that month's rows as of month end, with tests |
| SA-4 | **Fixed**: one MRR definition (ACTIVE, mrr>0, started, latest per client, trials excluded); trend over full history then sliced; MRR on its own axis |
| SA-5 | **Fixed**: UTC date maths, one rounding rule, `latestSubscriptionByClient` |
| SA-6 | **Fixed**: `escapeCsvCell`; URL revoke delayed (1 s) |
| SA-7 | **Fixed**: backend enums plus friendly labels. Owner to confirm the tier mapping (Free→STARTER ₹0, Starter→PREMIUM, Pro→PLUS, Enterprise→ENTERPRISE) and PENDING→ACTIVE with an amount due |
| SA-8 | **Resolved**: `npm ci` works and vitest 3.2.7 runs with vite 8. Note: the lockfile has 4 audit vulnerabilities (2 critical), to be looked at in the re-audit |

Prior issues (mock data, fake auth, unused `ActivityFeed`/`ClientsFilters`/mock exports, vocabulary mismatch): **still present**.
