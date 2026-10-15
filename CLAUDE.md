# CLAUDE.md — zcommerce-super-admin

## UI
All UI work in the Merchant Admin and Super Admin apps must follow docs/design/README.md and the files it lists. Use tokens from docs/design/tokens.css; never hard-code colours, sizes or radii.

**Decisions (2026-10-15, owner):** `docs/design/` is the approved spec for the restyle; no separate PRD is needed. The typeface is **Geist** per `docs/design/01-foundations.md`, replacing Wix Madefor Text.

## Platform numbers and store status (one source each)
- Money metrics (Monthly billing, Earned this month/year, Projected, Outstanding, collection rate) come only from `src/lib/metrics.ts`. Home, Billing › Collections and Analytics › Revenue must use it so they always agree; "Outstanding" = the open invoice rows Collections lists.
- Store lifecycle and payment badges come only from `src/lib/storeStatus.ts` (`storeLifecycle`, `paymentState`, `graceDaysFor`); health bands from the kit's `getHealthBand` (Healthy / At risk / Critical).
- Visible text says "store/stores"; routes are `/stores…` (old `/clients…` redirect). Code identifiers (`Client`, `ClientsProvider`) are unchanged.
- "Log in" to a store has no real mechanism yet: every button calls `logInToStore()` in `src/components/clients/storeLogin.ts`, which shows a toast. Implement impersonation there.
