/**
 * Stores › server-side filters and signals (backend PRD-026 FR-3.4, guide §6)
 *
 * The Stores table keeps its in-browser filters (plan, status, health,
 * payment, renews, joined) over the stores `ClientsProvider` loads. The
 * PRD-026 filters exist only on the server, so they are sent to
 * `platformTenants(filter)`: the table then shows the loaded stores whose
 * ids the server returned. Everything lives in the URL:
 *
 * - `view`: a saved view (`at-risk`, `overdue`, `dormant`, `in-development`
 *   (`development` also read), `churned`); Home links to
 *   `/stores?view=at-risk` and `/stores?view=in-development`;
 * - `lifecycle`, `category`, `source`, `manager`, `tag`, `age` (comma lists),
 *   `city`, `state` (one value), `signal` (`at-risk,overdue,dormant`).
 *
 * The CSV export sends the same filter, 100 rows a page.
 */

import { getPlanLabel } from "../../../lib/display-labels.util";
import {
  AGE_BAND_LABELS,
  lifecycleLabel,
  riskReasonLabel,
} from "../../../lib/platform-insights.util";
import { joinParam, splitParam } from "../../../lib/store-table.util";
import type { Client } from "../../../types";
import type {
  PlatformStoreAgeBand,
  PlatformStoreLifecycleStatus,
} from "../../../types/platform-insights";
import {
  platformStoreAgeBandEnum,
  platformStoreLifecycleStatusEnum,
} from "../../../types/platform-insights";

// ─── Types ────────────────────────────────────────────────────────────────

/** The PRD-026 part of `PlatformTenantFilter`. */
export interface StoreServerFilter {
  lifecycleStatus?: PlatformStoreLifecycleStatus[];
  categories?: string[];
  sources?: string[];
  city?: string;
  state?: string;
  accountManagerIds?: string[];
  tags?: string[];
  ageBands?: PlatformStoreAgeBand[];
  atRisk?: boolean;
  overdue?: boolean;
  dormant?: boolean;
}

/** One row of `PlatformTenantSignals`. */
export interface StoreSignal {
  id: string;
  lifecycleStatus: PlatformStoreLifecycleStatus | null;
  riskScore: number | null;
  riskReasons: string[];
  profile: {
    category: string | null;
    source: string | null;
    city: string | null;
    state: string | null;
    tags: string[];
    accountManager: { id: string; name: string } | null;
  } | null;
}

/** The URL's server-side filters, as the drawer and chips edit them. */
export interface StoreServerParams {
  view: StoreViewKey | "";
  lifecycle: PlatformStoreLifecycleStatus[];
  category: string[];
  source: string[];
  manager: string[];
  tag: string[];
  age: PlatformStoreAgeBand[];
  city: string;
  state: string;
  signal: StoreSignalKey[];
}

// ─── Saved views (guide §6) ───────────────────────────────────────────────

export const storeViewEnum = {
  AT_RISK: "at-risk",
  OVERDUE: "overdue",
  DORMANT: "dormant",
  DEVELOPMENT: "in-development",
  CHURNED: "churned",
} as const;

export type StoreViewKey = (typeof storeViewEnum)[keyof typeof storeViewEnum];

export const STORE_VIEWS: readonly {
  key: StoreViewKey;
  label: string;
  filter: StoreServerFilter;
}[] = [
  { key: storeViewEnum.AT_RISK, label: "At risk", filter: { atRisk: true } },
  { key: storeViewEnum.OVERDUE, label: "Overdue", filter: { overdue: true } },
  { key: storeViewEnum.DORMANT, label: "Dormant", filter: { dormant: true } },
  {
    key: storeViewEnum.DEVELOPMENT,
    label: "In development",
    filter: { lifecycleStatus: [platformStoreLifecycleStatusEnum.DEVELOPMENT] },
  },
  {
    key: storeViewEnum.CHURNED,
    label: "Churned",
    filter: { lifecycleStatus: [platformStoreLifecycleStatusEnum.CHURNED] },
  },
];

export function isStoreView(value: unknown): value is StoreViewKey {
  return STORE_VIEWS.some((view) => view.key === value);
}

/** Older or shorter view keys that open a view. */
const VIEW_ALIASES: Record<string, StoreViewKey> = {
  development: storeViewEnum.DEVELOPMENT,
};

