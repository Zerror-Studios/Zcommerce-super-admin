/**
 * Owner contact gaps (PRD-024 FR-4.4, D9)
 *
 * Migrated stores may have no owner email or phone; staff enter them by
 * hand in Store details. Resend invite and the billing emails need the
 * owner email, and SMS or WhatsApp reminders need the owner phone.
 */

import type { Client } from "../types";

// ─── Types ────────────────────────────────────────────────────────────────

export interface OwnerContactGaps {
  isMissingEmail: boolean;
  isMissingPhone: boolean;
}

// ─── Checks ───────────────────────────────────────────────────────────────

/**
 * What the store's owner contact lacks. `ownerEmailSet` comes from the
 * server row (`ownerEmail` itself falls back to the billing contact for
 * display); a client without it is treated as having one.
 */
export function ownerContactGaps(
  client: Pick<Client, "ownerEmailSet" | "ownerPhone">,
): OwnerContactGaps {
  return {
    isMissingEmail: client.ownerEmailSet === false,
    isMissingPhone: !client.ownerPhone?.trim(),
  };
}
