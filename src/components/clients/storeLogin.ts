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
 */

import { addToast } from "@heroui/react";
import { createElement } from "react";
import type { Client } from "../../types";
import { STORE_ADMIN_URL_TEMPLATE } from "../../config/data-source";
import { client as apollo } from "../../lib/apollo-client";
import { IMPERSONATE_TENANT } from "../../graphql/team";
import { mutationFailureCopy } from "../../lib/mutation-errors";
import { storeAdminLink } from "../../lib/store-admin-link.util";
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

export async function logInToStore(store: Client): Promise<void> {
  // Opened now, while the click still counts as a user gesture. `null`
  // means the browser blocked it.
  const tab = window.open("", "_blank");
  try {
    const { data } = await apollo.mutate<{ impersonateTenant: Grant }>({
      mutation: IMPERSONATE_TENANT,
      variables: { tenantId: store.id },
    });
    const grant = data?.impersonateTenant;
    if (!grant) throw new Error("empty");

    if (grant.adminUrl && isSafeAdminUrl(grant.adminUrl)) {
      if (tab && !tab.closed) {
        tab.opener = null;
        tab.location.href = grant.adminUrl;
        addToast({
          title: `Opened ${store.storeName} as ${grant.adminEmail}.`,
          description: `The store session ends after ${IMPERSONATION_SESSION_MAX_HOURS} hour; use Log in again to continue.`,
        });
        return;
      }
      // Blocked: never claim success; hand over a link to click within
      // the grant's two minutes.
      addToast({
        title: "Your browser blocked the new tab.",
        description: `Open ${store.storeName} within 2 minutes, or allow pop-ups for this site and use Log in again.`,
        color: "warning",
        timeout: 120_000,
        endContent: openStoreLink(grant.adminUrl),
      });
      return;
    }

    // No admin address from the API: build the full one and copy it.
    tab?.close();
    const link = storeAdminLink(store.slug, grant.accessToken, STORE_ADMIN_URL_TEMPLATE);
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
