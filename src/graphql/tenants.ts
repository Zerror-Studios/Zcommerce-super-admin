/**
 * Tenant (store) reads and lifecycle mutations (PRD-005 FR-3).
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
      storageMb
      staffCount
      lastActiveAt
      pageViews30d
      sessions30d
      conversionRate30d
    }
    suspendedAt
    suspendReason
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

export const SUSPEND_TENANT = gql`
  ${PLATFORM_TENANT_FIELDS}
  mutation SuspendTenant($id: ID!, $reason: String!) {
    suspendTenant(id: $id, reason: $reason) {
      ...PlatformTenantFields
    }
  }
`;

export const REACTIVATE_TENANT = gql`
  ${PLATFORM_TENANT_FIELDS}
  mutation ReactivateTenant($id: ID!) {
    reactivateTenant(id: $id) {
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

export const DELETE_TENANT = gql`
  mutation DeleteTenant($id: ID!, $confirmSlug: String!) {
    deleteTenant(id: $id, confirmSlug: $confirmSlug)
  }
`;
