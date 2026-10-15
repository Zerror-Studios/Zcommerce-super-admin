# 06 · QA checklist

Run the relevant parts after every phase and the whole list at the end. Report each item as ✅ / ❌ (with page) in your phase report.

## Nothing lost
- [ ] Every page, route, field, column, filter, action and setting that existed before still exists and works
- [ ] Old URLs redirect to the new ones
- [ ] No API, data, validation or permission logic changed (except the listed display bugs)

## Foundations
- [ ] `tokens.css` is imported once in both apps; no raw hex / px font sizes / radii in page or component files (lint passes)
- [ ] Only Geist and Geist Mono render (check computed styles)
- [ ] Only text sizes 12 / 13 / 14 / 16 / 22 / 26 (18 on login)
- [ ] No ALL CAPS, no weight 700, no exclamation marks

## Shell
- [ ] No top bar; dark sidebar matches ref 01/05/07; no store/plan switcher; no upsell box; no version footer
- [ ] Search in sidebar and ⌘K / Ctrl+K palette work everywhere
- [ ] Notifications count pill shows unread count; panel opens beside the sidebar; items open their record
- [ ] Sidebar collapses (button + ⌘\), state persists; drawer below 1024px
- [ ] 404 renders inside the shell; no "under development" banners anywhere

## Components
- [ ] Buttons: 36px (32 small), radius 8, one primary per view, no pills, Cancel never red
- [ ] Cards: 1px border, radius 12, no shadow, no nested cards, no icon tiles
- [ ] Tables: tabs + search/Filter/Sort/Columns in ONE row; 40px header on `--bg-subtle`; 56px rows; numbers right-aligned and tabular; "···" row menu; filter chips only when applied
- [ ] Badges follow the tone map in both apps; roles and plans are plain text
- [ ] Empty states use the new pattern and copy; no cactus anywhere
- [ ] Toasts bottom-centre, dark, human copy
- [ ] Every search placeholder is page-specific
- [ ] Focus ring visible on every control; whole app usable with keyboard; icon buttons have labels

## Data display
- [ ] ₹ formatting per `05-wording.md` (en-IN grouping, paise only in finance, no "$", no double ₹)
- [ ] Date formats and comparison periods correct (previous period = same length, directly before)
- [ ] Super Admin: one definition for Monthly billing / Earned / Projected / Outstanding used on Home, Billing and Analytics
- [ ] Super Admin: one derived status per store; Payment shown separately; health labels Healthy / At risk / Critical

## Super Admin specifics
- [ ] Home matches ref 07: brief, 4 KPIs, earnings chart with projected months, Needs attention, stores table
- [ ] "Log in" works in one click from Home, Stores, Store detail and ⌘K; opens a new tab; support banner shows; actions logged
- [ ] Store detail tabs Overview · Billing · Activity · Settings; grace period editable

## AI
- [ ] Spectrum used only on AI surfaces
- [ ] Thinking animation runs only while a request is pending and stops when the answer renders; static with reduced motion
- [ ] Ask bar never covers save bars or table footers; opens the assistant panel
- [ ] AI answers show data source + date range and Helpful / Not helpful

## Login
- [ ] Both apps match ref 02; autofill stays dark; errors inline; no red asterisks; logout toast correct

## Responsive
- [ ] Checked at 1440, 1280, 1024, 768, 390; no horizontal page scroll; tables scroll inside their card; toolbars wrap cleanly
