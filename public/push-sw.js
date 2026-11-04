/**
 * Console push service worker (PRD-033 FR-2.7)
 *
 * Shows a pushed platform notification and opens or focuses its console
 * link on click. Nothing else: no caching, no fetch handler, no offline
 * mode. The payload is `{ title, body, url, tag }`, `url` an absolute
 * console URL; anything else is ignored.
 */

// ─── Constants ────────────────────────────────────────────────────────────

const ICON_PATH = "/favicon.png";
const FALLBACK_TITLE = "ZCommerce console";

// ─── Helpers ──────────────────────────────────────────────────────────────

function readPayload(event) {
  if (!event.data) return null;
  try {
    const payload = event.data.json();
    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
}

/** Only links on this console's own origin are opened. */
function safeUrl(value) {
  try {
    const url = new URL(String(value), self.location.origin);
    return url.origin === self.location.origin ? url.href : self.location.origin;
  } catch {
    return self.location.origin;
  }
}

// ─── Events ───────────────────────────────────────────────────────────────

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const payload = readPayload(event);
  if (!payload) return;
  const title =
    typeof payload.title === "string" && payload.title
      ? payload.title
      : FALLBACK_TITLE;
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof payload.body === "string" ? payload.body : "",
      tag: typeof payload.tag === "string" ? payload.tag : undefined,
      icon: ICON_PATH,
      data: { url: safeUrl(payload.url) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = safeUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const open = windows.find((client) => client.url === url);
      if (open) {
        await open.focus();
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
