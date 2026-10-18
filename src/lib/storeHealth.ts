/**
 * Store health for consultants. The score and its factors are computed by the
 * server from the usage snapshot and the subscription (PRD-005 FR-3.6, one
 * rule everywhere); this file only adds the display band.
 */
import type { Client } from "../types";

export interface StoreHealthResult {
  score: number;
  label: "Excellent" | "Good" | "Fair" | "At risk" | "Critical";
  tone: "success" | "primary" | "warning" | "danger";
  factors: string[];
}

export function getStoreHealth(client: Client): StoreHealthResult {
  const score = client.health?.score ?? 0;
  const factors = client.health?.factors ?? ["Not scored yet"];
  return withBand(Math.max(0, Math.min(100, Math.round(score))), factors);
}

function withBand(finalScore: number, factors: string[]): StoreHealthResult {
  let label: StoreHealthResult["label"];
  let tone: StoreHealthResult["tone"];

  if (finalScore >= 85) {
    label = "Excellent";
    tone = "success";
  } else if (finalScore >= 70) {
    label = "Good";
    tone = "primary";
  } else if (finalScore >= 50) {
    label = "Fair";
    tone = "warning";
  } else if (finalScore >= 30) {
    label = "At risk";
    tone = "warning";
  } else {
    label = "Critical";
    tone = "danger";
  }

  return { score: finalScore, label, tone, factors };
}
