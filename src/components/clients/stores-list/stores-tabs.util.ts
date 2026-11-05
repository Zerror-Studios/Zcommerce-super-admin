/**
 * Stores › the v2 tabs (docs/design-v2/README.md §1A "SA Stores", §7): All, Live, In setup, At risk, Paused.
 *
 * Today's tabs map onto them without losing a slice (audit 2026-11-05 Q13):
 * - Trial and Unpaid → At risk, each still reachable on its own as an "At risk because" slice (`why=trial`,
 *   `why=unpaid`); the saved view At risk (the server's warning signs, `view=at-risk`) merges into the same tab
 *   as `why=signals`;
 * - Suspended → Paused;
 * - Deleted → the title ⋯ "Deleted stores" (`tab=deleted`, still the PRD-018 lists);
 * - the old Set up filter and `?tab=setup` → In setup (which also holds trial stores: they haven't gone live).
 *
 * Older links keep working: `?tab=trial|unpaid|suspended|trials-week|at-risk|setup|deleted`, `?status=unpaid`
 * and `?view=at-risk` are read into the new tab and slice. Pure helpers; the page keeps the choice in the URL.
 */

import { isUnpaid, splitParam } from "../../../lib/store-table.util";
import { storeLifecycleEnum, storeLifecycleKey } from "../../../lib/storeStatus";
import type { Client, Subscription } from "../../../types";

export const storesTabEnum = {
  ALL: "all",
  LIVE: "live",
  IN_SETUP: "setup",
  AT_RISK: "at-risk",
  PAUSED: "paused",
} as const;

export type StoresTab = (typeof storesTabEnum)[keyof typeof storesTabEnum];

export const STORES_TABS: { value: StoresTab; label: string }[] = [
  { value: storesTabEnum.ALL, label: "All" },
  { value: storesTabEnum.LIVE, label: "Live" },
  { value: storesTabEnum.IN_SETUP, label: "In setup" },
  { value: storesTabEnum.AT_RISK, label: "At risk" },
  { value: storesTabEnum.PAUSED, label: "Paused" },
];

/** `?tab=deleted`: the deleted and purged stores (PRD-018), opened from the title ⋯. */
export const DELETED_TAB = "deleted";

export const atRiskReasonEnum = {
  TRIAL: "trial",
  UNPAID: "unpaid",
  PAST_DUE: "past-due",
  SIGNALS: "signals",
} as const;

export type AtRiskReason = (typeof atRiskReasonEnum)[keyof typeof atRiskReasonEnum];

export const AT_RISK_REASON_OPTIONS: { value: AtRiskReason; label: string }[] = [
  { value: atRiskReasonEnum.TRIAL, label: "On a free trial" },
  { value: atRiskReasonEnum.UNPAID, label: "Payment owed" },
  { value: atRiskReasonEnum.PAST_DUE, label: "Past due" },
  { value: atRiskReasonEnum.SIGNALS, label: "Warning signs" },
];

const REASONS = new Set<string>(Object.values(atRiskReasonEnum));
const TABS = new Set<string>(Object.values(storesTabEnum));

export function isStoresTab(value: string | undefined): value is StoresTab {
  return value != null && TABS.has(value);
}

/**
 * Why a store is at risk: on a trial (it may not convert), money owed, past due, or the server's warning signs
 * (`platformTenants(filter: { atRisk: true })`, passed in as `flagged`).
 */
export function atRiskReasonsOf(client: Client, subscription: Subscription | undefined, flagged: boolean): AtRiskReason[] {
  const key = storeLifecycleKey(client);
  const reasons: AtRiskReason[] = [];
  if (key === storeLifecycleEnum.TRIAL) reasons.push(atRiskReasonEnum.TRIAL);
  if (isUnpaid(subscription)) reasons.push(atRiskReasonEnum.UNPAID);
  if (key === storeLifecycleEnum.PAST_DUE) reasons.push(atRiskReasonEnum.PAST_DUE);
  if (flagged) reasons.push(atRiskReasonEnum.SIGNALS);
  return reasons;
}

