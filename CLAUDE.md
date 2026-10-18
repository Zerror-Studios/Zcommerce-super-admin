# CLAUDE.md — zcom-super-admin

These are the engineering rules for Claude Code and developers in this repo. The file reflects the code as of **2026-10-17**, after the design-system restyle (`restyle/design-system`, merged 2026-10-16) was rebased together with the PRD-002 audit remediation. When the code and this file disagree, check the code and then update this file.

**Precedence.** System and platform instructions come first, then the workspace root `../CLAUDE.md`, then this file, then any deeper `CLAUDE.md`, then user requests that don't conflict with those. If something is unclear, ask one focused question (§0.3).

**Architecture.** Read `docs/architecture/solution-architecture.md` for the diagrams and design of this repo. The platform-wide view is in `../ARCHITECTURE.md`, when the workspace root is present.

## 0. Workspace rules (shared by every Zcom repo)

This repo is one part of the Zcom platform. The full map is in the workspace root `../CLAUDE.md` (`../../CLAUDE.md` for storefronts), when that file is present. The rules below are mandatory here even when it isn't.

1. **PRD first (tiered).**
   - **T1** covers: a new feature, page or module; a GraphQL contract change; a model or event change; auth, tenant, permission or billing logic; a new integration. T1 needs a PRD in `docs/prd/` with **Status: Approved** before any code. If none exists, draft one from `docs/prd/_TEMPLATE.md` (Status *Draft*) and **stop for approval**.
   - **T2** covers bug fixes, tweaks and small refactors. T2 needs only a line in `docs/changelog/YYYY-MM.md`.
   - Unsure of the tier? Treat it as T1 and ask.
   - Cross-repo PRDs have their source of truth in `zcom-backend/docs/prd/`; consumer repos keep a pointer PRD.
2. **Read docs before, update docs after (MANDATORY, no exceptions).** Documentation is part of the definition of done. Every change, including code, config, infra, dependencies and decisions, updates all related docs in the same change. Record decisions and approvals from conversation in the PRD or ADR immediately, before implementing. A task isn't finished while any doc disagrees with the code.
   - **Before** a change, read this file, `README.md`, `docs/README.md`, and the relevant PRD, ADR and architecture docs.
   - **After** it, in the same change, update whatever is now stale: the README (setup, commands, env names), `docs/architecture/*` (contracts), PRD status and implementation log, the changelog, `docs/README.md` (the index), and this `CLAUDE.md` (rules and known issues).
   - End every task with a **"Docs impact"** line.
3. **Ask, don't guess.**
   - Ask one precise question, with options and a recommendation, when the request conflicts with a PRD, an ADR, this file, or the code.
   - Do the same when docs and code disagree, or when a change would affect a contract, a security or tenant boundary, the design system, dependencies or deployment.
   - Don't ask about things you can verify in the code yourself.
4. **Scoped and safe.**
   - No drive-by refactors or mass reformatting.
   - Don't add dependencies without asking.
   - Never commit, push, deploy or touch databases unless asked.
   - Never print or commit secrets or `.env` values, including the token embedded in `git remote -v`.
   - Report checks honestly, keeping pre-existing failures separate from new ones.
5. **Coding style: the owner's signature (mandatory).** Follow the workspace `CODING_STYLE.md` (`../CODING_STYLE.md`, or `../../CODING_STYLE.md` for storefronts). Its baseline is the `zcom-backend` style.
   - 2 spaces, double quotes, semicolons, trailing commas, 80 columns.
   - Named exports with barrel `index.ts` files (React page and component files are the exception: `export default X;` at the end).
   - File names are `kebab-case.role.ts`.
   - Static-class controllers and services, with `return await`.
   - `xEnum = {…} as const`; the `I` prefix only for Mongoose documents; `UPPER_SNAKE` constants with unit suffixes (`_MS`, `_DAYS`).
   - `GraphQLError` with `extensions.code`; one `createLogger({ service })` per module.
   - JSDoc module headers and `// ─── ` section dividers.

   **New files** follow it exactly. **Edits** keep the file's existing formatting; never reformat untouched code. When you commit, use Conventional Commits: `type(scope): summary (PRD-NNN)`.

