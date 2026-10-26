/**
 * Tenant (store) reads and lifecycle mutations (PRD-005 FR-3), with the
 * PRD-018 data lifecycle: suspension categories, money in flight, guarded
 * delete and restore, purged stores, domain verification and go-live.
 */

import { gql } from "@apollo/client";
import { PLATFORM_PLAN_FIELDS } from "./plans";
import { PLATFORM_SUBSCRIPTION_FIELDS } from "./subscriptions";

export const PLATFORM_TENANT_FIELDS = gql`
  ${PLATFORM_PLAN_FIELDS}
  ${PLATFORM_SUBSCRIPTION_FIELDS}
  fragment PlatformTenantFields on PlatformTenant {
    id
    slug
    name
    domain
    region
    status
    timezone
    currency
    owner {
      name
      email
      phone
    }
    billing {
      contactEmail
      gstin
    }
    onboarding {
      status
      error
      steps {
        key
        status
        error
      }
    }
    gracePeriodDaysOverride
    notes
    plan {
      ...PlatformPlanFields
    }
    subscription {
      ...PlatformSubscriptionFields
    }
    monthlyFee
    healthScore
    healthFactors
    paymentState {
      label
      tone
      detail
    }
    subscriptionHealth {
      bucket
      reason
      daysOverdue
      daysUntilRenewal
      isOverdueInGrace
    }
    usage {
      date
      products
      orders30d
      revenue30d
      growthPercent
      previousRevenue
      previousOrders
      storageMb
      staffCount
      lastActiveAt
      pageViews30d
      sessions30d
      conversionRate30d
      partial
      messagesThisMonth
    }
    suspendedAt
    suspendReason
    suspendCategory
    purgeAfter
    domainStatus
    pendingDomain
    liveAt
    createdAt
    updatedAt
  }
`;

export const PLATFORM_TENANTS = gql`
  ${PLATFORM_TENANT_FIELDS}
  query PlatformTenants(
    $filter: PlatformTenantFilter
    $sort: PlatformTenantSort
    $limit: Int
    $offset: Int
  ) {
    platformTenants(filter: $filter, sort: $sort, limit: $limit, offset: $offset) {
      items {
        ...PlatformTenantFields
      }
      totalCount
    }
  }
`;

/** One store by id: deep links to a store not (yet) in the list (PRD-014 FE-09). */
export const PLATFORM_TENANT = gql`
  ${PLATFORM_TENANT_FIELDS}
  query PlatformTenant($id: ID!) {
    platformTenant(id: $id) {
      ...PlatformTenantFields
    }
  }
`;

/** Daily usage snapshots for one store, newest first (PRD-014 PLT-13). */
export const PLATFORM_USAGE = gql`
  query PlatformUsage($tenantId: ID!, $months: Int) {
    platformUsage(tenantId: $tenantId, months: $months) {
      date
      products
      orders30d
      revenue30d
      storageMb
      staffCount
      sessions30d
    }
  }
`;

// ─── Lifecycle (Phase 2) ──────────────────────────────────────────────────

export const CREATE_TENANT = gql`
  ${PLATFORM_TENANT_FIELDS}
  mutation CreateTenant($input: CreateTenantInput!) {
    createTenant(input: $input) {
      tenant {
        ...PlatformTenantFields
      }
      ownerTemporaryPassword
      ownerInviteSent
    }
  }
`;

export const RETRY_TENANT_PROVISIONING = gql`
  ${PLATFORM_TENANT_FIELDS}
  mutation RetryTenantProvisioning($id: ID!) {
    retryTenantProvisioning(id: $id) {
      tenant {
        ...PlatformTenantFields
      }
      ownerTemporaryPassword
      ownerInviteSent
    }
  }
`;

export const UPDATE_TENANT = gql`
  ${PLATFORM_TENANT_FIELDS}
  mutation UpdateTenant($id: ID!, $input: UpdateTenantInput!) {
    updateTenant(id: $id, input: $input) {
      ...PlatformTenantFields
    }
  }
`;

export const UPDATE_TENANT_NOTES = gql`
  mutation UpdateTenantNotes($id: ID!, $notes: String!) {
    updateTenantNotes(id: $id, notes: $notes) {
      id
      notes
    }
  }
`;

/** PRD-018 FR-1.1: `category` defaults to POLICY on the server. */
export const SUSPEND_TENANT = gql`
  ${PLATFORM_TENANT_FIELDS}
  mutation SuspendTenant(
    $id: ID!
    $reason: String!
    $category: TenantSuspendCategory
  ) {
    suspendTenant(id: $id, reason: $reason, category: $category) {
      ...PlatformTenantFields
    }
  }
`;

/**
 * PRD-016 FR-18: a store suspended for BILLING comes back only when nothing
 * is overdue, or with `override: true` and a reason (billing:manage).
 */
