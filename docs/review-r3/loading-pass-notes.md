# Loading pass: skeletons that look like the real content (Super Admin, 2026-11-10)

Owner: "the loading looks different from what actually comes in that place, so make it the same as the real data.
If something doesn't take time, don't show a fake loading; if data is there, show it. In tables, if data is there
show it; images can keep loading but the other data must come."

Same approach as the merchant admin (`Zcomm-frontend/docs/review-r3/loading-pass-notes.md`):

- **Real frame, placeholder values.** Static text (titles, descriptions, field labels, tab names, column headers)
  renders for real during the first load; only the values are placeholders.
- **One-line-tall placeholders.** `components/common/SkeletonBits.tsx` (copied from the merchant admin, relative
  import): `SkelLine` (bar inside the real type class with `h-lh`), `SkelChip` (22 px pill), `SkelButton` (control
  height), plus `SkelBars` (new here: the kit `RankedBars` rows).
- **First load only.** Every skeleton is behind `loading && !data` (or a hook whose `loading` already means that), so a
  background refetch keeps the real data. `.zc-skel` stays invisible for the first 200 ms, so a fast answer never
  flashes grey; reduced motion is handled by the kit class.
- **Tables** keep DataTable's own skeleton rows (it only shows them while `rows` is empty).

Kept from the earlier partial pass (checked, compiles): `hooks/use-load-view.ts`, `common/LoadHold.tsx`, Home,
NeedsYouCards, RecentActivityCard, ClientsPageContent, StoresTable.

## Per page

| Page | What changed |
| --- | --- |
| Store page › header | Was "Loading store…" as the title. Now the loaded header: real breadcrumb back link, tile, name line, status + plan chips, meta line, and the real tab switch at the tab the URL opens. |
| Store › Overview | Store health: the real health rows (labels known) with chip and detail placeholders; description line placeholder instead of "Checking…". Connected apps: three app rows (tile, name, chip) in the loaded grid. Go live checklist and Setup checks: the checklist rows (state icon, label + detail, chip). Profile: real description, field labels and Edit button place, Tags chips. Health signals: the real signal labels with value placeholders. Activity (compact): five time + sentence rows. Performance chart: already matched (220 px bars). |
| Store › Billing | Billing state: Reason / Since / Payment app labels with values loading. Payments list: collapsed payment cards (amount line, chip, caret space). Reminders: subject/channel rows with time and chip. Money in flight: count rows at body line height with the 64 px count column. Paid to date: one-line placeholder. Stuck payments / credits: already matched (DataTable). |
| Store › Team | Already matched (DataTable, first load only). |
| Store › Apps | Summary + table already matched; `useStoreApps` now reports `loading` only without data, so a refetch no longer blanks the summary, the table or Overview's Connected apps. GA4 card: one property row (chip, name, sync line). |
| Store › AI usage | Status and limits: the AI on/off chip place and the three limit labels with value placeholders. What they asked: question rows (orb, excerpt, count · date). Summary and usage history: already matched. |
| Store › Activity log | Day header + rows (time, icon tile, sentence, area) like the loaded log. History: status rows (chip, "by", time). |
| Store › Settings | No loading states (store details come with the store). |
| Billing (Subscriptions) | Summary + table already matched. The Flagged / Stuck payment filters used to list every store until their query answered; the table now waits (skeleton rows, tab counts hidden) for that first answer. |
| Billing › invoices (invoice detail) | Status history / Payments: real section titles, history and payment lines as placeholders. |
| Billing › flagged / stuck payments | Covered above (filters) and in Store › Billing (stuck table already matched). |
| Analytics › Revenue (Reports) | Revenue by plan: the bar chart skeleton at the chart's height (264 px) instead of a grey block. MRR movement description no longer says "Nothing is recorded" before the history answers. Summary, earnings trend (`LineChart`), tables: already matched. |
| Analytics › snapshot tabs (merchant sales, stores, retention…) | Was two grey blocks. Now: the summary panel (4 cells), two breakdown cards (title, description, ranked-bar rows) and the tab's store-list tables with their real titles and columns and DataTable skeleton rows. |
| Analytics › Store sales, Performance, Integration health, Sync monitor | Already matched (SummaryPanel + DataTable / 264 px chart skeleton; hooks first-load only). |
| AI usage | Already matched (summary + DataTables, hooks first-load only). |
| Support › Tickets | Page already matched. Ticket drawer: the tracker (real steps, none reached), two meta lines, the three control places (or chips for read-only roles) and two message rows, instead of two grey blocks. |
| Support › Announcements | Already matched (DataTable). |
| System health | Payment providers: provider rows (name, counts line, chip) instead of "Loading…". Analytics sync count line: one-line placeholder (was an empty line). Summary and tables already matched. |
| Settings › Team | Already matched (DataTable). |
| Settings › Plans | `PlanCardSkeleton` (in `PlanCard.tsx`): title + version, status chips, price with the real "/ month", yearly line, the six real limit labels, stores line, Edit / ⋯ places. |
| Settings › Billing rules | The section used to show the default rules (disabled) until the settings answered. It now shows `SettingsCardsSkeleton` cards with the real titles (Payment provider, Grace period, Renewal reminders, Overdue payments) and renders the Invoice issuer and Sent reminders cards as they are (they load on their own). Sent reminders and job runs rows copy their loaded rows. |
| Settings › AI | `SettingsCardsSkeleton` with the form's real card titles and descriptions (Assistant, Spend, Limits, Night window, Model prices) and field places. |
| Settings › Audit log | Already matched (DataTable). |
| Settings › Discounts | Was 5 bare skeleton rows in a box. Now the real `CouponsTab` table (toolbar, columns) with DataTable's skeleton rows (`isLoading` prop added). |
| Settings › Profile & security | Sessions table already matched. Browser notifications: one-line placeholders at the label size. |

## Judgement calls

- Where labels come from the data (snapshot tab summary labels and breakdown titles), the skeleton keeps the frame
  with placeholder labels rather than guessed text.
- Settings skeleton card lists (AI, Billing rules) and the plan card labels are copied from the loaded markup; if
  those change, change the skeleton next to them.
- Invoice issuer card still shows its (empty) form disabled while platform settings load: it is blank, not wrong
  numbers, so it was left.
- Dialogs and side panels outside the page list (Change plan, Plan editor, Notifications, Ask Zcom) were not changed.

## Kit notes (SYNCED files, not changed)

- `SummaryPanel` hides each cell's note line while `isLoading`, so the cell grows by one line when the data comes. A
  note-line placeholder in the kit would remove that.
- `DataTable` always shows 10 skeleton rows on a first load (`SKELETON_ROW_COUNT`). Small tables (Totals by currency,
  Webhooks by provider) would match better with a `skeletonRows` prop.

## Checks

- `npx tsc -b`: passes (midway and at the end).
- `npm run lint:hex`: 0 raw colours.
- `oxlint` on the 42 touched TS files: 0 errors; 5 warnings, all pre-existing in untouched lines
  (`set-state-in-effect` in ClientDetail / BillingRulesSettings / PlansSettings, `only-export-components` in
  StorePaymentsCard).
- No tested utilities were touched, so no vitest run.
