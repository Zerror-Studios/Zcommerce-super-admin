# Design v2: later list

Agreed with Ayush on 5 Nov 2026. These are not started; pick them up from here. Each needs a go-ahead before work begins. Items marked **Backend** also need a PRD in `Zcom-backend/docs/prd/`.

## 1. Dashboard animation kit (frontend only, about 1–2 hours)

Shared kit pieces built on `framer-motion` (already a dependency). Transform and opacity only (v2 §2.4); every piece switches off under reduced motion. Each plays once, when a thing first appears, never on a data refresh. Everything stays under 250 ms except chart draws.

| Piece | Behaviour | Used on |
|---|---|---|
| Page enter | fade in and rise 8 px, 200 ms | every page (once, in the app frame) |
| Stagger group | cards appear 40 ms apart, at most 6 | Home rows, Analytics cards, Settings section cards, Help videos |
| Count-up number | 0 → value once, 600 ms, keeps the ₹ format | summary panels, Home chips, Analytics tiles |
| Chart first-load | bars grow from the bottom, lines draw left to right, 500–700 ms, first load only | Home Sales by day, summary mini charts, Analytics charts |
| Sliding pill | the selected tab or switch pill glides (`layoutId`), 200 ms | toolbar tabs, period tabs, Payments \| Refunds, table \| cards |
| Skeleton to content | crossfade, 160 ms | lists, cards, record pages |
| List row in/out | new rows fade in; removed rows fade and collapse | Inbox list, notifications drawer, filter chips, group rule rows |

Show each piece on `/dev/ui` and wire it into the main pages of both apps.

## 2. Switching from the Super Admin into a store's admin (frontend; small backend check)

**Today:** "Open store admin" in the console (store detail, Stores list) mints a two-minute, single-use pass and opens the store admin in a new tab with the pass in the URL. The store app (`components/AuthProvider.tsx`, `lib/impersonation.ts`) swaps it for a support session, then shows the shell with `ImpersonationBanner`. While that happens the user sees only the plain loading screen.

**Wanted:** a proper handover, so it's clear where you're going and that you're in support mode.

1. **Console, on click.** The button shows the orb in its "thinking" state and "Opening ‹Store name›…". If minting fails or a pop-up blocker stops the new tab, show a plain message with "Try again" and "Copy link" instead of failing silently.
2. **Store app, the arrival screen** (the black v2 sign-in look, §5, with the orb).
   - The title is "Opening ‹Store name›" and the line under it is "Signing you in as Zerror support".
   - Three short steps tick in order: *Checking your access → Signing you in → Loading the store*. These follow the real stages: pass read, session exchange, first data load.
   - The orb spins fast while it works, then shows its "done" tick.
   - Hold it for at least about 600 ms so it doesn't flash, then fade into the store's Home.
3. **Failure states**, in plain words, with what to do next (§10A error recipe):
   - Pass expired or already used: "This link has expired. Go back to the console and open the store again."
   - Store suspended: say so.
   - No network.
4. **Arriving in the store.**
   - A toast: "You're in ‹Store name› as Zerror support. Everything you do is logged."
   - The existing support banner stays at the top, restyled to v2: amber tint, with "Exit support session".
   - "Exit support session" shows "Leaving ‹Store name›…" and returns to the console tab, or closes the tab.
5. **Store switcher in the menu** (merchants with several stores): the same arrival screen with "Opening ‹Store name›" when switching from the store chooser.
6. **Backend check:** whether the store's display name can be read before the session exists (so the first frame can name the store). If not, show the store handle first and swap in the name once the session loads.

## 3. Other items deferred on 5 Nov 2026 (need backend, PRD first)

- **Two-step login for store staff.** Today only Zerror platform users have it. Once built, show the Two-step column in Settings › Team and on the console's store Team tab.
- **Support tickets:** store My tickets and Raise a ticket (board 44), console Support › Tickets and Announcements (board 45), and Help › What's new.
- **Weekly ad spend** for the "Back for every ₹1" weekly chart (Analytics › Marketing), and spend per source.
- **AI campaign writer** ("Write one with AI", board 26).
- **Order and Customer import** (the ⋯ menus).
- **Board extras with no data yet:**
  - Sold · 30d and Revenue · 30d per product
  - Collection visits; Lookbook views and shop taps; Blog reads
  - Customers "Slipping away" group
  - log out on other devices
