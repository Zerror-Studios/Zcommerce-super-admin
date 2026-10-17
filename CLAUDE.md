# CLAUDE.md — zcom-super-admin

These are the engineering rules for Claude Code and developers in this repo. The file reflects the code as of **2026-10-17**, after the design-system restyle (`restyle/design-system`, merged 2026-10-16) was rebased together with the PRD-002 audit remediation. When the code and this file disagree, check the code and then update this file.

**Precedence.** System and platform instructions come first, then the workspace root `../CLAUDE.md`, then this file, then any deeper `CLAUDE.md`, then user requests that don't conflict with those. If something is unclear, ask one focused question (§0.3).

**Architecture.** Read `docs/architecture/solution-architecture.md` for the diagrams and design of this repo. The platform-wide view is in `../ARCHITECTURE.md`, when the workspace root is present.

## 0. Workspace rules (shared by every ZCommerce repo)

This repo is one part of the ZCommerce platform. The full map is in the workspace root `../CLAUDE.md` (`../../CLAUDE.md` for storefronts), when that file is present. The rules below are mandatory here even when it isn't.

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

The **Zerror Studios platform console** for ZCommerce. The Zerror team uses it to manage *client stores* (tenants), their plans and subscriptions, platform billing and revenue reporting, coupons, and renewal automation. Tenant store staff use `../zcom-frontend`; this app is not for them.

**Status: UI prototype on mock data.**
- There are **no API calls**: no fetch, axios, Apollo, or `import.meta.env` (the only `import.meta.env` read is the `VITE_FEATURE_AI` flag, §5).
- All data comes from `src/lib/mockData.ts`, or from in-memory React state seeded from it.
- Sign-in is fake. Any non-blank email and password works, and auth is a boolean in `localStorage`.
- The backend has **no platform-level (cross-tenant) API yet**. `platform` subgraph operations are tenant-scoped (`mySubscription`, `activePlans`, …). `isSuperAdmin` in auth is a tenant-owner flag, not platform auth. Connecting this app is a **T1, cross-repo PRD**: it needs a backend design for platform auth, tenant listing, plans and coupons. Don't wire it up ad hoc.

**Stack (from `package.json`):**
- Vite 8, React 19.2 and TypeScript ~6, with **`strict: true`**, `noUnusedLocals/Parameters` and `verbatimModuleSyntax`.
- react-router-dom 7, used with declarative `<Routes>`.
- HeroUI 2.8, with Tailwind CSS **v4** via `@tailwindcss/vite`, themed through the design tokens in `src/styles/tokens.css` (§5).
- recharts, react-date-range and date-fns 3.
- Icons: Lucide glyphs from `react-icons/lu`, registered once in `src/components/ui/icons.ts` (lucide-react is no longer a dependency).
- vitest for tests, oxlint for linting.

**Not present:** Apollo, any API client, zustand or any other state library, React Query, and component tests.

## 2. Directory map

```
hero.ts                 HeroUI Tailwind plugin config, loaded from index.css via @plugin (colours from src/theme/heroui-theme.js)
src/main.tsx            StrictMode > BrowserRouter > AppProviders > App
src/App.tsx             route table (<Routes>), inline GuestOnly wrapper for /sign-in, legacy /clients → /stores redirects
src/config/navigation.ts  sidebar and command-palette entries (one list for both)
src/copy.ts             repeated user-facing strings: empty states, toasts, confirmations
src/providers/          AppProviders (HeroUIProvider > ToastProvider > AuthProvider > ClientsProvider), AuthProvider, ClientsProvider
src/pages/              Home, Clients, ClientDetail, AddClient, Billing, Analytics, Settings, SignIn, NotFound
src/components/
  ui/                   the shared UI kit (docs/design/02-components.md): Button, Card, StatCard, KpiStrip, StatusChip, Chip,
                        Modal, Select, Input, Tabs, EmptyState, ErrorState, HealthScore, Ai (brief/insight), toast helpers,
                        money.ts / format-date.ts formatters, status-map.ts (SYNCED with the merchant admin), chart-theme.ts,
                        icons.ts, tones.ts, DevUiPage (/dev/ui showcase and AI flag switch)
  layout/               AppShell, DashboardLayout, Sidebar, PageHeader, CommandPalette, NotificationsPanel, Assistant, AuthLayout
  auth/RequireAuth.tsx  redirect to /sign-in when unauthenticated, else <Outlet/>
  common/               PageHeader, ConfirmModal, StatusChip (kind → shared domain), RenewalBadge, StoreHealthCell, TableToolbar,
                        NoDataPlaceholder, DateRangeComparison, + style kits: modalStyles.ts, dataTableStyles.ts
  clients/ billing/ dashboard/ payments/ settings/ analytics/   domain components
src/lib/                mockData.ts, display-labels.util.ts (enum → label), subscription-lookup.util.ts (latestSubscriptionByClient),
                        metrics.ts (platform money), storeStatus.ts (lifecycle + payment badges), aiSamples.ts (AI sample copy),
                        pure domain logic (subscriptionHealth, subscriptionReports, revenueReports, storeHealth, platformSettings,
                        tableSelection, utils) + *.test.ts
src/styles/             tokens.css (design tokens, Geist), theme.css (base styles), inputStyle.ts (legacy input classNames)
src/types/index.ts      all entity types and enums (planNameEnum, subscriptionStatusEnum, paymentGatewayEnum, Client, Subscription, …)
docs/design/            the approved design spec (README, foundations, components, super-admin screens, wording, QA checklist)
```

