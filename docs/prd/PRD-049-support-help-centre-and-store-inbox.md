# PRD-049 — Support: Help Centre and store tickets (console pointer)

| Field | Value |
|---|---|
| Status | **Approved** 2026-11-19 (owner: "go ahead with recommended decisions and approach"); step A1 console built 2026-11-19 (working tree, not committed or deployed) |
| Owner | Rohit (product) · Anand (engineering) |
| Repos affected | zcom-backend · zcom-frontend · zcom-super-admin · zcom-storefront-kit · storefronts/deveshe-dreams · storefronts/rare-element |
| Source-of-truth PRD | [`../../../zcom-backend/docs/prd/PRD-049-support-help-centre-and-store-inbox.md`](../../../zcom-backend/docs/prd/PRD-049-support-help-centre-and-store-inbox.md) |
| Created / Updated | 2026-11-19 / 2026-11-19 |
| Approved by / on | Anand (owner) / 2026-11-19 |

This pointer holds only the console's UX and implementation notes. Requirements, decisions (D1–D12), the contract and the rollout live in the source-of-truth PRD. Part B (the shoppers' Support Inbox) has no console screen in step A1.

## 1. Problem and goal

The R2-8 console queue let Zerror staff mark a ticket Solved, borrowed `tenants:read` / `notes:write`, and showed only the title and thread. PRD-049 step A1 makes the store the only one who closes a ticket, adds ticket types, the store's impact, a contact and the captured dashboard context, and gives support its own permissions and a settings page for hours and promises. The console follows that contract.

## 2. Scope

**In scope (A1):** the queue's views and KPI band, the ticket drawer (new fields, Resolve, the three settable statuses, the priority note, permission gating), Support › Settings, the permission mirror and the roles matrix, the console feed's Stores tab for the new support rows.

**Out of scope (later steps):** estimates and the time log, incidents, the store panel, merge and convert (A2/A3), the feature board (A3), help content (A4).

## 3. Users and permissions

Mirrors core `platform-permissions.ts` (FR-A34) in `src/lib/permissions.ts`:

| Permission | Console use | Roles |
|---|---|---|
| `platform:support:read` | Support › Tickets and Support › Settings (nav and page lock) | every role (READ_ONLY through `:read`; BILLING_MANAGER keeps its old ticket read) |
| `platform:support:reply` | composer, internal note, status, Resolve, assigning yourself | OWNER, ADMIN, SUPPORT_AGENT |
| `platform:support:manage` | priority, assigning anyone else or nobody, saving Support › Settings | OWNER, ADMIN |
| `platform:feedback:manage`, `platform:help:manage` | mirrored only (A3, A4) | OWNER, ADMIN |

Release notes, topic counts and system health keep `platform:tenants:read` / `:manage`.

## 4. Functional requirements (console notes)

- **FR-A32 queue** (`pages/SupportTickets.tsx`): views Open · Unassigned · Mine · Urgent · Due soon · Waiting on store · Resolved · Closed · All, each with the server's count (All since 2026-11-20, `counts.all`). Rows show `ref · type · area`, and under the priority "Store said high" when the store's impact differs. The KPI band (four cells, the kit maximum): Open (high priority, late), Waiting on a store, **Resolved, awaiting confirmation** (with "N closed this week"), First reply.
- **Drawer** (`components/support/SupportTicketDrawer.tsx`): tracker Received · Being worked on · Resolved · Closed; facts (type, area, the store's impact against today's priority, needed by, linked order / product / customer, follows up, reopened count); steps; contact card (mailto, `tel:`, and a `https://wa.me/<digits>` link only when the contact ticked WhatsApp OK; best time; role); captured context in a collapsed `<details>` (page URL linked only when http(s), browser, device, screen, dashboard build, plan, recent errors); the outcome with its note, resolver and time, "Closed by the store" / "Closed automatically", the rating.
- **FR-A13 Resolve** (`components/support/SupportTicketDialogs.tsx`): an outcome select (Fixed, Answered, Change done, Works as designed, Duplicate, Won't do) and a required note to the store; `OUTCOME_REQUIRED` / `REQUIRED` land on their fields; `ALREADY_RESOLVED` / `TICKET_CLOSED` toast and close. Offered while the ticket is not Resolved or Closed.
- **D3 status:** the status select offers only Open, In progress and Waiting on store; a Resolved or Closed ticket shows its status as a disabled option, and a Closed ticket's select is disabled. A reply's "Then:" offers the same three, plus "keep Resolved" (sends no status) on a resolved ticket. The console never closes a ticket.
- **CLOSED:** the composer becomes notes only, with "The store closed this ticket. They can reopen it." (the backend still takes internal notes on a closed ticket).
- **FR-A10 priority:** lowering below the store's impact opens a note dialog (the note is posted to the store's thread); a `NOTE_REQUIRED` answer reopens it with the message on the field.
- **Assign:** with manage, everyone who can reply plus "Not assigned"; with reply only, yourself (others shown, not pickable).
- **FR-A33 Support › Settings** (`pages/SupportSettings.tsx`, `/support/settings`, `lib/support-settings.util.ts`): time zone, the seven days (open switch, opens / closes), holidays (date chips, add / remove), first-reply hours per priority (Urgent in calendar hours), after a reopen, auto-close days, reminder days (comma list, before the auto-close day), reopen window, waiting reminder working days. Client checks mirror the server's; only changed groups are sent, with `expectedVersion`; `INVALID_SUPPORT_SETTING` lands on `extensions.field` (a whole-calendar error on the time zone); `VERSION_CONFLICT` toasts and reloads the newer saved version with the person's own edits on top (`rebaseSupportSettingsDraft`: a value counts as edited when it differs from the version the form opened on, per day and per priority), so they check and save again without retyping. Read-only without manage; loading skeleton, error and lock states.
- **FR-A31 feed:** the bell renders the new `SUPPORT_TICKET_*` kinds by category (STORES), so no per-kind mapping was needed; their `/support/tickets?ticket=<id>` link opens the drawer. The Stores tab now also opens with `platform:support:read`.

