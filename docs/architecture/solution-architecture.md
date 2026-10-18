# zcom-super-admin: Solution Architecture (Platform Console)

| | |
|---|---|
| **Status** | Living document. Verified against code on **2026-10-13** |
| **Parent** | Workspace `../ARCHITECTURE.md` |
| **Maturity** | **API-only (PRD-005 Phases 0–4, 2026-10-17).** Real sign-in, stores, lifecycle, subscriptions, billing, reports, Team, audit and impersonation from the `platform-admin` subgraph; the mock prototype was removed (Q14). Not yet run in a browser against a live gateway. |

---

## 1. Purpose

This is Zerror Studios' internal console for operating the Zcom platform:
- onboarding and managing **client stores** (tenants);
- plans and subscriptions, billing transactions and revenue reports;
- coupons and renewal-reminder automation;
- a per-client view of usage and health, with an "impersonate store" action.

Tenant staff use `zcom-frontend`; this console sits *above* all tenants.

## 2. Context: current vs target

```mermaid
flowchart LR
    Z(["👤 Zerror team"]) --> SA["zcom-super-admin<br/>Vercel SPA"]
    SA -->|"one Apollo client,<br/>platform token (aud platform-admin) + refresh cookie"| GW["zcom-backend gateway /v1/graphql"]
    GW --> PADM["platform-admin subgraph :4014<br/>(master DB: platform_user, platform_session, audit;<br/>reads db_configs, plan, subscription)"]
    PADM --> TDBs[("tenant DBs<br/>provisioning, usage snapshots, impersonation")]
```

## 3. Application architecture (current)

```mermaid
flowchart TB
    MAIN["main.tsx<br/>StrictMode > BrowserRouter > AppProviders > App"] --> PROV
    subgraph PROV["providers/AppProviders"]
        HP["HeroUIProvider (navigate, useHref)"] --> TP["ToastProvider bottom-right"] --> AUP["AuthProvider<br/>platform session: token in memory, refresh cookie"] --> SP["SettingsProvider<br/>platformSettings"] --> CLP["ClientsProvider<br/>platformTenants + platformPlans via api-adapters"]
    end
    PROV --> APP["App.tsx &lt;Routes&gt;"]
    APP --> GO["GuestOnly → /sign-in"]
    APP --> RA["RequireAuth → DashboardLayout (Sidebar + Topbar)"]
    RA --> PG["pages: Home · Clients · ClientDetail · AddClient<br/>Billing/:section · Analytics/:section · Settings/:section"]
    PG --> CMP["components/{clients,billing,dashboard,payments,settings}<br/>+ common kits (buttonStyles, modalStyles, dataTableStyles, inputStyle)"]
    PG --> HK["hooks/use-platform-reports<br/>revenue, collections, payments, coupons"]
    PG --> LIB["lib/ pure logic (tested)<br/>api-adapters · api-report-adapters · periods · store-sales · report-csv<br/>storeStatus · storeHealth · platformSettings"]
    PG --> TY["types/index.ts"]
```

### Route map

| Route | Page | Sections / notes |
|---|---|---|
| `/sign-in` | SignIn | Behind `GuestOnly`. Fake auth accepts any credentials |
| `/` | Home | KPI cards (revenue, MRR, stores, orders), revenue chart, plan mix, top clients |
| `/clients` | Clients | Table with status and health |
| `/clients/new` | AddClient | Plan (Free/Starter/Pro/Enterprise), status (trial/active/suspended) |
| `/clients/:id` | ClientDetail | Overview / Billing / Usage tabs, danger zone, "Login as store" |
| `/billing/:section` | Billing | `subscriptions`, `transactions` |
| `/analytics/:section` | Analytics | `revenue` |
| `/settings/:section` | Settings | `discounts` (coupons), `billing-rules` (platform settings), `team` (platform users, API only), `audit` (audit log, API only); `automation` redirects to `/billing/reminders` |

## 4. Domain model (front-end types)

```mermaid
classDiagram
    class Client {
        id
        storeName
        domain
        plan : PlanName
        status : ClientStatus
        mrr
        createdAt
    }
    class Plan {
        name : Free|Starter|Pro|Enterprise
        price
        limits
    }
    class Subscription {
        clientId
        plan
        status : SubscriptionStatus
        renewsAt
        gracePeriodDays
    }
    class Transaction {
        clientId
        amount
        gateway : Stripe|Razorpay
        status : TransactionStatus
    }
    class Coupon {
        code
        discount
        validity
    }
    class PlatformSettings {
        renewalReminderDays
        defaultGracePeriod
    }
    Client --> Plan
    Client "1" --> "0..*" Subscription
    Client "1" --> "0..*" Transaction
    Subscription --> Plan
```

**Mismatch to resolve in the integration PRD.** The backend's master-DB `Plan.name` enum is `STARTER | PREMIUM | PLUS | ENTERPRISE`, and `Subscription.status` is `ACTIVE | TRIAL | PAST_DUE | CANCELLED | SUSPENDED`. The console uses `Free/Starter/Pro/Enterprise` and its own status set. One vocabulary must be chosen.

## 5. Subscription-health logic (tested core)