## 3. Routing

- Routes live in `src/App.tsx`, using `<Routes>`/`<Route>`. **Don't switch to `createBrowserRouter`** without an ADR. (The admin frontend uses the data router, but this app deliberately doesn't today.)
- Authenticated pages sit inside `<RequireAuth>` → `DashboardLayout`. Only `/sign-in` is public, and it is wrapped in `GuestOnly`.
- **Stores.** Visible text says "store/stores" and the routes are `/stores`, `/stores/new`, `/stores/:id`. The old `/clients…` URLs redirect. Code identifiers (`Client`, `ClientsProvider`, `pages/Clients.tsx`) are unchanged.
- **Section pages:** `/billing/:section` (`subscriptions`, `transactions`, `reminders`), `/analytics/:section` (`revenue`, `store-sales`) and `/settings/:section` validate `:section` against a local `sections` const and redirect on bad values. The bare paths redirect to their default section; `/settings` itself is a card grid. To add a tab, extend that const and `src/config/navigation.ts` together.
- `/dev/ui` is the kit showcase (also toggles the AI flag). `*` renders `NotFound`. `vercel.json` rewrites all paths to `index.html`, so the app is a SPA on Vercel.

## 4. Data and state

- **Vocabulary mirrors the backend (PRD-002 SA-7).** Plans are `STARTER | PREMIUM | PLUS | ENTERPRISE`, subscription statuses `ACTIVE | TRIAL | PAST_DUE | CANCELLED | SUSPENDED`, gateways `NIMBBL | RAZORPAY | STRIPE | MANUAL`, as `xEnum` consts in `types/index.ts`. The UI never renders those raw values: go through `src/lib/display-labels.util.ts` (`getPlanLabel`, `getSubscriptionStatusLabel`, `getPaymentGatewayLabel`, `PLAN_NAMES`, `PLAN_LABELS`). There is no PENDING subscription status: an `ACTIVE` subscription with `amountDue > 0` is "payment due".
- **Dates and MRR (PRD-002 SA-5).** Use the UTC helpers in `lib/utils.ts` (`daysBetween`, `daysUntil`, `calendarDayStartUtc`, `calendarMonthBoundsUtc`, …) with one rounding rule. A month or range picked in the UI is read from its local calendar fields and mapped to the same UTC day. MRR is the sum of `Subscription.mrr` for ACTIVE subscriptions with mrr > 0 (latest per client, trials excluded). Use `latestSubscriptionByClient`, never `new Map(subs…)`.
- **Platform numbers and store status (one source each).**
  - Money metrics (Monthly billing, Earned this month/year, Projected, Outstanding, collection rate) come only from `src/lib/metrics.ts`. Home, Billing › Collections and Analytics › Platform revenue must use it so they always agree; "Outstanding" = the open invoice rows Collections lists.
  - Store lifecycle and payment badges come only from `src/lib/storeStatus.ts` (`storeLifecycle`, `paymentState`, `graceDaysFor`); health bands from the kit's `getHealthBand` (Healthy / At risk / Critical).
  - Collections reports take an inclusive `rangeStart`/`rangeEnd` (preferred) or a `month`; `lib/subscriptionReports.ts` resolves both to UTC bounds and judges each period from its own rows (PRD-002 SA-3), with the previous calendar month as the comparison for a whole month.
