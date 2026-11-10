/**
 * "Log in to store" (PRD-005 FR-10, owner decision 2026-10-18).
 *
 * No dialog and no reason: one click asks the platform for a two-minute,
 * single-use grant and opens the store's admin with it; the store's auth
 * service turns it into an impersonation session that ends after at most
 * one hour and when the platform user is disabled (PRD-014 FR-1.11).
 * Signing in again from the console starts a new one.
 * The tab is opened synchronously on the click (so popup blockers allow
 * it) and pointed at the store once the grant arrives. When the browser
 * blocks it anyway, the toast carries an "Open store" link (a fresh click
 * a blocker allows) instead of reporting success (PRD-014 UX-26); without
 * an admin address from the API the copied link is the full store admin
 * address built from `STORE_ADMIN_URL_TEMPLATE`, never just the fragment.
 *
 * Round 3 A2 (docs/review-r3): "prefetch on intent". Hovering or focusing "Log in to store" asks for the grant
 * ahead of the click (`prepareStoreLogin`), so the click opens the store at once, with no blank tab in between.
 * A prepared grant is used once and only while it has at least `PREPARED_MIN_LEFT_MS` left; otherwise the click
 * asks for a fresh one as before. The grant only ever travels in the URL fragment.
 */

import { addToast } from "@heroui/react";
import { createElement } from "react";
import type { Client } from "../../types";
import { STORE_ADMIN_URL_TEMPLATE } from "../../config/data-source";
import { client as apollo } from "../../lib/apollo-client";
import { IMPERSONATE_TENANT } from "../../graphql/team";
import { mutationFailureCopy } from "../../lib/mutation-errors";
import { storeAdminLink, withStoreName } from "../../lib/store-admin-link.util";
import { toastError } from "../ui";

/** Longest an impersonation session lasts (PRD-014 §5.2). */
export const IMPERSONATION_SESSION_MAX_HOURS = 1;

interface Grant {
  accessToken: string;
  expiresAt: string;
  adminUrl: string | null;
  adminEmail: string;
}

/** Only an https admin URL is opened; http is allowed in dev only (review C-L7). */
function isSafeAdminUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || (import.meta.env.DEV && protocol === "http:");
  } catch {
    return false;
  }
}

/** A link the operator clicks themselves; a popup blocker allows that. */
function openStoreLink(url: string) {
  return createElement(
    "a",
    {
      href: url,
      target: "_blank",
      rel: "noopener noreferrer",
      className: "shrink-0 text-label font-medium text-brand underline",
    },
    "Open store",
  );
}

/**
 * The new tab is blank while the grant is created: give it the store's name and a quiet line, so it doesn't sit
 * empty. Plain text nodes only (no HTML from data); the store admin's own opening screen takes over on load.
 */
function showOpening(tab: Window | null, storeName: string | null | undefined): void {
  if (!tab || tab.closed) return;
  try {
    const doc = tab.document;
    const name = storeName?.trim() || "the store";
    // The blank tab has no stylesheet: copy the token values from this page.
    const tokens = getComputedStyle(document.documentElement);
    const token = (key: string) => tokens.getPropertyValue(key).trim();
    doc.title = `Opening ${name} · Zcom`;
    doc.body.style.cssText =
      `margin:0;height:100vh;display:grid;place-items:center;background:${token("--zc-bg")};` +
      `color:${token("--zc-ink")};font:600 20px/28px Geist,system-ui,-apple-system,sans-serif;text-align:center;`;
    const box = doc.createElement("div");
    const title = doc.createElement("div");
    title.textContent = `Opening ${name}`;
    const note = doc.createElement("div");
    note.textContent = "Getting your admin access ready…";
    note.style.cssText = `margin-top:4px;font-weight:400;font-size:14px;line-height:20px;color:${token("--zc-fg-muted")};`;
    box.append(title, note);
    doc.body.replaceChildren(box);
  } catch {
    // A tab we can't write to still opens the store when the grant arrives.
  }
}

// ─── Prefetch on intent (round 3 A2) ───────────────────────────────────────

/** A prepared grant is used only with this much time left (the grant lives two minutes). */
const PREPARED_MIN_LEFT_MS = 30_000;
/** Hover must rest this long before a grant is asked for (a pointer passing over the button doesn't count). */
export const PREPARE_INTENT_DELAY_MS = 150;

interface PreparedGrant {
  grant: Grant;
  expiresAt: number;
}

/** Grants asked for on hover, per store: in flight, or settled and unused. Each is used at most once. */
const inFlight = new Map<string, Promise<PreparedGrant | null>>();
/** Settled grants, readable synchronously inside the click (a popup blocker needs the gesture). */
const ready = new Map<string, PreparedGrant>();

function requestGrant(storeId: string): Promise<Grant> {
  return apollo
    .mutate<{ impersonateTenant: Grant }>({ mutation: IMPERSONATE_TENANT, variables: { tenantId: storeId } })
    .then(({ data }) => {
      const grant = data?.impersonateTenant;
      if (!grant) throw new Error("empty");
      return grant;
    });
}