## 1. What this is

The **Zerror Studios platform console** for Zcom. The Zerror team uses it to manage *client stores* (tenants), their plans and subscriptions, platform billing and revenue reporting, coupons, and renewal automation. Tenant store staff use `../zcom-frontend`; this app is not for them.

**Status: API-only since 2026-10-17 (PRD-005 Phases 0–4; mock mode removed, §8 Q14).**
- The **one Apollo client** (`src/lib/apollo-client.ts`) talks to the backend `platform-admin` subgraph (`../zcom-backend/services/platform-admin`, port 4014) through the gateway. Sign-in is real: a platform account (ADR-001 principal, roles `PLATFORM_OWNER … READ_ONLY`), optional TOTP, access token **in memory only** (`lib/session-store.ts`), refresh token in an HttpOnly cookie, session restored on load. Stores, plans and subscriptions come from `platformTenants` / `platformPlans` through `ClientsProvider` and `lib/api-adapters.ts`. Since Phase 2 the store lifecycle is real too: Add store provisions a tenant (`createStore`, one-time owner password dialog), the store page suspends / reactivates / deletes (reason, slug confirmation), edits notes and the grace override, and runs the subscription actions; `/settings/billing-rules` edits the platform settings on the server (`SettingsProvider`, `usePlatformSettings`; `loadPlatformSettings()` reads the server copy), including the **platform payment provider** (PRD-006: Manual / Razorpay / Nimbbl; secrets stay in the backend env). The health score and payment badge come from the server (`client.health`, `subscription.paymentState`; the libs prefer them). Since Phase 3 the money is the server's too: Home KPIs, Platform revenue, Collections, Transactions, Discounts and Reminders read `platformRevenueOverview`, `platformCollections`, `platformPayments`, `platformCoupons` and the reminder operations through `src/hooks/use-platform-reports.ts` (`isApi ? api : lib` inside each screen). Notifications are still mock. Since Phase 4 "Log in to store" is real too (`impersonateTenant` via `components/clients/storeLogin.ts`, one click, no dialog; FR-10.3), and `/settings/team` and `/settings/audit` read `platformUsers` and `platformAuditLog` (`src/graphql/team.ts`).
- There is no mock data and no fake sign-in any more; every screen needs the gateway (`npm run dev` proxies `/v1/graphql` to `API_GATEWAY_URL`) and a platform user. Notifications have no feed yet (empty state).
- Operations live in `src/graphql/<domain>.ts`; shapes in `src/types/platform-api.ts` (hand-written until codegen lands). Confirm a root field exists in the backend schema before using it (root `CLAUDE.md` §5).