/** The view a URL value names (an alias reads as its view); "" when none. */
export function toStoreView(value: unknown): StoreViewKey | "" {
  if (isStoreView(value)) return value;
  return typeof value === "string" ? (VIEW_ALIASES[value] ?? "") : "";
}

// ─── Signals (the drawer's yes/no filters) ────────────────────────────────

export const storeSignalEnum = {
  AT_RISK: "at-risk",
  OVERDUE: "overdue",
  DORMANT: "dormant",
} as const;

export type StoreSignalKey = (typeof storeSignalEnum)[keyof typeof storeSignalEnum];

export const STORE_SIGNAL_OPTIONS: { value: StoreSignalKey; label: string }[] = [
  { value: storeSignalEnum.AT_RISK, label: "At risk" },
  { value: storeSignalEnum.OVERDUE, label: "Overdue invoice" },
  { value: storeSignalEnum.DORMANT, label: "Dormant (no login in 30 days)" },
];

const SIGNAL_KEYS = new Set<string>(Object.values(storeSignalEnum));
const LIFECYCLE_KEYS = new Set<string>(Object.values(platformStoreLifecycleStatusEnum));
const AGE_KEYS = new Set<string>(Object.values(platformStoreAgeBandEnum));

export const LIFECYCLE_FILTER_OPTIONS = Object.values(platformStoreLifecycleStatusEnum).map(
  (value) => ({ value, label: lifecycleLabel(value) }),
);

export const AGE_FILTER_OPTIONS = Object.values(platformStoreAgeBandEnum).map((value) => ({
  value,
  label: AGE_BAND_LABELS[value],
}));

// ─── URL ⇄ filter ─────────────────────────────────────────────────────────

/** The URL keys this module owns (cleared by "Clear all"). */
export const SERVER_PARAM_KEYS = [
  "view",
  "lifecycle",
  "category",
  "source",
  "manager",
  "tag",
  "age",
  "city",
  "state",
  "signal",
] as const;

export function readServerParams(params: Record<string, string>): StoreServerParams {
  return {
    view: toStoreView(params.view),
    lifecycle: splitParam(params.lifecycle)
      .map((value) => value.toUpperCase())
      .filter((value) => LIFECYCLE_KEYS.has(value)) as PlatformStoreLifecycleStatus[],
    category: splitParam(params.category),
    source: splitParam(params.source),
    manager: splitParam(params.manager),
    tag: splitParam(params.tag),
    age: splitParam(params.age).filter((value) => AGE_KEYS.has(value)) as PlatformStoreAgeBand[],
    city: (params.city ?? "").trim(),
    state: (params.state ?? "").trim(),
    signal: splitParam(params.signal).filter((value) => SIGNAL_KEYS.has(value)) as StoreSignalKey[],
  };
}

/** The URL values for `params` (empty ones removed). */
export function writeServerParams(params: StoreServerParams): Record<string, string | undefined> {
  return {
    view: params.view || undefined,
    lifecycle: joinParam(params.lifecycle),
    category: joinParam(params.category),
    source: joinParam(params.source),
    manager: joinParam(params.manager),
    tag: joinParam(params.tag),
    age: joinParam(params.age),
    city: params.city || undefined,
    state: params.state || undefined,
    signal: joinParam(params.signal),
  };
}

export const EMPTY_SERVER_PARAMS: StoreServerParams = {
  view: "",
  lifecycle: [],
  category: [],
  source: [],
  manager: [],
  tag: [],
  age: [],
  city: "",
  state: "",
  signal: [],
};

/**
 * The `PlatformTenantFilter` part for these params, or null when none is
 * set (the table then shows every loaded store). A view's own filter is
 * merged with the drawer's: lifecycle values join; yes/no filters add up.
 */
export function toServerFilter(params: StoreServerParams): StoreServerFilter | null {
  const view = STORE_VIEWS.find((entry) => entry.key === params.view)?.filter ?? {};
  const filter: StoreServerFilter = {};
  const lifecycle = Array.from(new Set([...(view.lifecycleStatus ?? []), ...params.lifecycle]));
  if (lifecycle.length) filter.lifecycleStatus = lifecycle;
  if (params.category.length) filter.categories = params.category;
  if (params.source.length) filter.sources = params.source;
  if (params.manager.length) filter.accountManagerIds = params.manager;
  if (params.tag.length) filter.tags = params.tag;
  if (params.age.length) filter.ageBands = params.age;
  if (params.city) filter.city = params.city;
  if (params.state) filter.state = params.state;
  if (view.atRisk || params.signal.includes(storeSignalEnum.AT_RISK)) filter.atRisk = true;
  if (view.overdue || params.signal.includes(storeSignalEnum.OVERDUE)) filter.overdue = true;
  if (view.dormant || params.signal.includes(storeSignalEnum.DORMANT)) filter.dormant = true;
  return Object.keys(filter).length > 0 ? filter : null;
}

