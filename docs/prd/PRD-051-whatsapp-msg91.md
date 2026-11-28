# PRD-051 — WhatsApp through MSG91, run from ZCOM (pointer: zcom-super-admin)

| Field | Value |
|---|---|
| Status | **Approved** 2026-11-27 (owner, D13) · **Phases W1, W3 and W4 console built** 2026-11-27 (backend PRD Implemented, every phase) (branch `feat/prd-051-whatsapp-w1`; working tree, not committed, deployed or run in a browser; deploy the backend first) |
| Source-of-truth PRD | [`../../../zcom-backend/docs/prd/PRD-051-whatsapp-msg91.md`](../../../zcom-backend/docs/prd/PRD-051-whatsapp-msg91.md) (contract as built: §5.1, §5.3, §5.4) |
| Created / Updated | 2026-11-27 / 2026-11-27 |

Requirements, contract and decisions live in the source-of-truth PRD. This repo builds the console side of phase W1 in **Console › Messaging**:

- **Work queue:** the `WHATSAPP_ONBOARD` task ("Connect WhatsApp number") with the store's requested number and display name, the checklist, the guided-session steps (Q1) and the webhook URL as copy values; **Done** takes the connected number, the WABA id, the display name and "Meta already approved the display name" (`completeMessagingTask` input `whatsappNumber`, `wabaId`, `displayName`, `displayNameApproved`); **Reject** with a reason lets the store ask again.
- **Accounts:** a **WhatsApp** column (status chip, quality and daily limit, the last refresh's problem) and a **WhatsApp** dialog (`WhatsAppNumberDialog`): status (Connecting once the call is booked), number, WABA id, display name and Meta's review, business verification, limit tier, quality and a note the store sees (`updateMessagingWhatsAppNumber`, only what changed), plus **Refresh health** (`refreshMessagingWhatsAppHealth`). Both need `platform:messaging:manage` and are audited by the server; a drop alerts the store and the console feed.
- **Rates:** a **WhatsApp rates by Meta category** card (Marketing ₹0.95, Utility ₹0.15, Authentication ₹0.15, Service free by default, D13 Q2; `rates.WHATSAPP_CATEGORY`); the old per-purpose WhatsApp row is history and no longer shown.
- Helpers in `lib/platform-messaging.util.ts` (tests `lib/platform-messaging-whatsapp.util.test.ts`), operations in `graphql/messaging.ts`.

## Phase W3 in this repo (FR-11, Q6)

- **Rates › WhatsApp rates by Meta category** gains **"WhatsApp number fee per month (passed through at cost)"**: rupees, sent as `whatsappNumberMonthlyFeePaise` (whole paise, 0–₹10,000; 0 = not charged) with the rest of the form through `updatePlatformMessagingSettings` (platform:messaging:manage; a server `INVALID_INPUT` with `field` marks the field). Checked before the round trip by `numberFeeError`.
- **Rates › WhatsApp number fees** (`components/messaging/WhatsAppNumberFeesCard.tsx`, under the rate cards): `platformWhatsAppNumberFees(month, status, limit, offset)` (platform:messaging:read): store, number's last four digits, Charged / Due chip (Due says why: the message balance couldn't cover it; the daily job tries again), fee, tries, when charged; month picker (YYYY-MM; empty = this IST month on the server), All / Charged / Due tabs, paging, loading, error and empty states.
- Helpers `numberFeeError`, `validNumberFeeMonth`, `numberFeeVariables`, `isNumberFeeTab`, `numberFeeErrorText`, the fee status labels and tones in `lib/platform-messaging.util.ts` (tests `lib/platform-messaging-number-fee.util.test.ts`, 7); operation `PLATFORM_WHATSAPP_NUMBER_FEES` and the settings field in `graphql/messaging.ts`.

## Phase W4 in this repo (FR-13, Q5)

- **Accounts:** a read-only **Moving WhatsApp installs** card (`components/messaging/WhatsAppMoveReportCard.tsx`, `PLATFORM_WHATSAPP_MOVE_REPORT` = `platformWhatsAppMoveReport`, platform:messaging:read): each store still sending WhatsApp through its own MSG91 install, with the number's last four digits, install key set or not, approved / total WhatsApp templates, the sub-account's state and WhatsApp, a Moved / On install / Sample chip and what the move still needs. The move itself is the owner-run backend CLI `messaging-whatsapp-move --apply --store <slug> --yes` (no console button); undo is the existing WhatsApp number dialog.

## Implementation log

- **2026-11-27 · W4 console** (working tree, not committed, deployed or run in a browser; deploy the backend first): as above. Checks: `npx tsc -b` clean; `npx vitest run` 502/502 (68 files); `oxlint src/components/messaging`: no new warnings (one pre-existing); `lint:px` 18/18; backend `validate:clients --all` 179/179.

- **2026-11-27 · W3 console** (working tree, not committed, deployed or run in a browser; deploy the backend first): as above. Checks: `npx tsc -b` clean; `npx vitest run` 502/502 (68 files, +7); `npm run lint` (oxlint) 0 errors, 84 warnings, all pre-existing (none in the changed files); `npm run validate:ops` 0 invalid; `npm run validate:contracts` 178/178, 0 failures; backend manifest refreshed.
- **2026-11-27 · W1 console**: as the sections above.