**Stack (from `package.json`):**
- Vite 8, React 19.2 and TypeScript ~6, with **`strict: true`**, `noUnusedLocals/Parameters` and `verbatimModuleSyntax`.
- react-router-dom 7, used with declarative `<Routes>`.
- HeroUI 2.8, with Tailwind CSS **v4** via `@tailwindcss/vite`, themed through the design tokens in `src/styles/tokens.css` (§5).
- recharts, react-date-range and date-fns 3.
- qrcode (two-step enrolment QR, `components/auth/TotpQrCode.tsx`; added 2026-10-18 at the owner's request).
- Icons: Lucide glyphs from `react-icons/lu`, registered once in `src/components/ui/icons.ts` (lucide-react is no longer a dependency).
- vitest for tests, oxlint for linting.

**Present since PRD-005:** `@apollo/client` 3 and `graphql`. **Not present:** zustand or any other state library, React Query, and component tests.

## 2. Directory map

```
hero.ts                 HeroUI Tailwind plugin config, loaded from index.css via @plugin (colours from src/theme/heroui-theme.js)
src/main.tsx            StrictMode > BrowserRouter > AppProviders > App
src/App.tsx             route table (<Routes>), inline GuestOnly wrapper for /sign-in, legacy /clients → /stores redirects
src/config/navigation.ts  sidebar and command-palette entries (one list for both)
src/config/data-source.ts  the gateway URL (VITE_GATEWAY_URL)
src/graphql/            GraphQL operations per domain: auth, tenants, plans, subscriptions (PRD-005)
src/copy.ts             repeated user-facing strings: empty states, toasts, confirmations
src/providers/          AppProviders (HeroUIProvider > ToastProvider > ApolloProvider > AuthProvider > SettingsProvider > ClientsProvider), AuthProvider, SettingsProvider, ClientsProvider
src/pages/              Home, Clients, ClientDetail, AddClient, Billing, Analytics, Settings, SignIn, SetPassword, Mfa, NotFound
src/components/
  ui/                   the shared UI kit (docs/design/02-components.md): Button, Card, StatCard, KpiStrip, StatusChip, Chip,
                        Modal, Select, Input, Tabs, EmptyState, ErrorState, HealthScore, Ai (brief/insight), toast helpers,
                        money.ts / format-date.ts formatters, status-map.ts (SYNCED with the merchant admin), chart-theme.ts,
                        icons.ts, tones.ts, DevUiPage (/dev/ui showcase)
  layout/               AppShell, DashboardLayout, Sidebar, PageHeader, CommandPalette, NotificationsPanel, Assistant, AuthLayout
  auth/RequireAuth.tsx  redirect to /sign-in when unauthenticated, else <Outlet/>
  common/               PageHeader, ConfirmModal, StatusChip (kind → shared domain), RenewalBadge, StoreHealthCell, TableToolbar,
                        NoDataPlaceholder, DateRangeComparison, + style kits: modalStyles.ts, dataTableStyles.ts
  clients/ billing/ dashboard/ payments/ settings/ analytics/   domain components
src/lib/                apollo-client.ts (the one API client), session-store.ts (token in memory), auth-channel.ts (cross-tab),
                        api-adapters.ts (API rows → Client/Subscription/Plan), api-report-adapters.ts (rollups → types/reports), display-labels.util.ts (enum → label),
                        subscription-lookup.util.ts (latestSubscriptionByClient),
                        periods.ts (picker periods), store-sales.ts, report-csv.ts, storeStatus.ts (server payment badge),
                        storeHealth.ts (server score → band), aiSamples.ts (AI sample copy),
                        pure domain logic (subscriptionHealth, subscriptionReports, revenueReports, storeHealth, platformSettings,
                        tableSelection, utils) + *.test.ts
src/styles/             tokens.css (design tokens, Geist), theme.css (base styles), inputStyle.ts (legacy input classNames)
src/types/index.ts      all entity types and enums (planNameEnum, subscriptionStatusEnum, paymentGatewayEnum, Client, Subscription, …)
src/types/platform-api.ts  platform-admin API shapes (PlatformUser, PlatformTenant, PlatformSubscription, PlatformPlan)
docs/design/            the approved design spec (README, foundations, components, super-admin screens, wording, QA checklist)
```

## 3. Routing

- Routes live in `src/App.tsx`, using `<Routes>`/`<Route>`. **Don't switch to `createBrowserRouter`** without an ADR. (The admin frontend uses the data router, but this app deliberately doesn't today.)
- Authenticated pages sit inside `<RequireAuth>` → `DashboardLayout`; both it and `GuestOnly` show `SessionLoading` while the session is restored. Public: `/sign-in` (`GuestOnly`) and `/set-password?token=` (invite and reset links, PRD-005 FR-1.5). `/mfa` (authenticated) enrols TOTP; sign-in sends manage roles there until they have.
- **Stores.** Visible text says "store/stores" and the routes are `/stores`, `/stores/new`, `/stores/:id`. The old `/clients…` URLs redirect. Code identifiers (`Client`, `ClientsProvider`, `pages/Clients.tsx`) are unchanged.
- **Section pages:** `/billing/:section` (`subscriptions`, `transactions`, `reminders`), `/analytics/:section` (`revenue`, `store-sales`) and `/settings/:section` (`discounts`, `billing-rules`, `team`, `audit`) validate `:section` against a local `sections` const and redirect on bad values. The bare paths redirect to their default section; `/settings` itself is a card grid. To add a tab, extend that const and `src/config/navigation.ts` together.
- `/dev/ui` is the kit showcase. `*` renders `NotFound`. `vercel.json` rewrites all paths to `index.html`, so the app is a SPA on Vercel.

