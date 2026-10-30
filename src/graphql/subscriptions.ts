/**
 * Subscription reads across tenants and the console's subscription actions
 * (PRD-005 FR-4.2, FR-4.3).
 */

import { gql } from "@apollo/client";
import { PLATFORM_PLAN_FIELDS } from "./plans";

/**
 * A subscription without its plan. The store reads use it: the server
 * resolves `PlatformTenant.plan` and `subscription.plan` to the same plan,
 * and asking for it twice per store took `PlatformTenants` to the gateway's
 * query cost limit (5000). The console reads the store's `plan` instead.
 */
export const PLATFORM_SUBSCRIPTION_CORE_FIELDS = gql`
  fragment PlatformSubscriptionCoreFields on PlatformSubscription {
    id
    tenantId
    tenantName
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
    creditBalance
    billingState
    ordersPauseAt
    suspendsAt
  }
`;

export const PLATFORM_SUBSCRIPTION_FIELDS = gql`
  ${PLATFORM_PLAN_FIELDS}
  ${PLATFORM_SUBSCRIPTION_CORE_FIELDS}
  fragment PlatformSubscriptionFields on PlatformSubscription {
    ...PlatformSubscriptionCoreFields
    plan {
      ...PlatformPlanFields
    }
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
    $override: Boolean
    $reason: String
  ) {
    changeTenantPlan(
      tenantId: $tenantId
      planId: $planId
      billingCycle: $billingCycle
      effective: $effective
      override: $override
      reason: $reason
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
  mutation CancelTenantSubscription(
    $tenantId: ID!
    $immediate: Boolean!
    $reason: SubscriptionCancelReason!
    $note: String
  ) {
    cancelTenantSubscription(
      tenantId: $tenantId
      immediate: $immediate
      reason: $reason
      note: $note
    ) {
      ...PlatformSubscriptionFields
      cancelReason
      cancelNote
    }
  }
`;

/**
 * PRD-016 FR-18: without `override` only an undo inside a paid period with
 * nothing open; otherwise `override: true` and a reason (audited). The
 * console always sends both.
 */
export const REACTIVATE_TENANT_SUBSCRIPTION = gql`
  ${PLATFORM_SUBSCRIPTION_FIELDS}
  mutation ReactivateTenantSubscription(
    $tenantId: ID!
    $override: Boolean!
    $reason: String
  ) {
    reactivateTenantSubscription(
      tenantId: $tenantId
      override: $override
      reason: $reason
    ) {
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

// ─── Proration preview (PRD-016 FR-6) ─────────────────────────────────────

/** What `changeTenantPlan` would do; nothing is written (billing:read). */
export const PREVIEW_TENANT_PLAN_CHANGE = gql`
  query PreviewTenantPlanChange(
    $tenantId: ID!
    $planId: ID!
    $billingCycle: PlatformBillingCycle
    $effective: PlanChangeEffective!
    $override: Boolean
  ) {
    previewTenantPlanChange(
      tenantId: $tenantId
      planId: $planId
      billingCycle: $billingCycle
      effective: $effective
      override: $override
    ) {
      effective
      effectiveAt
      credit
      charge
      amountDueNow
      nextInvoiceAmount
      currency
      overLimits
      creditIssued
    }
  }
`;
