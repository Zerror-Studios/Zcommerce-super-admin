/**
 * "Log in to store" (PRD-005 FR-10, owner decision 2026-10-18).
 *
 * No dialog and no reason: one click asks the platform for a two-minute,
 * single-use grant and opens the store's admin with it; the store's auth
 * service turns it into a normal admin session that lasts like any login.
 * The tab is opened synchronously on the click (so popup blockers allow
 * it) and pointed at the store once the grant arrives.
 */

import { addToast } from "@heroui/react";
import type { Client } from "../../types";
import { client as apollo } from "../../lib/apollo-client";
import { IMPERSONATE_TENANT } from "../../graphql/team";
import { mutationFailureCopy } from "../../lib/mutation-errors";
import { toastError } from "../ui";

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

export async function logInToStore(store: Client): Promise<void> {
  // Opened now, while the click still counts as a user gesture.
  const tab = window.open("", "_blank");
  try {
    const { data } = await apollo.mutate<{ impersonateTenant: Grant }>({
      mutation: IMPERSONATE_TENANT,
      variables: { tenantId: store.id },
    });
    const grant = data?.impersonateTenant;
    if (!grant) throw new Error("empty");

    if (grant.adminUrl && isSafeAdminUrl(grant.adminUrl)) {
      if (tab) {
        tab.opener = null;
        tab.location.href = grant.adminUrl;
      } else {
        window.open(grant.adminUrl, "_blank", "noopener");
      }
      addToast({ title: `Opened ${store.storeName} as ${grant.adminEmail}.` });
      return;
    }

    // No domain or admin URL template yet: hand over the link to paste.
    tab?.close();
    const link = `#impersonation=${encodeURIComponent(grant.accessToken)}`;
    try {
      await navigator.clipboard.writeText(link);
      addToast({
        title: `${store.storeName} has no admin address yet`,
        description: "The sign-in link is copied. Open the store admin and paste it after the address within 2 minutes.",
        color: "warning",
      });
    } catch {
      toastError(`${store.storeName} has no admin address yet. Set its domain first.`);
    }
  } catch (error) {
    tab?.close();
    const message = mutationFailureCopy(error);
    if (message) toastError(message);
  }
}
