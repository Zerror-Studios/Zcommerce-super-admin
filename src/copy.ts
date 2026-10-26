/**
 * Repeated user-facing copy for the Super Admin (docs/design/05-wording.md §6–8): empty states, toasts and
 * confirmation dialogs. Page-specific labels stay inline in their components.
 */

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

// ─── Empty states (§6) ───────────────────────────────────────────────────────

export interface EmptyCopy {
  title: string;
  description: string;
  action?: string;
}

export const emptyStates = {
  stores: {
    title: "No stores yet",
    description: "Add your first store to start tracking billing and health.",
    action: "Add store",
  },
  storeInvoices: {
    title: "No invoices yet",
    description: "Invoices for this store will appear here.",
  },
  unpaid: {
    title: "Everyone's paid",
    description: "No unpaid invoices right now.",
  },
  notFound: {
    title: "Page not found",
    description: "The link may be broken or the page may have moved.",
    action: "Go to Home",
  },
  /** Search with no matches: "No results for "kurta blu"". */
  noResults: (query: string): EmptyCopy => ({
    title: `No results for "${query}"`,
    description: "Check the spelling or clear filters.",
    action: "Clear filters",
  }),
  /** A table emptied by its search or filters (one inline line, 09 §3.2): "No stores match these filters". */
  filtered: (things: string): EmptyCopy => ({
    title: `No ${things} match these filters`,
    description: "",
    action: "Clear filters",
  }),
  /** Analytics card with nothing to show (single line). */
  noData: "Not enough data for this period yet.",
} satisfies Record<string, EmptyCopy | string | ((query: string) => EmptyCopy)>;

// ─── Toasts and messages (§7) ────────────────────────────────────────────────

export const toasts = {
  loggedOut: "You've been logged out.",
  changesSaved: "Changes saved.",
  genericError: "Something went wrong. Try again.",
  copied: "Copied",
  wrongLogin: "That email and password don't match. Try again.",
  storeDeleted: (name: string) => `${name} deleted.`,
  storeSuspended: (name: string) => `${name} suspended.`,
  storeReactivated: (name: string) => `${name} reactivated.`,
  storeAdded: (name: string) => `${name} added.`,
  reminderSent: (count: number) => `Email reminder queued for ${plural(count, "store", "stores")}.`,
  storeProvisioningFailed: (name: string) => `${name} was created but a provisioning step failed. Open the store to retry.`,
  mfaRequired: "Turn on two-step verification before changing platform data.",
  forbidden: "You don't have permission to do that.",
  // Subscriptions and invoices
  planChanged: "Plan changed.",
  trialExtended: "Trial extended.",
  subscriptionCancelled: "Subscription cancelled.",
  subscriptionReactivated: "Subscription reactivated.",
  markedPastDue: "Marked past due.",
  paymentRecorded: "Payment recorded.",
  discountApplied: "Discount applied.",
  invoiceVoided: "Invoice voided.",
  discountCreated: (code: string) => `${code} created.`,
  gracePeriodDefault: (days: string) => `Grace period set to the default (${days}).`,
  gracePeriodSet: (days: string, store: string) => `Grace period set to ${days} for ${store}.`,
  selectStore: "Select at least one store.",
  // Team and sign-in
  roleChanged: "Role changed.",
  mfaReset: (email: string) => `Two-step verification reset for ${email}.`,
  memberDisabled: (email: string) => `${email} disabled.`,
  mfaStartFailed: "Couldn't start enrolment. Try again.",
  passwordSet: "Password set. Log in to continue.",
} as const;

// ─── Confirmation dialogs (§8) ───────────────────────────────────────────────

export interface ConfirmCopy {
  title: string;
  description: string;
  confirmLabel: string;
}

export const confirms = {
  suspendStore: (name: string): ConfirmCopy => ({
    title: `Suspend ${name}?`,
    description: "The storefront goes offline and the owner can't log in until you reactivate it.",
    confirmLabel: "Suspend store",
  }),
  reactivateStore: (name: string): ConfirmCopy => ({
    title: `Reactivate ${name}?`,
    description: "The storefront and the owner's dashboard come back online right away.",
    confirmLabel: "Reactivate store",
  }),
  deleteStore: (name: string): ConfirmCopy => ({
    title: `Delete ${name}?`,
    // PRD-018 FR-2.3: data is kept for the grace period, then purged.
    description:
      "The store goes offline at once. Its data is kept for the grace period (30 days by default), when you can still restore it, then purged for good.",
    confirmLabel: "Delete store",
  }),
} as const;
