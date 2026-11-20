# PRD-049 — Support: Help Centre and store tickets (console pointer)

| Field | Value |
|---|---|
| Status | **Approved** 2026-11-19 (owner: "go ahead with recommended decisions and approach"); step A1 console built 2026-11-19; step A3 (feature board) console built 2026-11-20 (working tree, not committed or deployed; D13 up and down votes) |
| Owner | Rohit (product) · Anand (engineering) |
| Repos affected | zcom-backend · zcom-frontend · zcom-super-admin · zcom-storefront-kit · storefronts/deveshe-dreams · storefronts/rare-element |
| Source-of-truth PRD | [`../../../zcom-backend/docs/prd/PRD-049-support-help-centre-and-store-inbox.md`](../../../zcom-backend/docs/prd/PRD-049-support-help-centre-and-store-inbox.md) |
| Created / Updated | 2026-11-19 / 2026-11-20 |
| Approved by / on | Anand (owner) / 2026-11-19 |

This pointer holds only the console's UX and implementation notes. Requirements, decisions (D1–D13), the contract and the rollout live in the source-of-truth PRD. Part B (the shoppers' Support Inbox) has no console screen in step A1.

## 1. Problem and goal

The R2-8 console queue let Zerror staff mark a ticket Solved, borrowed `tenants:read` / `notes:write`, and showed only the title and thread. PRD-049 step A1 makes the store the only one who closes a ticket, adds ticket types, the store's impact, a contact and the captured dashboard context, and gives support its own permissions and a settings page for hours and promises. The console follows that contract.

## 2. Scope

**In scope (A1):** the queue's views and KPI band, the ticket drawer (new fields, Resolve, the three settable statuses, the priority note, permission gating), Support › Settings, the permission mirror and the roles matrix, the console feed's Stores tab for the new support rows.

