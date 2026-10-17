# zcom-super-admin — ZCommerce platform console

This is Zerror Studios' internal console for running the ZCommerce platform. It covers **client stores** (tenants), plans and subscriptions, billing and transactions, revenue analytics, coupons, and renewal automation. Tenant store staff use `../zcom-frontend` instead.

> **Status: UI prototype.** All data comes from `src/lib/mockData.ts`, and sign-in accepts any credentials. The backend doesn't yet have a platform (cross-tenant) API, so connecting this app is a planned cross-repo T1 PRD.

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

No environment variables are needed yet.

## Scripts

| Task | Command |
|---|---|
| Dev | `npm run dev` |
| Build (typechecks) | `npm run build` |
| Lint | `npm run lint` (oxlint); `npm run lint:hex` flags hard-coded colours |
| Tests | `npm test` / `npm run test:watch` (vitest; covers the `src/lib` report logic) |
| Preview | `npm run preview` |

## Structure

- `src/App.tsx`: routes.
- `src/pages/`: Home, Clients (`/stores`), ClientDetail, AddClient, Billing, Analytics, Settings, SignIn, NotFound.
- `src/components/ui/`: the shared UI kit (see `docs/design/02-components.md`); `src/components/layout/`: shell, sidebar, command palette.
- `src/components/common/`: older table and modal kits still in use.
- `src/lib/`: pure, tested domain logic and the mock data.
- `src/types/`: entity types.

## Deployment

Deployed on Vercel. `vercel.json` adds the SPA rewrite. Only deploy when someone explicitly asks you to.

## Contributing

- **Tiered PRD-first workflow.** T1 changes need an approved PRD in `docs/prd/`; T2 changes need a changelog line.
- **Keep docs current.** Update this README and `CLAUDE.md` in the same change.
- **Commit style.** Conventional Commits.
