import {
  subscriptionStatusEnum,
  type Client,
  type Subscription,
} from "../types";
import { daysBetween } from "./utils";

export interface StoreHealthResult {
  score: number;
  label: "Excellent" | "Good" | "Fair" | "At risk" | "Critical";
  tone: "success" | "primary" | "warning" | "danger";
  factors: string[];
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

/**
 * Store health % for consultants — based on account status, order volume,
 * growth, billing/payment health, and recent activity.
 */
export function getStoreHealth(
  client: Client,
  subscription?: Subscription,
): StoreHealthResult {
  let score = 0;
  const factors: string[] = [];

  // Account status (0–25)
  if (client.status === "active") {
    score += 25;
    factors.push("Account active");
  } else if (client.status === "trial") {
    score += 15;
    factors.push("On trial");
  } else {
    factors.push("Account suspended");
  }

  // Order volume last 30d (0–25)
  const orderScore = Math.min(25, (client.orders30d / 200) * 25);
  score += orderScore;
  if (client.orders30d >= 100) factors.push("Strong order volume");
  else if (client.orders30d >= 30) factors.push("Steady orders");
  else if (client.orders30d > 0) factors.push("Low order volume");
  else factors.push("No recent orders");

  // Growth (0–15, can reduce)
  if (client.growthPercent >= 10) {
    score += 15;
    factors.push("Strong growth");
  } else if (client.growthPercent >= 0) {
    score += 10;
    factors.push("Stable growth");
  } else if (client.growthPercent > -10) {
    score += 4;
    factors.push("Slight decline");
  } else {
    factors.push("Orders declining");
  }

  // Billing / payment gateway health (0–20)
  const subStatus = subscription?.status;
  if (
    subStatus === subscriptionStatusEnum.ACTIVE &&
    (subscription?.amountDue ?? 0) > 0
  ) {
    score += 8;
    factors.push("Payment pending");
  } else if (subStatus === subscriptionStatusEnum.ACTIVE) {
    score += 20;
    factors.push("Payments healthy");
  } else if (subStatus === subscriptionStatusEnum.TRIAL) {
    score += 12;
    factors.push("Trial billing");
  } else if (subStatus === subscriptionStatusEnum.PAST_DUE) {
    score += 3;
    factors.push("Payment issues");
  } else if (subStatus === subscriptionStatusEnum.CANCELLED) {
    factors.push("Subscription cancelled");
  } else if (subStatus === subscriptionStatusEnum.SUSPENDED) {
    factors.push("Subscription suspended");
  } else if (client.status === "active") {
    score += 14;
    factors.push("Billing OK");
  }

  // Recent activity (0–15)
  const daysSinceActive = daysBetween(new Date(client.lastActive), new Date());
  if (daysSinceActive <= 2) {
    score += 15;
    factors.push("Recently active");
  } else if (daysSinceActive <= 7) {
    score += 10;
    factors.push("Active this week");
  } else if (daysSinceActive <= 30) {
    score += 5;
    factors.push("Quiet lately");
  } else {
    factors.push("Inactive store");
  }

  const finalScore = clamp(score);
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