/** How many server-side drawer groups hold a value (the view isn't one). */
export function countServerFilters(params: StoreServerParams): number {
  return [
    params.lifecycle.length,
    params.category.length,
    params.source.length,
    params.manager.length,
    params.tag.length,
    params.age.length,
    params.city ? 1 : 0,
    params.state ? 1 : 0,
    params.signal.length,
  ].filter((count) => count > 0).length;
}

// ─── Filter options from the stores' profiles ─────────────────────────────

/** Distinct, sorted values (blanks left out). */
function distinct(values: (string | null | undefined)[]): string[] {
  return Array.from(new Set(values.map((value) => (value ?? "").trim()).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b),
  );
}

/**
 * The drawer's choices for city, state, tags and account managers, from
 * the stores' own profiles (so `platformUsers`, which needs users:manage,
 * isn't read). Categories and sources come from `platformStoreProfileOptions`.
 */
export function profileFilterOptions(signals: StoreSignal[]): {
  cities: string[];
  states: string[];
  tags: string[];
  managers: { value: string; label: string }[];
} {
  const managers = new Map<string, string>();
  for (const signal of signals) {
    const manager = signal.profile?.accountManager;
    if (manager?.id) managers.set(manager.id, manager.name || manager.id);
  }
  return {
    cities: distinct(signals.map((signal) => signal.profile?.city)),
    states: distinct(signals.map((signal) => signal.profile?.state)),
    tags: distinct(signals.flatMap((signal) => signal.profile?.tags ?? [])),
    managers: Array.from(managers, ([value, label]) => ({ value, label })).sort((a, b) =>
      a.label.localeCompare(b.label),
    ),
  };
}

// ─── Risk ─────────────────────────────────────────────────────────────────

/** The reason labels under a risk score ("Overdue past grace, No login in 14 days"). */
export function riskReasonsText(reasons: string[] | null | undefined): string {
  return (reasons ?? []).map(riskReasonLabel).join(", ");
}

// ─── CSV export ───────────────────────────────────────────────────────────

export const STORE_EXPORT_COLUMNS = [
  { key: "store", label: "Store" },
  { key: "slug", label: "Slug" },
  { key: "domain", label: "Domain" },
  { key: "plan", label: "Plan" },
  { key: "lifecycle", label: "Lifecycle" },
  { key: "riskScore", label: "Risk score" },
  { key: "riskReasons", label: "Risk reasons" },
  { key: "category", label: "Category" },
  { key: "source", label: "Source" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "accountManager", label: "Account manager" },
  { key: "tags", label: "Tags" },
  { key: "monthlyFee", label: "Monthly fee (INR)" },
  { key: "sales30d", label: "Sales · 30d (INR)" },
] as const;

/** One CSV row for a store and its signal (an unknown signal leaves those cells empty). */
export function storeExportRow(
  client: Client,
  signal: StoreSignal | undefined,
): Record<string, unknown> {
  const profile = signal?.profile;
  return {
    store: client.storeName,
    slug: client.slug ?? "",
    domain: client.domain ?? "",
    plan: client.planRef?.displayName || getPlanLabel(client.plan),
    lifecycle: signal?.lifecycleStatus ? lifecycleLabel(signal.lifecycleStatus) : "",
    riskScore: signal?.riskScore ?? "",
    riskReasons: riskReasonsText(signal?.riskReasons),
    category: profile?.category ?? "",
    source: profile?.source ?? "",
    city: profile?.city ?? "",
    state: profile?.state ?? "",
    accountManager: profile?.accountManager?.name ?? "",
    tags: (profile?.tags ?? []).join("; "),
    monthlyFee: client.mrr,
    sales30d: client.revenue,
  };
}

/** `stores-2026-11-02.csv` (local date). */
export function storeExportFilename(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `stores-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.csv`;
}
