# CLAUDE.md — zcommerce-super-admin

## UI
All UI work in the Merchant Admin and Super Admin apps must follow docs/design/README.md and the files it lists. Use tokens from docs/design/tokens.css; never hard-code colours, sizes or radii.

**Decisions (2026-10-15, owner):** `docs/design/` is the approved spec for the restyle; no separate PRD is needed. The typeface is **Geist** per `docs/design/01-foundations.md`, replacing Wix Madefor Text.

## Platform numbers and store status (one source each)
- Money metrics (Monthly billing, Earned this month/year, Projected, Outstanding, collection rate) come only from `src/lib/metrics.ts`. Home, Billing › Collections and Analytics › Revenue must use it so they always agree; "Outstanding" = the open invoice rows Collections lists.
- Store lifecycle and payment badges come only from `src/lib/storeStatus.ts` (`storeLifecycle`, `paymentState`, `graceDaysFor`); health bands from the kit's `getHealthBand` (Healthy / At risk / Critical).
- Visible text says "store/stores"; routes are `/stores…` (old `/clients…` redirect). Code identifiers (`Client`, `ClientsProvider`) are unchanged.
- "Log in" to a store has no real mechanism yet: every button calls `logInToStore()` in `src/components/clients/storeLogin.ts`, which shows a toast. Implement impersonation there.
- AI features are always on (owner decision 2026-10-17; the `ai` flag, `VITE_FEATURE_AI` and the `/dev/ui` switch were removed — `useAiEnabled()` now always returns true). Today's brief (Home), the store insight (store detail) and the assistant (Ask bar at the bottom, ⌘J, "Ask AI" in ⌘K, wired in `DashboardLayout.tsx`, owner request 2026-10-17) are written by `src/lib/aiSamples.ts` from lib/metrics, lib/storeStatus and lib/subscriptionReports data; replace with real calls when an assistant backend exists.
- User-facing copy: repeated strings (empty states, toasts, confirmations) live in `src/copy.ts`; error toasts use the kit's `toastError()` (stays until closed). Dates via the kit's `formatDate`/`formatDateTime`/`formatRange`; wording rules in docs/design/05-wording.md.
