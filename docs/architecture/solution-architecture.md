# zcom-super-admin: Solution Architecture (Platform Console)

| | |
|---|---|
| **Status** | Living document. Verified against code on **2026-10-13** |
| **Parent** | Workspace `../ARCHITECTURE.md` |
| **Maturity** | **UI prototype on mock data.** The backend integration is **[Target]**; it needs a cross-repo T1 PRD and ADRs |

---

## 1. Purpose

This is Zerror Studios' internal console for operating the ZCommerce platform:
- onboarding and managing **client stores** (tenants);
- plans and subscriptions, billing transactions and revenue reports;
- coupons and renewal-reminder automation;
- a per-client view of usage and health, with an "impersonate store" action.

Tenant staff use `zcom-frontend`; this console sits *above* all tenants.

## 2. Context: current vs target

```mermaid
flowchart LR
    Z(["👤 Zerror team"]) --> SA["zcom-super-admin<br/>Vercel SPA"]
    SA --> MOCK[("src/lib/mockData.ts<br/>+ in-memory providers<br/>+ localStorage")]
    SA -. "[Target] GraphQL with platform-scoped token" .-> GW["zcom-backend gateway"]
    GW -. "[Target]" .-> PLT["platform subgraph<br/>(master DB: Plan, Subscription, db_configs)"]
    PLT -. "[Target] cross-tenant aggregates" .-> TDBs[("tenant DBs<br/>usage, orders, revenue")]
    style MOCK fill:#fff3cd,stroke:#b58900
```

## 3. Application architecture (current)

```mermaid
flowchart TB
    MAIN["main.tsx<br/>StrictMode > BrowserRouter > AppProviders > App"] --> PROV
    subgraph PROV["providers/AppProviders"]
        HP["HeroUIProvider (navigate, useHref)"] --> TP["ToastProvider bottom-right"] --> AUP["AuthProvider<br/>boolean in localStorage zcommerce-admin-auth"] --> CLP["ClientsProvider<br/>in-memory clients seeded from mockData"]
    end
    PROV --> APP["App.tsx &lt;Routes&gt;"]
    APP --> GO["GuestOnly → /sign-in"]
    APP --> RA["RequireAuth → DashboardLayout (Sidebar + Topbar)"]
    RA --> PG["pages: Home · Clients · ClientDetail · AddClient<br/>Billing/:section · Analytics/:section · Settings/:section"]
    PG --> CMP["components/{clients,billing,dashboard,payments,settings}<br/>+ common kits (buttonStyles, modalStyles, dataTableStyles, inputStyle)"]
    PG --> LIB["lib/ pure logic (tested)<br/>subscriptionHealth · subscriptionReports · revenueReports<br/>storeHealth · platformSettings · tableSelection"]
    LIB --> MD[("lib/mockData.ts")]
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
| `/settings/:section` | Settings | `discounts` (coupons), `automation` (renewal reminders) |

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

## 6. [Target] Integration architecture

The backend has **no cross-tenant API and no platform identity** today. The design below is a proposal. Each numbered decision needs an ADR before it's built.

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
| Fake sign-in on a publicly hosted URL | Anyone can open the console; only mock data is exposed today | Restrict access until ADR-1 is done |
| No backend API | The console can't operate the real platform | Cross-repo T1 PRD (backend source of truth) |
| Vocabulary mismatch with backend plans and statuses | Integration bugs | Settle it in the PRD |
| Unused components and mock exports; mixed icon libraries; hard-coded hexes | Maintainability | T2 clean-ups when the code is touched |