function expiryOf(grant: Grant): number {
  const at = Date.parse(grant.expiresAt);
  return Number.isFinite(at) ? at : Date.now() + 120_000;
}

const isFresh = (entry: PreparedGrant | null | undefined): entry is PreparedGrant =>
  !!entry && entry.expiresAt - Date.now() >= PREPARED_MIN_LEFT_MS;

/**
 * Hover or focus on "Log in to store": ask for the store's grant now, so the click can open the store at once.
 * Quiet: a failure here is ignored (the click asks again and reports it). At most one live grant per store.
 */
export function prepareStoreLogin(store: Client): void {
  if (inFlight.has(store.id) || isFresh(ready.get(store.id))) return;
  ready.delete(store.id);
  const pending = requestGrant(store.id)
    .then((grant): PreparedGrant => ({ grant, expiresAt: expiryOf(grant) }))
    .catch(() => null)
    .then((entry) => {
      if (inFlight.get(store.id) === pending) {
        inFlight.delete(store.id);
        if (entry) ready.set(store.id, entry);
      }
      return entry;
    });
  inFlight.set(store.id, pending);
}

/** Takes the store's prepared grant (ready now, or still on its way); never hands the same grant out twice. */
function takePrepared(storeId: string): { now: Grant | null; later: Promise<PreparedGrant | null> | null } {
  const entry = ready.get(storeId);
  ready.delete(storeId);
  const later = inFlight.get(storeId) ?? null;
  inFlight.delete(storeId);
  return { now: isFresh(entry) ? entry.grant : null, later };
}

/** Round 3 F1: short enough for two lines above the AI bar; the email wraps rather than being cut off. */
function openedToast(store: Client, grant: Grant) {
  addToast({
    title: `Opened ${store.storeName}`,
    description: `Signed in as ${grant.adminEmail} for up to ${IMPERSONATION_SESSION_MAX_HOURS} hour.`,
  });
}

export async function logInToStore(store: Client): Promise<void> {
  // A grant prepared on hover: open the store straight away, no blank tab in between.
  const prepared = takePrepared(store.id);
  const early = prepared.now;
  if (early?.adminUrl && isSafeAdminUrl(early.adminUrl)) {
    const direct = window.open(withStoreName(early.adminUrl, store.storeName), "_blank");
    if (direct) {
      direct.opener = null;
      openedToast(store, early);
      return;
    }
    // Blocked: fall through to the usual path (it reports the block with a link).
  }

  // Opened now, while the click still counts as a user gesture. `null`
  // means the browser blocked it.
  const tab = window.open("", "_blank");
  showOpening(tab, store.storeName);
  try {
    // A grant still on its way from the hover is used when it lands; else ask now.
    const landed = prepared.later ? await prepared.later : null;
    const grant = early ?? (isFresh(landed) ? landed.grant : await requestGrant(store.id));

    if (grant.adminUrl && isSafeAdminUrl(grant.adminUrl)) {
      if (tab && !tab.closed) {
        tab.opener = null;
        tab.location.href = withStoreName(grant.adminUrl, store.storeName);
        openedToast(store, grant);
        return;
      }
      // Blocked: never claim success; hand over a link to click within
      // the grant's two minutes.
      addToast({
        title: "Your browser blocked the new tab.",
        description: `Open ${store.storeName} within 2 minutes, or allow pop-ups for this site and use Log in again.`,
        color: "warning",
        timeout: 120_000,
        endContent: openStoreLink(withStoreName(grant.adminUrl, store.storeName)),
      });
      return;
    }

    // No admin address from the API: build the full one and copy it.
    tab?.close();
    const built = storeAdminLink(store.slug, grant.accessToken, STORE_ADMIN_URL_TEMPLATE);
    const link = built ? withStoreName(built, store.storeName) : null;
    if (!link) {
      toastError(`${store.storeName} has no admin address yet. Set its domain first.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      addToast({
        title: `Sign-in link for ${store.storeName} copied.`,
        description: "Paste it into the address bar within 2 minutes, or use Open store.",
        color: "warning",
        timeout: 120_000,
        endContent: openStoreLink(link),
      });
    } catch {
      addToast({
        title: `Couldn't copy the sign-in link for ${store.storeName}.`,
        description: "Use Open store within 2 minutes.",
        color: "warning",
        timeout: 120_000,
        endContent: openStoreLink(link),
      });
    }
  } catch (error) {
    tab?.close();
    const message = mutationFailureCopy(error);
    if (message) toastError(message);
  }
}

/**
 * Props for a "Log in to store" control: hover that rests `PREPARE_INTENT_DELAY_MS`, or keyboard focus, prepares
 * the store's grant (round 3 A2). Spread on the button.
 */
export function storeLoginIntentProps(store: Client) {
  let timer = 0;
  const cancel = () => window.clearTimeout(timer);
  return {
    onPointerEnter: () => {
      cancel();
      timer = window.setTimeout(() => prepareStoreLogin(store), PREPARE_INTENT_DELAY_MS);
    },
    onPointerLeave: cancel,
    onFocus: () => prepareStoreLogin(store),
  };
}
