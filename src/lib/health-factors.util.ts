/**
 * zcom-super-admin — Store health factors
 *
 * The server scores a store from five areas and sends one plain-language
 * factor per area (`platform-health.service.ts` in zcom-backend:
 * "Account active", "Low order volume", "Payments healthy", …). This maps
 * each factor to its area and a tone, so the Health card can show one row
 * per area with a coloured status instead of a loose list of words.
 *
 * Usage: `healthFactorRows(health.factors)` → rows in area order.
 */
import type { Tone } from "../components/ui/tones";

// ─── Types ────────────────────────────────────────────────────────────────

export const healthAreaEnum = {
  ACCOUNT: "Account",
  ORDERS: "Orders",
  GROWTH: "Growth",
  BILLING: "Billing",
  ACTIVITY: "Activity",
  OTHER: "Other",
} as const;

export type HealthArea = (typeof healthAreaEnum)[keyof typeof healthAreaEnum];

export interface HealthFactorRow {
  area: HealthArea;
  /** The server's factor text, shown as is. */
  factor: string;
  tone: Tone;
}

// ─── Factor map (mirrors platform-health.service.ts) ─────────────────────

const FACTORS: Record<string, { area: HealthArea; tone: Tone }> = {
  "Account active": { area: healthAreaEnum.ACCOUNT, tone: "success" },
  "On trial": { area: healthAreaEnum.ACCOUNT, tone: "info" },
  "Account suspended": { area: healthAreaEnum.ACCOUNT, tone: "danger" },

  "Strong order volume": { area: healthAreaEnum.ORDERS, tone: "success" },
  "Steady orders": { area: healthAreaEnum.ORDERS, tone: "success" },
  "Low order volume": { area: healthAreaEnum.ORDERS, tone: "warning" },
  "No recent orders": { area: healthAreaEnum.ORDERS, tone: "danger" },

  "Strong growth": { area: healthAreaEnum.GROWTH, tone: "success" },
  "Stable growth": { area: healthAreaEnum.GROWTH, tone: "success" },
  "Slight decline": { area: healthAreaEnum.GROWTH, tone: "warning" },
  "Orders declining": { area: healthAreaEnum.GROWTH, tone: "danger" },

  "Payments healthy": { area: healthAreaEnum.BILLING, tone: "success" },
  "Billing OK": { area: healthAreaEnum.BILLING, tone: "success" },
  "Trial billing": { area: healthAreaEnum.BILLING, tone: "info" },
  "Payment pending": { area: healthAreaEnum.BILLING, tone: "warning" },
  "Payment issues": { area: healthAreaEnum.BILLING, tone: "danger" },
  "Subscription cancelled": { area: healthAreaEnum.BILLING, tone: "danger" },
  "Subscription suspended": { area: healthAreaEnum.BILLING, tone: "danger" },

  "Recently active": { area: healthAreaEnum.ACTIVITY, tone: "success" },
  "Active this week": { area: healthAreaEnum.ACTIVITY, tone: "success" },
  "Quiet lately": { area: healthAreaEnum.ACTIVITY, tone: "warning" },
  "Inactive store": { area: healthAreaEnum.ACTIVITY, tone: "danger" },
};

const AREA_ORDER: HealthArea[] = Object.values(healthAreaEnum);

// ─── Helpers ──────────────────────────────────────────────────────────────

/** One row per factor, in area order; unknown factors are kept as neutral "Other" rows. */
export function healthFactorRows(factors: string[]): HealthFactorRow[] {
  return factors
    .map((factor) => ({
      factor,
      ...(FACTORS[factor] ?? { area: healthAreaEnum.OTHER, tone: "neutral" as const }),
    }))
    .sort((a, b) => AREA_ORDER.indexOf(a.area) - AREA_ORDER.indexOf(b.area));
}