## 4. Data and state

- **Vocabulary mirrors the backend (PRD-002 SA-7).** Plans are `STARTER | PREMIUM | PLUS | ENTERPRISE`, subscription statuses `ACTIVE | TRIAL | PAST_DUE | CANCELLED | SUSPENDED`, gateways `NIMBBL | RAZORPAY | STRIPE | MANUAL`, as `xEnum` consts in `types/index.ts`. The UI never renders those raw values: go through `src/lib/display-labels.util.ts` (`getPlanLabel`, `getSubscriptionStatusLabel`, `getPaymentGatewayLabel`, `PLAN_NAMES`, `PLAN_LABELS`). There is no PENDING subscription status: an `ACTIVE` subscription with `amountDue > 0` is "payment due".
- **Dates and MRR (PRD-002 SA-5).** Use the UTC helpers in `lib/utils.ts` (`daysBetween`, `daysUntil`, `calendarDayStartUtc`, `calendarMonthBoundsUtc`, …) with one rounding rule. A month or range picked in the UI is read from its local calendar fields and mapped to the same UTC day. MRR is the sum of `Subscription.mrr` for ACTIVE subscriptions with mrr > 0 (latest per client, trials excluded). Use `latestSubscriptionByClient`, never `new Map(subs…)`.
- **Platform numbers and store status (one source each).**
  - Money metrics (Monthly billing, Earned this month/year, Projected, Outstanding, collection rate) come only from the server rollups `platformRevenueOverview` and `platformCollections` through `src/hooks/use-platform-reports.ts`. Home, Billing › Collections and Analytics › Platform revenue read the same hooks so they always agree; never add money maths in the browser (root `CLAUDE.md` §4).
  - Store lifecycle and payment badges come only from `src/lib/storeStatus.ts` (`storeLifecycle`, `paymentState` shows the server's `subscription.paymentState`, `graceDaysFor`); the health score is the server's `client.health` through `lib/storeHealth.ts`, bands from the kit's `getHealthBand` (Healthy / At risk / Critical).
  - Collections reports take an inclusive `rangeStart`/`rangeEnd` (preferred) or a `month`; `lib/subscriptionReports.ts` resolves both to UTC bounds and judges each period from its own rows (PRD-002 SA-3), with the previous calendar month as the comparison for a whole month.
- **Pure logic belongs in `src/lib/*.ts`**, typed, with no React, and with a `*.test.ts` beside it. Pages and components call these helpers. Keep this split: it is what makes the reports testable.
- **No mock data.** Screens read the API through `useClients()`, `usePlatformSettings()` and the hooks in `src/hooks/use-platform-reports.ts`; never add fixture data to `src/lib`. Report row shapes live in `src/types/reports.ts`; the only client-side report logic left is `lib/store-sales.ts` (usage snapshot → store sales) and `lib/report-csv.ts`.
- **State.**
  - Use React context providers for cross-page state (`ClientsProvider`), and local `useState` for page state (coupons in `Settings.tsx`).
  - Don't add zustand, Redux or React Query without an ADR. Adopting one belongs in the "connect to backend" PRD.
- **localStorage keys:**
  - `zcommerce-admin-auth`: fake auth;
  - `zcommerce-sidebar-collapsed`;
  - `zcommerce-platform-settings`: `lib/platformSettings.ts`;
  - `zcommerce-theme`: reserved for the kit's theme preference; cleared on mount while dark mode is off;
  - `zcommerce-session-end` (sessionStorage): why the last session ended, shown once on `/sign-in`.

  Prefix new keys with `zcommerce-`, and never store tokens or real customer data there.
- **"Log in" to a store:** every button calls `logInToStore()` in `src/components/clients/storeLogin.ts`: no dialog and no reason (owner, 2026-10-18). It opens a tab on the click, calls `impersonateTenant`, and points the tab at the store admin with the two-minute single-use grant in the fragment; the store exchanges it for a normal session (PRD-005 FR-10.3). Without an admin address it copies the link instead. Needs the caller to have two-step on (`MFA_REQUIRED` toast otherwise).
- **AI features** are always on (owner decision 2026-10-17; the `ai` flag, `VITE_FEATURE_AI` and the `/dev/ui` switch were removed — `useAiEnabled()` returns true). Today's brief (Home), the store insight (store detail) and the assistant (Ask bar at the bottom, ⌘J, "Ask AI" in ⌘K, wired in `DashboardLayout.tsx`, owner request 2026-10-17) are written by `src/lib/aiSamples.ts` from server data only: the payment badge and health score on each store (lib/storeStatus, lib/storeHealth), and for money questions `platformRevenueOverview`, fetched when asked. Replace with real calls when an assistant backend exists.
- **API layer (PRD-005).** One Apollo client in `src/lib/apollo-client.ts` (never ad-hoc `fetch`), operations in `src/graphql/<domain>.ts` (validate with `npm run validate:ops`), server data in the Apollo cache, React context only for session and UI state. **Permissions:** `src/lib/permissions.ts` mirrors `packages/core/src/rbac/platform-permissions.ts` (keep them identical); hide or disable what the role lacks, the backend still enforces it. `MFA_REQUIRED` from any mutation routes to `/mfa`. Searches that hit a server rollup go through `useDebouncedValue`. After a mutation that returns the tenant, do not refetch the list (only create, retry and delete do). Branch on `extensions.code` (`UNAUTHENTICATED`, `TOKEN_EXPIRED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_USER_INPUT`, `CONFLICT`, `MFA_REQUIRED`, `ACCOUNT_DISABLED`), never on message text. Tokens never touch `localStorage`. New screens read through `useClients()` or their own `useQuery`; money and totals must come from the server once the Phase 3 rollups exist (root `CLAUDE.md` §4).

## 5. UI and design system

**All UI work follows `docs/design/README.md` and the files it lists.** Decisions (2026-10-15, owner): `docs/design/` is the approved spec for the restyle; no separate PRD is needed. The typeface is **Geist** per `docs/design/01-foundations.md` (self-hosted through `src/styles/tokens.css`; no Google Fonts link).

- **Components.** Use the kit in `src/components/ui/` first (`Button`, `Card`, `StatCard`, `KpiStrip`, `StatusChip`, `Chip`, `Modal`, `Select`, `Input`, `Tabs`, `EmptyState`, `ErrorState`, …), then HeroUI directly only for what the kit doesn't wrap (tables). The older `components/common/` kits (`modalStyles.ts`, `dataTableStyles.ts`, `TableToolbar`, `ConfirmModal`, `NoDataPlaceholder`) are still used by tables and modals; `common/StatusChip` maps the old `kind` prop onto the shared status domains.
- **Tokens, not hexes.** Use tokens from `src/styles/tokens.css` (`docs/design/tokens.css` is the spec copy); never hard-code colours, sizes or radii. `npm run lint:hex` flags new hex values. Tailwind v4 is configured in CSS (`@theme`, `@plugin`, `@source`), not in a `tailwind.config.js`. Don't create one.
- **Statuses.** `src/components/ui/status-map.ts` is a **SYNCED file**, kept byte-identical with the merchant admin's copy. Entries marked `// added` were added from real data and must be reported when the two copies are next synced (this repo added `trial` and `suspended` to the `plan` domain for the backend `TRIAL`/`SUSPENDED` statuses on 2026-10-17).
- **Wording and dates.** Repeated strings live in `src/copy.ts`; error toasts use the kit's `toastError()` (stays until closed). Dates via the kit's `formatDate`/`formatDateTime`/`formatRange` (`lib/utils.ts` delegates to them); wording rules in `docs/design/05-wording.md`. Money via `formatMoney`/`formatCount`.
- **Charts** use recharts only, through `src/components/ui/chart-theme.ts` (plan colours are keyed by the backend plan enum).
- **Icons** come from `src/components/ui/icons.ts` (a SYNCED file: Lucide glyphs via `react-icons/lu`, one glyph per meaning). Never import `react-icons` or `lucide-react` directly.
- **Dark mode is off.** `AppProviders` removes the `dark` class and clears `zcommerce-theme` on mount. Keep new styles on tokens anyway, so a later toggle needs no rework.
- Cover the loading, empty and error states. Give icon-only buttons an `aria-label`.

## 6. Commands

| Task | Command | Notes |
|---|---|---|
| Install | `npm ci` | package-lock.json |
| Dev | `npm run dev` | Vite |
| Build | `npm run build` | `tsc -b && vite build`, so it **typechecks** (strict) |
| Lint | `npm run lint` | oxlint (`react/rules-of-hooks` error, `only-export-components` warn) |
| Hex check | `npm run lint:hex` | flags hard-coded colours |
| Test | `npm test` / `npm run test:watch` | vitest, node environment, `src/**/*.test.ts` (lib logic only, 59 tests) |
| Contract check | `npm run validate:ops` | validates every `src/graphql` operation against `../zcom-backend/services/platform-admin/src/graphql/schemas/index.ts` (`PLATFORM_SCHEMA` overrides the path) and checks its depth against the gateway's GraphQL Armor limit of 10 (fragments flattened) |
| Preview | `npm run preview` | |

Deployment is on Vercel (`vercel.json` SPA rewrite). Never trigger a deploy unless asked.

## 7. Implementing a change

1. Check the tier (§0). For T1, find or draft the PRD. Anything touching real data or auth is T1 and cross-repo.
2. Add or extend types in `types/index.ts` and `types/platform-api.ts`, the operation in `src/graphql/<domain>.ts` (run `npm run validate:ops`), the adapter in `lib/api-adapters.ts` or `lib/api-report-adapters.ts`, then pure logic in `lib/` with tests.
3. Build the UI from the `components/ui` kit (§5). Add the route in `App.tsx` and the entry in `src/config/navigation.ts`.
4. Run `npm run build` (typecheck + build), `npm run lint` and `npm test`.
5. Update the docs (§0.2).

## 8. Known issues (don't fix unless asked)

- The console is API-only (PRD-005 Phases 0–4; mock mode removed 2026-10-17, Q14) but has not run against a live gateway in a browser yet. The store owner's first password is shown once in the console (no admin set-password flow yet, PRD-005 Q13). Notifications have no feed (empty panel). The 2026-10-17 review findings are fixed except **Q6**: on Vercel `/v1/graphql` needs a rewrite to the gateway or the console must sit behind the CloudFront edge, or sessions cannot be kept (`../zcom-backend/docs/reviews/2026-10-17-platform-admin-integration-review.md` C-H3).
- `RevenueReportsTab` is used by Analytics but lives in `components/billing/`; `TopClientsTable` is a legacy name that renders the stores table.
- `lib/periods.ts` (`monthPeriod`, `yearPeriod`) uses local calendar fields for the pickers; the server resolves the picked days to UTC bounds (PRD-002 SA-5).
- oxlint reports pre-existing `set-state-in-effect` and `only-export-components` warnings (no errors).
- **Audit 2026-10-14:** see `docs/audits/2026-10-14-super-admin-audit.md`. SA-1 to SA-7 were fixed by PRD-002 WS-G. Still open: Vercel password/SSO protection (owner; the code only adds `noindex`), confirming the SA-7 tier mapping and the PENDING→ACTIVE convention, and 4 npm audit findings in the lockfile. The platform billing provider still needs an ADR.

## 9. Before you finish a change

- [ ] I read this file, `README.md`, `docs/README.md`, `docs/design/README.md` and the relevant PRD.
- [ ] Logic is in `src/lib` with tests, types live in `types/index.ts`, and the UI uses the `components/ui` kit and tokens.
- [ ] Raw enum values (plans, statuses, gateways) never reach the screen; they go through `display-labels.util.ts`.
- [ ] I didn't add an API client, state library, icon library or dependency without approval.
- [ ] `npm run build`, `npm run lint` and `npm test` pass, or I reported the failures.
- [ ] Docs are updated, with a "Docs impact" line.