**In scope (A3, 2026-11-20):** Support › Feature requests (`/support/features`): the board with store names, ups / downs / score, the request drawer (votes, down-vote reasons, votes by plan, the up-voters' plan value, comments) and the moderation actions.

**Out of scope (later steps):** estimates and the time log, incidents, the store panel, ticket merge and converting a ticket into a feature post (A2/A3, not in the backend yet), images on posts, help content (A4).

## 3. Users and permissions

Mirrors core `platform-permissions.ts` (FR-A34) in `src/lib/permissions.ts`:

| Permission | Console use | Roles |
|---|---|---|
| `platform:support:read` | Support › Tickets and Support › Settings (nav and page lock) | every role (READ_ONLY through `:read`; BILLING_MANAGER keeps its old ticket read) |
| `platform:support:reply` | composer, internal note, status, Resolve, assigning yourself | OWNER, ADMIN, SUPPORT_AGENT |
| `platform:support:manage` | priority, assigning anyone else or nobody, saving Support › Settings | OWNER, ADMIN |
| `platform:feedback:manage` | Support › Feature requests changes: status, merge, edit, hide, reply, pin, hide comments (A3); also opens the board | OWNER, ADMIN |
| `platform:help:manage` | mirrored only (A4) | OWNER, ADMIN |

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
- **FR-A29 feature board (step A3)** (`pages/SupportFeatureRequests.tsx`, `/support/features`; rules in `components/support/feature-requests.util.ts`): status tabs All · Open · Under review · Planned · In progress · Released · Not planned · Merged with the server's `counts` (All leaves Merged out, as the server's default list does); sort Most votes (the score, D13) · Newest · Recently updated; area and type in the filter drawer; search (title, FR number or store); a **Show hidden** switch. Everything lives in the URL (`status`, `order`, `area`, `type`, `hidden=1`, `q`, `page`), and `?request=<id>` opens the drawer, which is the link the console feed's `FEATURE_REQUEST_NEW` row carries. Rows: title, `FR-n · type · area` (and "hidden"), the posting store (or "ZCommerce team"), score with ups and downs, comments, status, last activity. Visible in the nav and readable with `platform:support:read` **or** `platform:feedback:manage` (the nav map now takes a list meaning "any of").
- **Feature request drawer** (`components/support/FeatureRequestDrawer.tsx`, size lg): merged notice with "Open it" (the target), hidden notice, posted by (store link) and who, posted, last activity, comments; the problem; the status with its note, since when and the release link (http(s) only); up votes, down votes, score and **the up-voting stores' monthly plan value** (`upVoterMonthlyValue` in `currency`, "₹12,500 a month", "No paid plans" at 0); votes by plan; every vote (store, plan, up / down, reason, who, when; "reasons are only shown to ZCommerce"); every comment, ZCommerce replies badged "ZCommerce team", pinned and hidden ones marked. Read-only without `feedback:manage`.
- **Actions (`platform:feedback:manage`)** (`components/support/FeatureRequestDialogs.tsx`): ⋯ menu Change status · Merge into… · Edit · Hide from stores (confirm) / Show to stores. **Change status** offers every status but Merged; the note is required for Not planned and capped at 1000; the https release link shows only for Released and is sent only then; moving to Planned, In progress, Released or Not planned shows "Every store that posted or voted on this request is told…"; an unchanged form closes without a call. **Merge into…** searches the board (hidden included, merged and itself left out), explains that votes move one per store and the target's vote wins, then opens the target. **Edit** sends only changed fields (title 5–140, problem 10–4000, type, area). The reply box (footer, up to 2000) has "Pin this reply to the top"; each ZCommerce reply has Pin / Unpin, every comment Hide / Unhide (`aria-label`s name the author). A merged request takes no status, merge or reply.
- **Errors:** `INVALID_FEATURE_REQUEST`, `INVALID_FEATURE_STATUS`, `NOTE_REQUIRED`, `INVALID_URL` land on `extensions.field` (else the form line); `FEATURE_REQUEST_CHANGED`, `FEATURE_REQUEST_MERGED`, `FEATURE_COMMENT_NOT_FOUND` toast and reload; `SAME_REQUEST`, `NOT_ZERROR_REPLY`, `FEATURE_REQUEST_NOT_FOUND` have console copy; a NOT_FOUND request read shows "This request no longer exists"; FORBIDDEN is the Apollo link's global toast.
- **FR-A31 feed:** the bell renders the new `SUPPORT_TICKET_*` kinds by category (STORES), so no per-kind mapping was needed; their `/support/tickets?ticket=<id>` link opens the drawer. The Stores tab now also opens with `platform:support:read`.

## 5. API / data contract

No contract change from this repo. Operations in `src/graphql/support.ts`: the ticket fragments gain `type`, `typeLabel`, `impact`, `outcome`, `outcomeLabel`, `resolvedAt`, `closedAt`, `closedBy`, `reopenedCount` (list) and `steps`, `neededBy`, `linkedCustomer`, `followUpOf`, `contact`, `context`, `outcomeNote`, `resolvedByName`, `rating` (thread); `solvedAt` is no longer read; counts read every view (not the deprecated `solved`); the summary reads `resolvedAwaitingConfirmation`; `SetPlatformSupportTicketPriority` takes `$note`. New: `ResolvePlatformSupportTicket`, `PlatformSupportSettings`, `UpdatePlatformSupportSettings`. The settings type has no id, so the mutation writes the query's cache entry itself.

**Step A3:** new `src/graphql/feature-requests.ts`: `PlatformFeatureRequests` (sort, status, area, type, search, includeHidden, limit, offset; items, totalCount, counts), `PlatformFeatureRequest` (detail with votes, votesByPlan, upVoterMonthlyValue, currency, comments), `SetFeatureRequestStatus`, `MergeFeatureRequests`, `EditFeatureRequest`, `HideFeatureRequest`, `ReplyFeatureRequest`, `UpdateFeatureComment`. `PlatformFeatureRequest` and `PlatformFeatureRequestDetail` are separate cache entities, so every mutation refetches both queries by name. Contract note: the server's release-link check (`/^https?:\/\/\S+$/`) also takes `http://`; the console asks for https, as the SDL and error copy say.