## 5. API / data contract

No contract change from this repo. Operations in `src/graphql/support.ts`: the ticket fragments gain `type`, `typeLabel`, `impact`, `outcome`, `outcomeLabel`, `resolvedAt`, `closedAt`, `closedBy`, `reopenedCount` (list) and `steps`, `neededBy`, `linkedCustomer`, `followUpOf`, `contact`, `context`, `outcomeNote`, `resolvedByName`, `rating` (thread); `solvedAt` is no longer read; counts read every view (not the deprecated `solved`); the summary reads `resolvedAwaitingConfirmation`; `SetPlatformSupportTicketPriority` takes `$note`. New: `ResolvePlatformSupportTicket`, `PlatformSupportSettings`, `UpdatePlatformSupportSettings`. The settings type has no id, so the mutation writes the query's cache entry itself.

**Rollout:** deploy the backend first (the new fields and operations don't exist on an older API).

## 6. UX

Existing kit only (Drawer, Modal md / sm, Select, Textarea, Input, Switch, FilterChip, Card, SettingsSaveBar, SummaryPanel, TableToolbar); no design-system change. Support › Settings is a nav item under Support.

## 9. Rollout and verification

See §10.

## 10. Implementation log

### Step A1, console — 2026-11-19 (working tree on `main`, not committed or deployed)

- Files: `src/lib/permissions.ts` (+ test), `src/components/settings/roles-matrix.util.ts` (+ test: a "Support tickets" row), `src/lib/platform-notifications.util.ts`, `src/config/navigation.ts`, `src/App.tsx`, `src/lib/route-prefetch.ts`, `src/graphql/support.ts`, `src/components/support/support.util.ts` (+ new test), `src/components/support/SupportTicketDrawer.tsx`, new `src/components/support/SupportTicketDialogs.tsx`, `src/pages/SupportTickets.tsx`, new `src/pages/SupportSettings.tsx`, new `src/lib/support-settings.util.ts` (+ test).
- Verification: `npm test` 413 tests in 61 files, all green (+20 new: support util 13, settings util 6, permissions 1; roles matrix +3 assertions); `npm run lint` exit 0 (only pre-existing warnings; the two `react(refs)` warnings in `SupportTickets.tsx` are the existing `lastCounts` ref); `npm run lint:hex` 0; `npm run lint:px` 18/18; `npm run validate:ops` 0 invalid; `npm run validate:contracts` 148/148; backend `npm run validate:clients -- --all` 0 failures for every client; `VITE_GATEWAY_URL=https://api.zerrorstudios.com/v1/graphql npm run build` passes (typecheck and bundle). Not run in a browser or against a live gateway.
- Not done here: the backend's committed manifest `zcom-backend/scripts/validate-clients/manifests/zcom-super-admin.operations.json` needs `npm run validate:clients -- --all --write` in the backend change (this repo doesn't write backend files).
