# PRD-033 — Staff notifications and web push (pointer: zcom-super-admin)

| Field | Value |
|---|---|
| Status | **Approved** 2026-11-05 (owner: "Approve with recommendations", D1–D8) · **Implemented** 2026-11-05 (console side of Step 2; working tree; not committed, deployed or run in a browser; deploy the backend first) |
| Source-of-truth PRD | [`../../../zcom-backend/docs/prd/PRD-033-staff-notifications-and-web-push.md`](../../../zcom-backend/docs/prd/PRD-033-staff-notifications-and-web-push.md) |
| Created / Updated | 2026-11-05 / 2026-11-05 |
| Related | PRD-024 FR-4.1 (the console notifications feed, unchanged), FR-4.3 (Settings › Profile & security) |

Requirements, contract and decisions live in the source-of-truth PRD. This repo implements the console side of **FR-2.6–FR-2.9** (browser push). The bell and its feed (PRD-024) are unchanged: push is an extra, opt-in channel for the WARNING and CRITICAL items the backend already records.

## UX notes (this repo)

- **Where:** Settings › Profile & security › **Browser notifications** card (between Change password and Sessions; searchable as "Browser notifications" / push). The card is **hidden** while `platformWebPushConfig.enabled` is false (the backend has no VAPID keys); a skeleton while it loads, an inline error with Retry when the config query fails.
- **States for this browser (FR-2.8):**
  - **Not supported**: no service worker, Push API or Notification API.
  - **Add to Home Screen first**: iPhone and iPad (iPadOS is detected as a Mac with touch) outside the home-screen app; iOS 16.4+ allows push only there.
  - **Blocked in this browser**: permission denied, with one line on allowing it in the site settings.
  - **Enable notifications** button when supported and not subscribed (shows how many other browsers are registered).
  - **On this device** chip with the registered browser count and "Turn off on this device".
- **Enable:** asks for permission first (inside the click, so Safari keeps the gesture), registers `/push-sw.js` (scope `/`), subscribes with `userVisibleOnly` and the base64url public key (a subscription made with another key is replaced), then `platformRegisterPushSubscription` with the endpoint, `p256dh`, `auth` and `navigator.userAgent`. If the server refuses, the browser subscription is removed again so the two stay in step.
- **Disable:** `platformRemovePushSubscription(endpoint)`, then `unsubscribe()`.
- **Preference:** "Notify me about" select: Only urgent (CRITICAL, the default, D3), Urgent and warnings (WARNING), Off (OFF); saved on change through `platformSetPushPreference`, applies to every browser of the user.
- **Test (FR-2.9):** "Send a test notification" (only while this browser is on) shows "Test notification sent to N browsers" or "No browser received it…"; `RATE_LIMITED` says "You can send 5 test notifications an hour. Try again in N minutes." from `retryAfterMs`.
- **Errors:** `PUSH_NOT_CONFIGURED`, `INVALID_PUSH_SUBSCRIPTION`, `INVALID_PUSH_PREFERENCE` have console copy; a denied prompt (`NotAllowedError`) shows the blocked line; other browser failures a generic "This browser couldn't turn on notifications" line; everything else goes through `mutationFailureCopy`.
- **Silent refresh (FR-2.2):** once per app load, when the browser already has a subscription made with the current key and permission is granted, `DashboardLayout` re-sends it (`useWebPushRefresh`); errors are ignored and nothing prompts.
- **Service worker (FR-2.7):** `public/push-sw.js` shows `{title, body, tag}` with `/favicon.png` as the icon and on click focuses a window already at `url` or opens it. Only same-origin URLs are opened (anything else opens the console root). No caching, no fetch handler.
- **CSP:** unchanged. `vercel.json` has no `worker-src` or `child-src`, so the worker falls back to `script-src 'self'`, which allows the same-origin `/push-sw.js`; the icon is `img-src 'self'`. `src/lib/vercel-csp.test.ts` now checks this.

## Implementation log (this repo)

| FR | Files |
|---|---|
| FR-2.7 | `public/push-sw.js` |
| FR-2.8, FR-2.9 | `src/components/settings/BrowserNotificationsCard.tsx`, `src/components/settings/ProfileSecuritySettings.tsx`, `src/components/settings/settings-sections.ts` (search entry), `src/hooks/use-web-push.ts` (`useWebPush`), `src/lib/web-push.util.ts` (key conversion, device state, register input, copy) and `src/lib/web-push.util.test.ts` |
| FR-2.2 | `src/hooks/use-web-push.ts` (`useWebPushRefresh`), `src/components/layout/DashboardLayout.tsx` |
| Contract | `src/graphql/notifications.ts` (`PlatformWebPushConfig`, `PlatformMyPushSettings`, `PlatformRegisterPushSubscription`, `PlatformRemovePushSubscription`, `PlatformSetPushPreference`, `PlatformSendTestPush`), `src/types/platform-api.ts`; `src/lib/vercel-csp.test.ts` (worker CSP) |

**Checks (2026-11-05):**
- `tsc -b` clean.
- vitest: **346 in 53 files** (+17: 16 in `web-push.util.test.ts`, 1 CSP worker test).
- oxlint: exit 0, 40 warnings, all pre-existing (none in the new files).
- `lint:hex` 0; `lint:px` 28/36; `check:synced` 61 files, 0 differ; `validate:ops` 0 invalid.
- `npm run build` (with `VITE_GATEWAY_URL` set) passes; `dist/push-sw.js` is emitted.
- zcom-backend `validate:clients --all --write`: zcom-super-admin **127/127**, 0 failures (manifest regenerated).
- Not run in a browser; no push has been received end to end.

**Open:** the console has no web app manifest, so on iPhone and iPad "Add to Home Screen" may not open it as a standalone web app, which iOS needs for push (owner decision: add a minimal `manifest.webmanifest` with `display: standalone`).