```mermaid
flowchart LR
    S["Subscription + Client + PlatformSettings"] --> F{"status?"}
    F -- suspended --> B1["bucket: suspended"]
    F -- past_due --> B2["bucket: past_due"]
    F -- pending --> B3["bucket: pending"]
    F -- active --> R{"renewsAt within<br/>reminder window?"}
    R -- yes --> B4["bucket: expiring soon"]
    R -- no --> B5["bucket: healthy"]
    G["per-client grace override"] -.-> F
```

This logic lives in `lib/subscriptionHealth.ts`, which has tests in `subscriptionHealth.test.ts`. The reports in `subscriptionReports.ts` and `revenueReports.ts` reconcile their overview totals with the drill-down counts, and those are tested too.

## 6. Integration architecture (PRD-005)

**Current (Phase 1, 2026-10-17).** The backend has the platform principal (ADR-001, Accepted) and the `platform-admin` subgraph. This repo talks to it through `src/lib/apollo-client.ts` (auth link, silent refresh on `TOKEN_EXPIRED` with a single-flight, cross-tab lock, proactive refresh, error codes), with the access token in memory (`lib/session-store.ts`) and the refresh token in the `__Host-zc_platform_rt` cookie. `AuthProvider` restores the session on load (`platformRefreshToken` → `platformMe`), runs the TOTP step on `MFA_REQUIRED`, and sends manage roles to `/mfa` to enrol. `ClientsProvider` maps `platformTenants` / `platformPlans` onto the console's `Client`, `Subscription` and `Plan` types (`lib/api-adapters.ts`) so every screen reads them unchanged. ADR-5 is answered: Apollo cache for server data, React context for session and UI state only. **Phase 2 (same day):** `ClientsProvider` also runs the lifecycle mutations (create with provisioning, update, notes, suspend with a reason, reactivate, soft delete with the slug), `SettingsProvider` holds the server settings, and the store page gained the provisioning card, subscription actions and editable notes; health and payment badges are server-computed (ADR-2 answered with daily usage snapshots in the master DB).

**Target (Phases 2–4).** The sequence below is the full design from the PRD; the identity decision (ADR-1 here) is ADR-001 in the backend and is done.

```mermaid
sequenceDiagram
    autonumber
    actor Z as Zerror operator
    participant SA as super-admin SPA
    participant GW as Gateway
    participant AU as auth (platform principal)
    participant PLT as platform subgraph
    participant M as Master DB
    participant T as Tenant DBs

    Z->>SA: sign in
    SA->>GW: platformLogin(email, password, MFA) [ADR-1]
    GW->>AU: platform-scoped principal, separate signing key
    AU-->>SA: platform access token (type: platform) + refresh cookie
    SA->>GW: listTenants(filters, limit, offset)
    GW->>PLT: requirePlatformPermission(TENANTS_READ)
    PLT->>M: db_configs + Subscription + Plan
    PLT-->>SA: {tenants, totalCount}
    SA->>GW: tenantUsage(tenantId) [ADR-2 aggregation strategy]
    PLT->>T: read-only aggregates or precomputed usage snapshots
    SA->>GW: suspendTenant(tenantId)
    PLT->>M: db_configs.status = SUSPENDED (tenant resolution must enforce it)
    PLT->>PLT: invalidate tenant caches (all keys)
    SA->>GW: impersonateTenant(tenantId) [ADR-3]
    AU-->>SA: short-lived, audited admin token for that tenant
```

| ADR | Decision needed |
|---|---|
| ADR-1 | **Platform identity:** a separate principal, key and cookie, or the existing admin with a platform scope. MFA requirement. |
| ADR-2 | **Cross-tenant metrics:** fan-out queries, an event-driven usage collection in the master DB, or the analytics service |
| ADR-3 | **Impersonation ("Login as store"):** token minting, expiry, audit trail |
| ADR-4 | **Platform billing provider:** Stripe or Razorpay (the console types) vs Nimbbl (tenant payments) |
| ADR-5 | **Client state after integration:** keep React context, or adopt Apollo cache conventions like zcom-frontend |

## 7. UI system

| Concern | Choice |
|---|---|
| Primitives | HeroUI 2.8 |
| Styling | Tailwind **v4**, configured in CSS: `@theme` tokens in `src/index.css`, and `@plugin "../hero.ts"` (light theme, primary `#3b82f6`) |
| Kits | `components/common/*Styles.ts`, `styles/inputStyle.ts`, `PageHeader`, `ConfirmModal`, `StatusChip`, `TableToolbar`, `NoDataPlaceholder` |
| Charts | recharts |
| Icons | lucide-react (preferred for new icons); react-icons in older files |
| Theme | Light only (`dark` class removed on mount) |

## 8. Build, test and deploy

```mermaid
flowchart LR
    SRC["src/"] --> TSC["tsc -b (strict)"] --> VB["vite build"] --> VER["Vercel<br/>vercel.json: /(.*) → /index.html"]
    SRC --> VT["vitest run<br/>src/**/*.test.ts (node env)"]
    SRC --> OX["oxlint"]
```

## 9. Risks and gaps

| Gap | Impact | Path |
|---|---|---|
| Vercel topology | `/v1/graphql` has no rewrite and a `SameSite=Strict` cookie cannot cross sites, so sessions cannot be kept on Vercel as configured | PRD-005 Q6: serve the console behind the CloudFront edge or add the rewrite (review C-H3) |
| Vocabulary mismatch with backend plans and statuses | Integration bugs | Settle it in the PRD |
| No notifications feed | The panel is empty | Feed it from `platformAuditLog` or events (T1) |