**Rollout:** deploy the backend first (the new fields and operations don't exist on an older API).

## 6. UX

Existing kit only (Drawer, Modal md / sm, Select, Textarea, Input, Switch, FilterChip, Card, SettingsSaveBar, SummaryPanel, TableToolbar); no design-system change. Support › Settings is a nav item under Support. Step A3 adds Support › Feature requests (after Tickets) with the same kit: TableToolbar (tabs, search, sort, filter drawer, a Switch), DataTable, Drawer lg with RowMenu, Modal md, ConfirmDialog, Checkbox.

## 9. Rollout and verification

See §10.

## 10. Implementation log

### Step A1, console — 2026-11-19 (working tree on `main`, not committed or deployed)

- Files: `src/lib/permissions.ts` (+ test), `src/components/settings/roles-matrix.util.ts` (+ test: a "Support tickets" row), `src/lib/platform-notifications.util.ts`, `src/config/navigation.ts`, `src/App.tsx`, `src/lib/route-prefetch.ts`, `src/graphql/support.ts`, `src/components/support/support.util.ts` (+ new test), `src/components/support/SupportTicketDrawer.tsx`, new `src/components/support/SupportTicketDialogs.tsx`, `src/pages/SupportTickets.tsx`, new `src/pages/SupportSettings.tsx`, new `src/lib/support-settings.util.ts` (+ test).
- Verification: `npm test` 413 tests in 61 files, all green (+20 new: support util 13, settings util 6, permissions 1; roles matrix +3 assertions); `npm run lint` exit 0 (only pre-existing warnings; the two `react(refs)` warnings in `SupportTickets.tsx` are the existing `lastCounts` ref); `npm run lint:hex` 0; `npm run lint:px` 18/18; `npm run validate:ops` 0 invalid; `npm run validate:contracts` 148/148; backend `npm run validate:clients -- --all` 0 failures for every client; `VITE_GATEWAY_URL=https://api.zerrorstudios.com/v1/graphql npm run build` passes (typecheck and bundle). Not run in a browser or against a live gateway.
- Not done here: the backend's committed manifest `zcom-backend/scripts/validate-clients/manifests/zcom-super-admin.operations.json` needs `npm run validate:clients -- --all --write` in the backend change (this repo doesn't write backend files).

### Step A3 (feature board), console — 2026-11-20 (working tree on `main`, not committed or deployed)

- Files: new `src/pages/SupportFeatureRequests.tsx`, `src/components/support/FeatureRequestDrawer.tsx`, `src/components/support/FeatureRequestDialogs.tsx`, `src/components/support/feature-requests.util.ts` (+ test), `src/graphql/feature-requests.ts`; changed `src/config/navigation.ts` (Feature requests item; `NAV_PERMISSIONS` takes a list = any of), `src/App.tsx` (`support/features`), `src/lib/route-prefetch.ts`, `src/components/settings/roles-matrix.util.ts` (+ test: a "Feature requests" row, edit `feedback:manage`, view `support:read`).
- Verification: `npx tsc -b` clean; `npx vitest run` 433 tests in 62 files, all green (+19 feature board util, +3 roles matrix assertions); `npm run lint` exit 0, no new warnings; `lint:hex` 0; `lint:px` 18/18; `npm run validate:ops` 0 invalid (8 new operations ok); `npm run validate:contracts` 156/156, 0 failures; `VITE_GATEWAY_URL=https://api.zerrorstudios.com/v1/graphql vite build` to a scratch outDir passes. Not run in a browser or against a live gateway.
- Not done here: the backend's committed manifest `zcom-backend/scripts/validate-clients/manifests/zcom-super-admin.operations.json` needs `npm run validate:clients -- --all --write` in the backend change; converting a ticket into a post and images on posts wait for the backend.
