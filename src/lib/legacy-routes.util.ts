/**
 * Old addresses that merged into one page (04 S-00 "What merges where"). Pure: path segment + query string in,
 * the new address out, so the mapping is tested without a router.
 */

/** Params every old billing page carried that keep their meaning on Subscriptions: the period and the search. */
const BILLING_CARRY = ["from", "to", "q"];

function carry(source: URLSearchParams, keys: readonly string[]): URLSearchParams {
  const next = new URLSearchParams();
  for (const key of keys) {
    const value = source.get(key);
    if (value) next.set(key, value);
  }
  return next;
}

function withQuery(path: string, params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/** The first value of a comma list, upper-cased ("paid,void" → "PAID"). */
const firstUpper = (value: string | null) => (value ?? "").split(",")[0]?.trim().toUpperCase() ?? "";

/**
 * `/billing/:section` and `/reminders` → `/subscriptions` (04 S-00):
 * invoices `?status=OVERDUE|ISSUED` → `?tab=due`, `PAID` → `?payment=paid`, `VOID|REFUNDED` → `?tab=active`;
 * transactions `?view=flagged|stuck` → `?issue=…`, `?status=success` → `?payment=paid`; reminders → `?tab=due`.
 * `from` / `to` (and the search) carry over.
 */
export function legacyBillingRedirect(section: string | undefined, search: string): string {
  const source = new URLSearchParams(search);
  const next = carry(source, BILLING_CARRY);
  switch (section) {
    case "invoices": {
      const status = firstUpper(source.get("status"));
      if (status === "OVERDUE" || status === "ISSUED") next.set("tab", "due");
      else if (status === "PAID") next.set("payment", "paid");
      // VOID and REFUNDED land on Active, the default tab.
      break;
    }
    case "transactions": {
      const view = source.get("view");
      if (view === "flagged" || view === "stuck") next.set("issue", view);
      else if (firstUpper(source.get("status")) === "SUCCESS") next.set("payment", "paid");
      break;
    }
    case "flagged":
    case "stuck":
      next.set("issue", section);
      break;
    case "reminders":
      next.set("tab", "due");
      break;
    default:
      break;
  }
  return withQuery("/subscriptions", next);
}

/** `/subscriptions?store=:id` → the store's Billing & plan (04 S-04a); null when there is no `store`. */
export function legacySubscriptionStoreRedirect(search: string): string | null {
  const store = new URLSearchParams(search).get("store");
  return store ? `/stores/${encodeURIComponent(store)}/billing?from=subscriptions` : null;
}

const AI_TABS = new Set(["top-ups", "data-health", "benchmarks"]);

/**
 * `/ai/:section` → `/ai` (04 S-00): overview → `/ai`; usage → `?tab=usage`, or the tab its `?view=` named;
 * the older `/ai/top-ups|data-health|benchmarks` pages → that tab. Other params (search, filters) carry over.
 */
export function legacyAiRedirect(section: string | undefined, search: string): string {
  const next = new URLSearchParams(search);
  const view = next.get("view");
  next.delete("view");
  next.delete("tab");
  if (section === "usage" || section === "stores") {
    next.set("tab", view && AI_TABS.has(view) ? view : "usage");
  } else if (section && AI_TABS.has(section)) {
    next.set("tab", section);
  }
  return withQuery("/ai", next);
}