/** In setup = not live yet: being set up, or on a free trial before going live. */
export function isInSetup(client: Client): boolean {
  const key = storeLifecycleKey(client);
  return key === storeLifecycleEnum.SET_UP || key === storeLifecycleEnum.TRIAL;
}

export function matchesStoresTab(
  tab: StoresTab,
  client: Client,
  subscription: Subscription | undefined,
  flagged: boolean,
  why: AtRiskReason[] = [],
): boolean {
  switch (tab) {
    case storesTabEnum.LIVE:
      return storeLifecycleKey(client) === storeLifecycleEnum.LIVE;
    case storesTabEnum.IN_SETUP:
      return isInSetup(client);
    case storesTabEnum.AT_RISK: {
      const reasons = atRiskReasonsOf(client, subscription, flagged);
      return why.length ? reasons.some((reason) => why.includes(reason)) : reasons.length > 0;
    }
    case storesTabEnum.PAUSED:
      return storeLifecycleKey(client) === storeLifecycleEnum.SUSPENDED;
    default:
      return true;
  }
}

export interface StoresTabUrl {
  tab: StoresTab;
  /** The Deleted stores list is open (`tab=deleted`). */
  deleted: boolean;
  /** At risk slice ("At risk because"); empty = every reason. */
  why: AtRiskReason[];
  /** `tab=trials-week`: trials that renew within 7 days. */
  renewsWithinWeek: boolean;
  /** `tab=overdue`: the overdue payment filter. */
  overdue: boolean;
  /** `status=unpaid` was read as the Unpaid slice (drop it from the status filter). */
  unpaidStatus: boolean;
  /** `view=at-risk` was read as the Warning signs slice (drop it from the saved view). */
  atRiskView: boolean;
  /** The URL said it in an older way: write the canonical `tab` / `why` back on the next change. */
  legacy: boolean;
}

/** Reads the tab and the At risk slice from the URL, including every older link. */
export function readStoresTabUrl(params: Record<string, string | undefined>): StoresTabUrl {
  const raw = params.tab;
  const why = new Set(splitParam(params.why).filter((value) => REASONS.has(value)) as AtRiskReason[]);
  const result: StoresTabUrl = {
    tab: isStoresTab(raw) ? raw : storesTabEnum.ALL,
    deleted: raw === DELETED_TAB,
    why: [],
    renewsWithinWeek: false,
    overdue: false,
    unpaidStatus: false,
    atRiskView: false,
    legacy: false,
  };
  const atRisk = (reason?: AtRiskReason) => {
    result.tab = storesTabEnum.AT_RISK;
    if (reason) why.add(reason);
    result.legacy = true;
  };
  switch (raw) {
    case "trial":
      atRisk(atRiskReasonEnum.TRIAL);
      break;
    case "trials-week":
      atRisk(atRiskReasonEnum.TRIAL);
      result.renewsWithinWeek = true;
      break;
    case "unpaid":
      atRisk(atRiskReasonEnum.UNPAID);
      break;
    case "suspended":
      result.tab = storesTabEnum.PAUSED;
      result.legacy = true;
      break;
    case "overdue":
      result.overdue = true;
      result.legacy = true;
      break;
    default:
      break;
  }
  const status = splitParam(params.status);
  if (status.length === 1 && status[0] === "unpaid") {
    atRisk(atRiskReasonEnum.UNPAID);
    result.unpaidStatus = true;
  }
  if (params.view === "at-risk") {
    atRisk(atRiskReasonEnum.SIGNALS);
    result.atRiskView = true;
  }
  // The slice only means something on the At risk tab.
  result.why = result.tab === storesTabEnum.AT_RISK ? Array.from(why) : [];
  if (result.tab !== storesTabEnum.AT_RISK && why.size > 0) result.legacy = true;
  return result;
}
