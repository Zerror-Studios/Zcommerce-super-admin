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

// ─── Lifecycle (Phase 2) ──────────────────────────────────────────────────

export const CREATE_TENANT = gql`
  ${PLATFORM_TENANT_FIELDS}
  mutation CreateTenant($input: CreateTenantInput!) {
    createTenant(input: $input) {
      tenant {
        ...PlatformTenantFields
      }
      ownerTemporaryPassword
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

export const DELETE_TENANT = gql`
  mutation DeleteTenant($id: ID!, $confirmSlug: String!) {
    deleteTenant(id: $id, confirmSlug: $confirmSlug)
  }
`;
