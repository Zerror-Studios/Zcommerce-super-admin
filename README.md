# zcom-super-admin — ZCommerce platform console

This is Zerror Studios' internal console for running the ZCommerce platform. It covers **client stores** (tenants), plans and subscriptions, billing and transactions, revenue analytics, coupons, and renewal automation. Tenant store staff use `../zcom-frontend` instead.

> **Status: API-only (PRD-005 Phases 0–4, 2026-10-17).** Sign-in is real (platform account, optional TOTP); stores, plans, subscriptions, the store lifecycle, subscription actions, billing rules, invoices, payments, discounts, reminders, every revenue and collections figure, Team, the audit log and "Log in to store" come from the backend `platform-admin` subgraph. The mock prototype was removed; notifications have no feed yet. Not yet run against a live gateway in a browser.

> Working here with Claude Code or as a new engineer? Read [`CLAUDE.md`](CLAUDE.md) first, then [`docs/README.md`](docs/README.md). UI work follows the design spec in [`docs/design/`](docs/design/README.md).

## Stack

- Vite 8, React 19 and TypeScript 6 (strict), with react-router-dom 7.
- HeroUI 2.8 with Tailwind CSS 4, themed by the design tokens in `src/styles/tokens.css` (Geist); HeroUI plugin in `hero.ts`.
- recharts, lucide-react, vitest and oxlint.

## Getting started

```bash
npm ci
npm run dev
```

Copy `.env.example` to `.env`. Names: `VITE_GATEWAY_URL` (local dev: `/v1/graphql`, served by the Vite dev proxy; **production: `https://api.zerrorstudios.com/v1/graphql`**, ADR-003 / PRD-007: the console on `platform.zerrorstudios.com` calls the API host directly, same-site, so the `SameSite=Strict` platform cookie is sent; `vercel.json` has no API rewrite), `API_GATEWAY_URL` (the backend gateway the Vite dev proxy forwards to), `VITE_REFRESH_TIMEOUT_MS`, `VITE_HTTP_TIMEOUT_MS` (deadline for every API request, default 30000, PRD-014 FE-23), `VITE_STORE_ADMIN_URL_TEMPLATE` (store admin address with `{slug}` for the "Log in to store" link when the API sends no `adminUrl`, PRD-014 UX-26).

The backend needs the `platform-admin` service running (see `../zcom-backend/README.md`) and at least one platform user: `npm run platform:bootstrap-owner -- --email you@zerror.in` in the backend prints a one-time set-password link that opens `/set-password` here.

## Scripts

| Task | Command |
|---|---|
| Dev | `npm run dev` |
| Build (typechecks) | `npm run build`; production mode needs `VITE_GATEWAY_URL` as an absolute `https://` URL, so a local build against the dev proxy uses `npx vite build --mode development` |
| Lint | `npm run lint` (oxlint); `npm run lint:hex` flags hard-coded colours |
| Contract check | `npm run validate:ops` validates every GraphQL operation against the backend `platform-admin` schema |
| Kit sync check | `npm run check:synced` fails when a `SYNCED FILE` in `src/components/ui` differs from `../zcom-frontend` (PRD-014 FE-16; skipped when the dashboard isn't checked out) |
| Tests | `npm test` / `npm run test:watch` (vitest; covers the `src/lib` adapters and helpers). `npm run build` runs them first (`prebuild`, PRD-014 FR-1.6), so a failing test stops the Vercel build |
| Contract check (variables) | `npm run validate:contracts` checks documents and `variables` shapes against the composed supergraph (backend `scripts/validate-clients`; needs `../zcom-backend` built) |
| Preview | `npm run preview` |

## Structure

- `src/App.tsx`: routes.
- `src/pages/`: Home, Clients (`/stores`), ClientDetail, AddClient, Billing, Analytics, Settings, SignIn, NotFound.
- `src/components/ui/`: the shared UI kit (see `docs/design/02-components.md`); `src/components/layout/`: shell, sidebar, command palette.
- `src/components/common/`: older table and modal kits still in use.
- `src/lib/`: pure, tested domain logic and the API layer (`apollo-client.ts`, `session-store.ts`, `auth-channel.ts`, `api-adapters.ts`).
- `src/graphql/`: GraphQL operations per domain (`auth`, `tenants`, `plans`, `subscriptions`, `billing`, `reports`, `settings`, `team`, `analytics`); `src/types/platform-api.ts` holds the API shapes.
- `src/hooks/`: `use-platform-reports.ts` (money rollups) and `use-platform-analytics.ts` (PRD-012: Analytics › Performance, Integration health, Sync monitor, and the store page's Analytics card).
- `src/types/`: entity types.

## Deployment

Deployed on Vercel. `vercel.json` adds the SPA rewrite and the security headers; its CSP `connect-src` allows `https://api.zerrorstudios.com`, the origin of the production `VITE_GATEWAY_URL` (PRD-014 FR-0.7). A build that points at another API host (UAT) needs that origin added there too. Only deploy when someone explicitly asks you to.

## Contributing

- **Tiered PRD-first workflow.** T1 changes need an approved PRD in `docs/prd/`; T2 changes need a changelog line.
- **Keep docs current.** Update this README and `CLAUDE.md` in the same change.
- **Commit style.** Conventional Commits.