- **Pure logic belongs in `src/lib/*.ts`**, typed, with no React, and with a `*.test.ts` beside it. Pages and components call these helpers. Keep this split: it is what makes the reports testable.
- **Mock data.** Extend `mockData.ts` and `types/index.ts` together. Keep mock shapes **close to the expected backend shapes** (camelCase, ISO dates, `{items,totalCount}`-friendly lists), so that swapping in real data later is mechanical.
- **State.**
  - Use React context providers for cross-page state (`ClientsProvider`), and local `useState` for page state (coupons in `Settings.tsx`).
  - Don't add zustand, Redux or React Query without an ADR. Adopting one belongs in the "connect to backend" PRD.
- **localStorage keys:**
  - `zcommerce-admin-auth`: fake auth;
  - `zcommerce-sidebar-collapsed`;
  - `zcommerce-platform-settings`: `lib/platformSettings.ts`;
  - `zcommerce-theme`: reserved for the kit's theme preference; cleared on mount while dark mode is off.

  Prefix new keys with `zcommerce-`, and never store tokens or real customer data there.
- **"Log in" to a store** has no real mechanism yet: every button calls `logInToStore()` in `src/components/clients/storeLogin.ts`, which shows a toast. Implement impersonation there.
- **AI features** are behind the `ai` flag (`VITE_FEATURE_AI=true`, or the switch on `/dev/ui`), off by default. Today's brief (Home) and the store insight (store detail) are written by `src/lib/aiSamples.ts` from lib/metrics + lib/storeStatus data; replace with real calls when an assistant backend exists.
- **When the backend exists,** follow the admin frontend's pattern: one API client in `src/lib/`, operations in `src/graphql/<domain>.ts`, and server-computed money. Check the root `CLAUDE.md` §5 contract rules.

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
| Test | `npm test` / `npm run test:watch` | vitest, node environment, `src/**/*.test.ts` (lib logic only, 55 tests) |
| Preview | `npm run preview` | |

Deployment is on Vercel (`vercel.json` SPA rewrite). Never trigger a deploy unless asked.

## 7. Implementing a change

1. Check the tier (§0). For T1, find or draft the PRD. Anything touching real data or auth is T1 and cross-repo.
2. Add or extend types in `types/index.ts`, then the mock data, then pure logic in `lib/`, with tests.
3. Build the UI from the `components/ui` kit (§5). Add the route in `App.tsx` and the entry in `src/config/navigation.ts`.
4. Run `npm run build` (typecheck + build), `npm run lint` and `npm test`.
5. Update the docs (§0.2).

## 8. Known issues (don't fix unless asked)

- The app runs on mock data with fake sign-in, and has no backend API (see §1).
- `RevenueReportsTab` is used by Analytics but lives in `components/billing/`; `TopClientsTable` is a legacy name that renders the stores table.
- `lib/metrics.ts` periods (`monthPeriod`, `yearPeriod`) use local calendar fields while the reports use UTC bounds (PRD-002 SA-5); they agree for date-only data but should move to the UTC helpers when metrics get real timestamps.
- oxlint reports pre-existing `set-state-in-effect` and `only-export-components` warnings (no errors).
- **Audit 2026-10-14:** see `docs/audits/2026-10-14-super-admin-audit.md`. SA-1 to SA-7 were fixed by PRD-002 WS-G. Still open: Vercel password/SSO protection (owner; the code only adds `noindex`), confirming the SA-7 tier mapping and the PENDING→ACTIVE convention, and 4 npm audit findings in the lockfile. The platform billing provider still needs an ADR.

## 9. Before you finish a change

- [ ] I read this file, `README.md`, `docs/README.md`, `docs/design/README.md` and the relevant PRD.
- [ ] Logic is in `src/lib` with tests, types live in `types/index.ts`, and the UI uses the `components/ui` kit and tokens.
- [ ] Raw enum values (plans, statuses, gateways) never reach the screen; they go through `display-labels.util.ts`.
- [ ] I didn't add an API client, state library, icon library or dependency without approval.
- [ ] `npm run build`, `npm run lint` and `npm test` pass, or I reported the failures.
- [ ] Docs are updated, with a "Docs impact" line.
