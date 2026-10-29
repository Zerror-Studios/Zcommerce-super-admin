# 08 · Fixes and real screens (v1.2)

**Version 1.2 · 24 Oct 2026 · Merchant Admin + Super Admin**
Add this file and the images `reference/11` to `reference/23` to `docs/design/`. It builds on v1.0 (`01–06`) and v1.1 (`07-expression.md`, `tokens-expression.css`).

---

## 0. Read this first (Claude)

The v1.0/v1.1 restyle is live. We reviewed it screen by screen (recording, 23 Oct). Verdict: **clean and systematic, but in many places things are still not well designed or are visibly breaking** — oversized controls, misplaced sections, overlapping names, empty halves of pages, inconsistent icons, dull buttons. This file lists **every one of those problems and the exact fix**, and gives **13 reference screens drawn with the store's real product photos** so there is no guesswork.

Rules:
- This is still a restyle: keep every feature, field, route and API. Only layout, components and wording change.
- The reference screens are the target. Where a screen shows something your code doesn't have (e.g. a channel that isn't integrated), **skip it and list it** — don't invent features.
- Work through §1 (global) first, then §2 (page by page). Fix each item **everywhere it occurs**, not just on the page named.
- Report after each section with 1440px and 390px screenshots.

Reference images:
| File | Screen |
|---|---|
| `11-home.png` | Merchant Home (final, real photos) |
| `12-orders-list.png` | Orders list — tinted header, tabs with counts |
| `13-product-editor.png` | Product editor — the most important fix list |
| `14-image-detail-panel.png` | **New:** image detail panel (click any photo) |
| `15-choose-media.png` | Choose media dialog |
| `16-payment-detail.png` | Payment detail |
| `17-settings.png` | Settings index |
| `18-collection-editor.png` | Collection editor |
| `19-templates.png` | Campaign templates (SMS/Email/WhatsApp) |
| `20-analytics-behaviour.png` | Analytics › Behaviour, navigation flow redrawn |
| `21-blog-editor.png` | Blog post editor |
| `22-blog-insert-image.png` | Blog editor — inserting an image |
| `23-help-and-learn.png` | Help & learn |

---

## 1. Global fixes (apply everywhere)

