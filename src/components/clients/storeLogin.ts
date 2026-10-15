import { addToast } from "@heroui/react";
import type { Client } from "../../types";

/**
 * One-click support log-in (docs/design/04-super-admin.md §3.2). There is no impersonation mechanism yet,
 * so every "Log in" button (stores table, store detail) calls this one helper. When the real flow exists,
 * open the store's Merchant Admin in a new tab here; no confirmation dialog.
 */
export function logInToStore(client: Client): void {
  void client;
  addToast({ title: "Support log-in isn't available yet." });
}