export const REACTIVATE_TENANT = gql`
  ${PLATFORM_TENANT_FIELDS}
  mutation ReactivateTenant($id: ID!, $override: Boolean, $reason: String) {
    reactivateTenant(id: $id, override: $override, reason: $reason) {
      ...PlatformTenantFields
    }
  }
`;

/** Emails the owner a fresh set-password link (PRD-014 PLT-07; tenants:manage). */
export const RESEND_OWNER_INVITE = gql`
  mutation ResendOwnerInvite($tenantId: ID!) {
    resendOwnerInvite(tenantId: $tenantId)
  }
`;

/**
 * PRD-018 FR-2.1: CONFLICT `MONEY_IN_FLIGHT` (with `extensions.counts`)
 * unless the platform owner forces it with a reason.
 */
export const DELETE_TENANT = gql`
  mutation DeleteTenant(
    $id: ID!
    $confirmSlug: String!
    $force: Boolean
    $forceReason: String
  ) {
    deleteTenant(
      id: $id
      confirmSlug: $confirmSlug
      force: $force
      forceReason: $forceReason
    )
  }
`;

// ─── Data lifecycle (PRD-018) ─────────────────────────────────────────────

/** FR-2.3: a DELETED store back to SUSPENDED (OWNER_REQUEST) inside its grace period. */
export const RESTORE_TENANT = gql`
  ${PLATFORM_TENANT_FIELDS}
  mutation RestoreTenant($id: ID!) {
    restoreTenant(id: $id) {
      ...PlatformTenantFields
    }
  }
`;

/** FR-1.2: what a suspension or delete would leave open (read-only counts). */
export const TENANT_MONEY_IN_FLIGHT = gql`
  query TenantMoneyInFlight($id: ID!) {
    tenantMoneyInFlight(id: $id) {
      pendingPayments
      paidUnfulfilledOrders
      refundsInProgress
      needsRefundOrders
      needsAttentionOrders
      openReturns
      activeHolds
      activeMarketplaceListings
      openPlatformInvoices
      partial
    }
  }
`;

/** FR-2.5: tombstones of purged stores, newest first. */
export const PLATFORM_PURGED_TENANTS = gql`
  query PlatformPurgedTenants($limit: Int, $offset: Int) {
    platformPurgedTenants(limit: $limit, offset: $offset) {
      items {
        tenantId
        slug
        domain
        name
        deletedAt
        purgedAt
        reason
      }
      totalCount
    }
  }
`;

/** FR-2.3: deleted stores still inside their grace period. */
export const PLATFORM_DELETED_TENANTS = gql`
  query PlatformDeletedTenants($limit: Int, $offset: Int) {
    platformTenants(
      filter: { status: [DELETED] }
      sort: NAME_ASC
      limit: $limit
      offset: $offset
    ) {
      items {
        id
        slug
        name
        domain
        status
        purgeAfter
        updatedAt
      }
      totalCount
    }
  }
`;

export const TENANT_DOMAIN_VERIFICATION_FIELDS = gql`
  fragment TenantDomainVerificationFields on TenantDomainVerification {
    domain
    recordName
    recordValue
    status
    lastError
  }
`;

/** FR-4.2: starts a DNS TXT claim; the store's domain moves only on a check. */
export const START_DOMAIN_VERIFICATION = gql`
  ${TENANT_DOMAIN_VERIFICATION_FIELDS}
  mutation StartDomainVerification($tenantId: ID!, $domain: String!) {
    startDomainVerification(tenantId: $tenantId, domain: $domain) {
      ...TenantDomainVerificationFields
    }
  }
`;

/** FR-4.2: looks the TXT record up; VERIFIED moves the domain. */
export const CHECK_DOMAIN_VERIFICATION = gql`
  ${TENANT_DOMAIN_VERIFICATION_FIELDS}
  mutation CheckDomainVerification($tenantId: ID!) {
    checkDomainVerification(tenantId: $tenantId) {
      ...TenantDomainVerificationFields
    }
  }
`;

/** FR-4.3: each check pass / fail / unknown (the server probes the storefront). */
export const TENANT_GO_LIVE_CHECKLIST = gql`
  query TenantGoLiveChecklist($tenantId: ID!) {
    tenantGoLiveChecklist(tenantId: $tenantId) {
      key
      label
      required
      state
      detail
    }
  }
`;

/** FR-4.3: CONFLICT `CHECKLIST_FAILED` (with `extensions.failing`) unless every required check passes. */
export const MARK_TENANT_LIVE = gql`
  ${PLATFORM_TENANT_FIELDS}
  mutation MarkTenantLive(
    $tenantId: ID!
    $waive: [String!]
    $waiveReason: String
  ) {
    markTenantLive(
      tenantId: $tenantId
      waive: $waive
      waiveReason: $waiveReason
    ) {
      ...PlatformTenantFields
    }
  }
`;