### 1.1 Support banner ("Zerror support is signed in…")
- **Problem:** sits inside the page under the padding, pushes content, can't be closed.
- **Fix:** a **36px full-width strip at the very top of the window**, above the sidebar and page (`position: sticky; top: 0`). Amber (`--warning-bg` #FFF4E5, text #7A4B00, bottom border #F6E2C2). Shield icon · "You're viewing **{Store}** as Zerror admin. Changes are logged." (owner 2026-10-29: nothing after it, no email or reason) · **Exit** link · **×** to hide for this session (remember in sessionStorage; the Exit link stays available in the user menu). Ref 13.

### 1.2 Buttons that should have colour
- **Problem:** everything is grey/white; the eye has nowhere to go.
- **Fix:** the primary action on every page/card is **filled blue** (`--accent`): Save, Publish, Create order, Add product, Review orders (in the brief), Use this (AI), Add 2 images, Send reminder. Never more than one filled button per card/header. Secondary = white with border; tertiary = ghost. **Cancel is ghost, never red.** Destructive (Delete, Remove) = white with `--critical-border` and red text.

### 1.3 AI must look like AI
- **Problem:** "Write with AI" and the suggestion look like any other grey control.
- **Fix:** every AI control carries the **spectrum**: `.btn.ai` = white button with a 1px spectrum gradient border + sparkle icon in gradient. The AI **suggestion** follows the chat pattern in `09` §2A (one message, two buttons, one "ask for changes" input) — never a toolbar of chips. While generating, use `.ai-live` (rotating edge + shimmer). Ref 13, 21. Final card spec in `09` §2A. Tokens in `tokens-expression.css`.

### 1.4 User row and account menu
- **Problem:** sidebar shows the email; menu items are plain.
- **Fix:** avatar (gradient initials or photo) + **name** + "{Store} · {Role}" (no email). Clicking opens the menu: Account · Switch store (if >1) · Login history · Keyboard shortcuts · Help · **Log out in red** (`--critical-fg`) after a divider.

### 1.5 Page header + search: one pattern on every page
- **List pages (top-level):** tinted header card (v1.1 §6): 44px icon tile in section colour → **H1 22/600 + muted count** → one live summary line → actions right (one primary). Below it the table card: **tabs left, search + Filter · Sort · Columns right in the same row**. Search field: 34px, 240px wide, 15px icon, placeholder "Search {things}". Ref 12.
- **Detail/editor pages:** back link "← {Parent}" (13px) → H1 22/600 with status badge + one-line meta → actions right (Preview ↗, Cancel/Duplicate ghost, **Save** blue). No tinted header. Ref 13, 16, 18, 19.
- **Dashboards (Home, Analytics, Help):** header per v1.1; the date control is a **secondary button with the 15px calendar stroke icon**, never an emoji or filled calendar graphic. Ref 20.
- Search in the sidebar and in page headers use the **same component** (icon, radius 8/9, placeholder colour). No other search styles.

### 1.6 Iconography
- One icon set only (the 1.75px stroke set already used in the sidebar). **No emoji anywhere in the UI**, no filled or illustrative icons inside buttons. Tabs/segmented controls never mix icon styles.
- Tiny controls on images (cover tag, edit, delete, remove, drag handle) are **20–22px**, radius 6, white at 92% over the image. Ref 13, 18.

### 1.7 Cards: no stray space
- **Problem:** Settings cards (and others) have an extra empty line / uneven bottom padding.
- **Fix:** card body padding is exactly `16px 20px 20px`; a card ends with its last row — no trailing empty element. Rows in list cards are 52–56px with a 1px `--divider`. Audit every card for an empty last child.

### 1.8 Grid / list toggle
- Wherever a set of products or items is shown as tiles (collection products, lookbooks, media library, apps), add a **grid/list segmented toggle** (28px, two icons) at the top-right of that card; remember the choice per page in localStorage. Ref 18.

### 1.9 Density of image grids
- Product/collection image tiles: **5–6 per row** at 1440 (minmax 150px), square, radius 10. The card takes the full width when there are more images; the drop zone is **one tile**, not a wide band. Ref 13, 18.

---

## 2. Page-by-page fixes

### 2.1 Home (ref 11) — FINAL layout, replaces v1.1 §4
Top to bottom, all inside the normal page padding, 16px gaps:
1. **Welcome banner** (radius 20, 1px `#E1E7F8` border) with a *light* gradient `linear-gradient(110deg,#EAF0FF,#EEF1FF 60%,#F3EEFF)`, a faint dot pattern fading in from the right, and two soft colour blooms (violet 28%, blue 18%). **Never a dark or saturated block.** Left: date 13/500 muted → **"Good morning, {first name}" 30/38/600** (morning/afternoon/evening by local time) → one live sentence ("{Store} is open · 18 orders already today — your busiest Saturday this month"; fall back to "Here's how {Store} is doing today" when there is nothing notable). Right: `Last 30 days ⌄` and `View store ↗` secondary buttons. Below, four **stat tiles** (white 72% with 1px white border, radius 12): **Orders today · To ship (sub-line: courier pickup time) · Sales today (sub-line: avg order) · In the store now (live visitors · open carts)**. These are today's operations numbers, not 30-day totals — that is what an owner wants on login.
2. **Needs attention + Today's brief**, side by side, equal height (`align-items: stretch`). Needs attention: card with 36px count tiles in section colours — Orders to ship, Awaiting payment, Out of stock, Reviews to reply (only rows with a non-zero count; "N things" top right). **Today's brief**: `.ai-edge` card, spectrum avatar + "Today's brief" + "Ask AI →" link top right; **three lines max** at 15/23, each `**bold what to do** — muted why` (e.g. "Pack 12 orders before 4 pm — that's when Delhivery picks up"); actions at the bottom: one blue + up to two secondary (Ship orders · Restock · Plan a campaign). No ask box inside the brief; the Ask AI link opens the panel. The brief is about **operations** (shipping cut-offs, stock running out, best selling day with nothing planned, abandoned carts), never about payment reminders or generic encouragement.
3. **Revenue + Top products**, half and half (`flex: 1 1 420px` each). Revenue: 30/90/Year segmented control, gradient area chart, dashed previous period. Top products: **four** real photos in a row, name (ellipsis) + sold count, "View all".
4. **Learn Zcom strip**: three video cards (96×60 thumbnail, title, duration · section) + a "Stuck? Talk to Zerror" cell with a **WhatsApp us** button (green WhatsApp mark). Link "Help & learn →".
Celebration toast (first sale of the day etc.) per `07` §6 still floats bottom-centre; no floating ask bar on Home any more.

### 2.2 Products list (ref 12 pattern)
- Thumbnails 40px with real photos; Filter/Columns ghost; nothing else changes.

### 2.3 Product editor (ref 13) — fix in this order
1. **Media card:** 6 tiles per row (5 photos + "Add or drop" tile). "Cover" tag 10px on the first image; **edit/delete 22px** icons appear on hover only. Sub-line "First image is the cover. Drag to reorder." Button "Choose from library" (ghost) top-right.
2. **Clicking a photo opens the Image detail panel** (§2.4). Today nothing happens / icons are too big.
3. **Section order (main column):** Media → Details (Name, Badge, Description) → **Pricing** → Variants → **Additional info last**.
4. **Pricing:** Price · Cost per item · Profit · Margin in one row; Profit and Margin are read-only tinted fields in green; **no number spinners** (`appearance: textfield`, hide `::-webkit-inner-spin-button`); ₹ prefix inside the field; **"On sale" toggle at the top-right of the card**; "Charge tax" switch below.
5. **Write with AI:** `.btn.ai` beside the Description label. The suggestion appears **below the editor box, not inside it**, as the AI chat card in `09` §2A: spectrum avatar · "Here's a more premium version of your description:" · the text at 14/22 · **Use this** (blue) · **Keep mine** (ghost) · a rounded "Ask for changes… e.g. make it shorter, add care notes" input with a dark send button. 12px gap from the editor. No chips, no Try again/Discard row.
6. **Variants:** options shown as chips in one row ("Size · XS S M L XL · Edit · + Add option"); the combinations table has columns Variant · Price · Stock · Cost · SKU · Status; stock states coloured ("0 — out of stock" red, "3 left" amber); cells editable inline; "Link media" ghost top-right.
7. **Side column, each its own card:** Status (Published / Hidden / Draft with one-line hints) · **Product type** (separate card) · **Sales channels** · Organisation (Collections as chips, Tags) · **Search listing** · Discount.
8. **Sales channels:** list every channel the store can have: Online store, Amazon, Instagram shop, Flipkart, … Each row = channel icon tile · name · "connected" / "Set up" link · **toggle** (only when connected). Footer link "Add more channels in Apps & channels →". Show only channels that exist in the integrations module; status comes from it.
9. **Search listing:** a **Google result preview** in its own bordered box (radius 12): grey top bar with the **Google "G" logo** (22px, official four colours) and a rounded search pill showing the likely query; below, the result set in **Arial** (Google's own font, the one place we don't use Geist): 26px favicon circle with the store initial, site name 14px `#202124`, URL 12px `#4D5156`, title 20/26 `#1A0DAB`, description 14/22 `#4D5156` with the date prefix in `#70757A`. Caption below: "Title 46 / 60 · Description 128 / 160 · Google uses its own font for results". "Edit" opens the SEO fields inline. Ref 13.
10. Header: 40px product thumbnail · name + Active badge · meta "Tops · 5 variants · 142 sold this month" · Preview ↗ · Duplicate · **Save** (blue, min-width 96px).

### 2.4 Image detail panel — **new** (ref 14)
Right drawer, 560px, opens from any product/collection/blog image:
- Header: file name · "Image 2 of 5 · 1200 × 1600 · 388 KB · JPG" · ‹ › to move between images · ×.
- Large preview (dark letterbox, Fit/Fill toggle).
- Action row: **Set as cover** · Replace · Crop · Download · (spacer) · Delete (destructive).
- **Alt text** field with counter and `.btn.ai` "Write for me".
- File name (mono) · Folder select.
- "Used in" list (product, blog cover…) with Open links.
- Meta: Uploaded by/when · Dimensions · Size (+ "optimised to WebP on the store") · CDN link (copy).
- Footer: Cancel · **Save changes**.
Use existing media fields only; hide rows whose data doesn't exist.

### 2.5 Choose media dialog (ref 15)
- **1180 × 820** (was ~900 wide), radius 16. Header: title · "{Store} · 48 files" · search 260px · All/Images/Videos segmented · **Upload (blue)** · ×.
- Left: folders 220px with counts (All files, Products, Collections, Banners, Blog, Recently deleted, + New folder).
- Grid **5 per row**, square thumbs, 2px blue ring + check when selected; **file name truncates with ellipsis on one line**, meta "1200 × 1600 · 420 KB" below — names never overlap. Folders are tiles with a folder icon.
- Footer: selected thumbnails stacked · "2 selected" · Clear · Cancel · **Add 2 images**.
- Remove the empty "Site files / Quick actions / Information" right panel.

### 2.6 Collections list and editor (ref 18)
- List: card tiles with the collection image, name, count; grid/list toggle.
- Editor: section label **"Banner image"** (not "Image") with hint "Shown at the top of the collection page. Best at 2400 × 600." Replace/Remove as ghost top-right; banner shown 4:1 with a size tag.
- Products: **5 per row**, tile = photo + name + "₹ · variants" footer; **20px × remove button** and **20px drag handle** on the image (top corners), `aria-label="Remove {name} from collection"`; "+ Add products" dashed tile at the end and a ghost button in the card header; **grid/list toggle**.
- Side: Featured (switch) · Search listing (Google preview) · Discount.

### 2.7 Orders list (ref 12) and Order detail (ref 24)
- **List:** tinted header with live line "12 to ship today · 2 awaiting payment · ₹4,417.34 in shipping wallet"; "Shipping wallet" secondary, **Create order** blue. Tabs with counts; order number mono; customer with gradient avatar; AWB mono; "Ship now" small secondary per row (keep — it is the main action of this page), "Track" ghost for in-transit.
- **Order detail — classic layout (ref 24):** header C: ← Orders · **Order #000057** + Paid + Unfulfilled badges · meta "21 Oct 2026, 11:50 am · Online store · Customer" · Print · Refund · ··· · **Ship now** (blue). Main column: **1 · Fulfilment card** (badge + "2 items", location top right; items with 44px photos, variant/SKU, qty, price; footer: Print packing slip · **Ship now · {Courier}**) → **2 · Payment card** (Paid badge + method, "View payment →"; Subtotal · Shipping · Tax (included) · Total · Paid by customer) → **3 · Timeline** (note input with Post, then events latest first with the green dot line). Side column: one **Customer** card (avatar, orders · lifetime, email, phone, **Ships to** block with Same as billing · Edit, **Notes & tags** block). Fulfilled orders swap the Ship now footer for the AWB + Track link; partially fulfilled show two fulfilment cards.

### 2.8 Payment detail (ref 16) — four cards, payment first
- **Problem:** the page opened with the order, and the payment was split over eight cards.
- Header C: green check tile · **amount + Paid badge** · meta "Payment · {Store} · via {Partner} · {mono id ⧉}" · Download receipt · Send receipt · **Refund**.
- Main column: **1 · Summary card** — four columns with hairlines: *Paid by* (avatar, customer, method + UPI id/bank) · *Merchant* (store, domain) · *Partner* (gateway chain, fees · net) · *Time* (date/time, settlement date · T+n · payout account); the card's **footer strip** (`#FAFAFB`) holds the status steps Initiated → Authorised → Captured → Settled (green checks + times, grey ring for pending; failed shows a red step where it stopped). **2 · Payment details** — key–value: transaction id, gateway order id, bank reference (mono + copy), amount + currency + tax included; the **refund line** sits at the bottom of this card ("Nothing refunded · refund part or all of ₹… until {date}" with a small Refund button; refunds already made list here as rows). **3 · Order #** — items with 44px photos, one-line totals, "View order →".
- Side column: **one Customer card** — avatar, orders · lifetime, email, phone, **Ships to** block. No separate Address, Refunds or Activity cards.
- Rule for every money detail page (payment, payout, refund, Super Admin invoice): who/where/through whom/when first, status second, ids third, related object last; customer on the side.

### 2.9 Settings (ref 17) — **superseded by `09-settings-and-scale.md` §1**
- Settings is now a left panel of sections with the chosen section's content on the right (Shopify style). Follow `09` for the layout; the section list, icons, badges and live detail lines described in `09` §1 replace the two-column grouped list that was drawn earlier.

### 2.10 Marketing › Campaigns (ref 25, 26) — channel hub, then one page per channel
- **Problem:** templates and campaigns were mixed into one cluttered page; Templates was wrongly placed under Settings in an earlier draft. Campaigns live under **Marketing › Campaigns**.
- **Campaigns hub (ref 25):** tinted coral header "Campaigns {n}" + live line "₹… attributed this month · 3 channels connected"; header actions `Templates` and `Automations` (ghost) and **+ New campaign ⌄** (blue; the dropdown asks for the channel: Email / SMS / WhatsApp, each with audience size and cost per send). Below: **three channel tiles** (Email blue, SMS violet, WhatsApp green gradients; icon, status pill "Connected / DLT approved / Set up", name, three numbers, "Open Email →"). Then two cards: **Recent campaigns** (channel icon tile, name, sub-line, status badge, result) and **Automations** (same rows with a toggle and a result). A channel that is not set up shows a grey tile with "Set up" and links to Apps & channels.
- **Channel page (ref 26)** — e.g. Marketing › Campaigns › Email: header C (← Campaigns · channel icon tile · "Email" · live line "4,120 subscribers · 46% average open · 8 campaigns · 3 automations on" · `Draft with AI` · **+ New email**). Then the **two-pane card** (`09` §2B): left pane with a search field and three groups — **Campaigns** (latest 3 + "All n campaigns →"), **Automations** (On/Off dot + meta), **Templates** (+ "New template" dashed row). No tabs. Right pane: the selected item — for a template/automation: H2 + badge + one line, toggle + ··· ; **Content** card (Subject, Preview text, Body with tinted variable chips, "Insert: …", Improve with AI, Save · Send test to me) beside a **Preview** card (Desktop | Mobile for email, Phone | Text for SMS/WhatsApp, real rendered message); **Sending** card (Trigger · Delay · From, or Send to · When · Sender ID). For a campaign: the same Content/Preview plus Audience and Schedule cards and a results strip (sent · opened · clicked · revenue) once sent. SMS and WhatsApp pages are identical with a phone preview and character/segment counter.
- The old "Templates" page is removed as a route; templates are reached from each channel page (and from "Templates" in the hub header, which opens the channel picker first).

### 2.11 Analytics › Behaviour (ref 20)
- **Problem:** scrollbar overlapped the numbers; the flow chart was hard to read; only one card.
- **Fix:** navigation flow redrawn as **"How visitors move through your store"**: columns "Landed on → Then → Then → Then", each step a 150px node (3px coloured bar, page name, "77% · 24 visitors"), amber ribbons between steps, a red callout "29% left after the first page · 9 visitors, mostly from Instagram on mobile". The chart scrolls **inside its own box with the scrollbar below the chart**, never over labels; hint "Scroll sideways to see more steps →". Segmented control **All visitors / Mobile / Desktop** (consistent with other segmented controls — drop "Top paths / By landing page").
- Add cards from data that already exists: **Devices** (stacked bar), **Where visitors leave** (exit rate bars), **Top clicks**, **Form submissions** (views / started / submitted + a hint). Top pages card keeps the Visits/Time/Exits segmented control.
- Date control per §1.5 (stroke icon). One Insight card (AI) per page.

### 2.12 Blog post editor (ref 21, 22)
- **Problem:** tiny icon rail on the left, floating title, unclear where things are.
- **Fix:** header bar: ← Blog posts · title · "Draft · saved just now" · word count · Preview ↗ · Save draft · **Publish**. **Left bar 232px with labelled tools:** Write, Cover image, Category & tags, Author, Search listing, Schedule; "Insert" group: Image, Product, Quote, Divider; `.btn.ai` **Improve with AI** at the bottom. Centre: 720px article with cover photo (hover "Change cover"), tag chips, 36px title, lede, author row, body 17/29, **floating formatting bar** sticky at the top; a **product card block** (photo, name, price, Shop) can be inserted. Right 300px: Status, Category, Tags, Author, Search listing, Publish now / Schedule.
- **Insert image (ref 22):** inline popover under the cursor with tabs **Library / Upload / From link**, a 5-tile library grid, **Alt text**, Caption, **Size** (Small / Text width / Wide), **Link to** (product or URL), Cancel · **Insert image**. Same popover pattern for Product (search products) and Quote.
- Everything the current editor can do (headings, lists, links, code, undo/redo, SEO, scheduling, categories, tags, writers) must still be reachable from the left bar, the formatting bar or the right panel. List anything that doesn't fit.

### 2.13 Help & learn (ref 23) — FINAL
- **Header B** like every other page: slate tile with the ? icon · "Help & learn" · one line · "Search tutorials and questions" field right. **No hero, no topic chips.**
- **Set up your store** card: progress bar top right ("3 of 5 done"), then **five set-up cards** in a row (min-height 124px): icon state (green check / blue ring for the next step / grey ring) + **title 14/600** + a one-line **description** of what it is for ("Photos, prices, sizes and stock — the things people buy.") + footer ("Done" / blue "Watch 1:50 →" / "Connect →"). The next step is outlined blue. Steps: Add your products · Take payments · Set up shipping · Send your first campaign · Sell on Instagram — map to whatever onboarding flags exist; hide the card once all are done.
- **Video tutorials**: a 4-up grid of smaller cards (thumbnail 112px tall, section-coloured mock screen, play button, duration; tag · title · one line). "Watch in order →".
- **Now playing** card: the selected video large on the left (16:9, dark gradient caption, chapter pills under it) and **Steps in the video** on the right (numbered 22px blue circles, one line each). Clicking any thumbnail swaps this card.
- **Common questions** list + **Talk to Zerror** card (avatar, "Usually replies within an hour", one line, **Message on WhatsApp** with the green WhatsApp mark, **Email support** ghost with envelope icon).

### 2.14 Super Admin
- Apply §1 everywhere (banner isn't shown there; header/search pattern, buttons, icons, cards).
- Store detail gets the same two-column editor layout as the product editor; Billing › Collections and Settings › Payment reminders use the two-pane list + detail pattern from §2.10 where a list drives a detail.

---

## 3. Order of work
1. §1.1–1.9 global (banner, buttons, AI style, user row, header/search, icons, cards, grid/list toggle, image density)
2. Product editor (§2.3) + Image detail panel (§2.4) + Choose media (§2.5)
3. Collections (§2.6), Orders list + Order detail (§2.7), Payment detail (§2.8), Settings (`09` §1)
4. Campaigns hub + channel pages (§2.10), Behaviour (§2.11)
5. Blog editor + insert popovers (§2.12), Help & learn (§2.13)
6. Super Admin pass (§2.14), then the QA list below

## 4. QA additions
- [ ] Support banner is a full-width top strip with Exit and ×; hidden state persists for the session
- [ ] Exactly one filled blue button per card/header; Cancel never red; Log out red in the menu
- [ ] Every AI control shows the spectrum border/sparkle; suggestion card has tinted background and Use this / Try again / Discard
- [ ] Sidebar user row shows avatar + name + store/role, no email
- [ ] Every list page: tinted header → tabs left, search + Filter/Sort/Columns right; every detail page: back link → title → Save; identical search component everywhere
- [ ] No emoji or mixed icon styles; image controls ≤ 22px
- [ ] No card has trailing empty space
- [ ] Product editor section order and side cards match ref 13; Google preview present; channels list driven by integrations
- [ ] Clicking a photo opens the image panel (ref 14); Choose media matches ref 15 with no overlapping names
- [ ] Collection products 5 per row with 20px controls and grid/list toggle; "Banner image" label
- [ ] Campaigns hub has the three channel tiles; each channel page is the two-pane card with Campaigns / Automations / Templates groups and a live preview
- [ ] Home banner is light; stat tiles show today's numbers; brief has ≤3 lines and no ask box; Revenue and Top products are equal width
- [ ] Payment detail is four cards (summary+status, details+refund, order, customer); Order detail is fulfilment → payment → timeline with one customer card
- [ ] Help & learn: header B, 5 set-up cards with descriptions, 4-up videos, Now playing + steps
- [ ] Behaviour flow scrolls inside its box; scrollbar never covers numbers; extra cards present
- [ ] Blog editor has the labelled left bar and the insert-image popover
- [ ] All v1.0 and v1.1 checklist items still pass
