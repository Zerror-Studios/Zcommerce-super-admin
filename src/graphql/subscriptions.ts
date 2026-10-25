/**
 * Subscription reads across tenants and the console's subscription actions
 * (PRD-005 FR-4.2, FR-4.3).
 */

import { gql } from "@apollo/client";
import { PLATFORM_PLAN_FIELDS } from "./plans";

export const PLATFORM_SUBSCRIPTION_FIELDS = gql`
  ${PLATFORM_PLAN_FIELDS}
  fragment PlatformSubscriptionFields on PlatformSubscription {
    id
    tenantId
    tenantName
    plan {
      ...PlatformPlanFields
    }
    status
    billingCycle
    mrr
    amountDue
    renewalDate
    startedAt
    trialEndsAt
    cancelledAt
    cancelAtPeriodEnd
    daysOverdue
    pendingPlanId
    pendingBillingCycle
  }
`;

// ─── Actions (Phase 2) ────────────────────────────────────────────────────

export const CHANGE_TENANT_PLAN = gql`
  ${PLATFORM_SUBSCRIPTION_FIELDS}
  mutation ChangeTenantPlan(
    $tenantId: ID!
    $planId: ID!
    $billingCycle: PlatformBillingCycle
    $effective: PlanChangeEffective!
  ) {
    changeTenantPlan(
      tenantId: $tenantId
      planId: $planId
      billingCycle: $billingCycle
      effective: $effective
    ) {
      ...PlatformSubscriptionFields
    }
  }
`;

/** PRD-014 SEC-04: audited activation without a payment (billing:manage). */
export const ACTIVATE_TENANT_SUBSCRIPTION = gql`
  ${PLATFORM_SUBSCRIPTION_FIELDS}
  mutation ActivateTenantSubscription(
    $tenantId: ID!
    $override: Boolean!
    $reason: String!
  ) {
    activateTenantSubscription(
      tenantId: $tenantId
      override: $override
      reason: $reason
    ) {
      ...PlatformSubscriptionFields
    }
  }
`;

export const CANCEL_TENANT_SUBSCRIPTION = gql`
  ${PLATFORM_SUBSCRIPTION_FIELDS}
  mutation CancelTenantSubscription($tenantId: ID!, $immediate: Boolean!) {
    cancelTenantSubscription(tenantId: $tenantId, immediate: $immediate) {
      ...PlatformSubscriptionFields
    }
  }
`;

export const REACTIVATE_TENANT_SUBSCRIPTION = gql`
  ${PLATFORM_SUBSCRIPTION_FIELDS}
  mutation ReactivateTenantSubscription($tenantId: ID!) {
    reactivateTenantSubscription(tenantId: $tenantId) {
      ...PlatformSubscriptionFields
    }
  }
`;

export const EXTEND_TRIAL = gql`
  ${PLATFORM_SUBSCRIPTION_FIELDS}
  mutation ExtendTrial($tenantId: ID!, $days: Int!) {
    extendTrial(tenantId: $tenantId, days: $days) {
      ...PlatformSubscriptionFields
    }
  }
`;

export const MARK_SUBSCRIPTION_PAST_DUE = gql`
  ${PLATFORM_SUBSCRIPTION_FIELDS}
  mutation MarkSubscriptionPastDue($tenantId: ID!) {
    markSubscriptionPastDue(tenantId: $tenantId) {
      ...PlatformSubscriptionFields
    }
  }
`;

export const RECORD_SUBSCRIPTION_PAYMENT = gql`
  ${PLATFORM_SUBSCRIPTION_FIELDS}
  mutation RecordSubscriptionPayment(
    $tenantId: ID!
    $amount: Float!
    $paidAt: String!
    $reference: String!
  ) {
    recordSubscriptionPayment(
      tenantId: $tenantId
      amount: $amount
      paidAt: $paidAt
      reference: $reference
    ) {
      ...PlatformSubscriptionFields
    }
  }
`;
