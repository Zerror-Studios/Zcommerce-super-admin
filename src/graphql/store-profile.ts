/**
 * Store profile, status history, health and the at-risk list (PRD-025 FR-6)
 *
 * Kept apart from the shared `PlatformTenantFields` fragment on purpose:
 * `PlatformTenants` sits close to the gateway's query cost limit, so the
 * store page reads these PRD-025 fields for one store at a time.
 */

import { gql } from "@apollo/client";

// ─── Fragments ────────────────────────────────────────────────────────────

export const STORE_PROFILE_FIELDS = gql`
  fragment StoreProfileFields on StoreProfile {
    category
    city
    state
    source
    accountManager {
      id
      name
      email
    }
    tags
    plannedLiveAt
  }
`;

export const TENANT_STATUS_EVENT_FIELDS = gql`
  fragment TenantStatusEventFields on TenantStatusEvent {
    kind
    at
    by {
      id
      name
    }
    category
    reason
    note
    estimated
  }
`;

// ─── Store page reads ─────────────────────────────────────────────────────

/**
 * FR-6.1–6.3: one store's profile, status history (newest first), payment
 * provider, billing-state reason and the subscription's cancel reason.
 */
export const PLATFORM_TENANT_PROFILE = gql`
  ${STORE_PROFILE_FIELDS}
  ${TENANT_STATUS_EVENT_FIELDS}
  query PlatformTenantProfile($id: ID!) {
    platformTenant(id: $id) {
      id
      paymentProvider
      billingStateReason
      billingStateSince
      profile {
        ...StoreProfileFields
      }
      statusHistory {
        ...TenantStatusEventFields
      }
      subscription {
        id
        trialStartsAt
        pastDueSince
        ordersPausedAt
        cancelReason
        cancelNote
      }
    }
  }
`;

/** FR-6.1: the category and source lists (core constants, PRD-025 D6). */
export const PLATFORM_STORE_PROFILE_OPTIONS = gql`
  query PlatformStoreProfileOptions {
    platformStoreProfileOptions {
      categories
      sources
    }
  }
`;

/**
 * FR-6.1: saves the profile only. Returns the profile on the tenant's id so
 * Apollo updates the cached `PlatformTenantProfile` read in place.
 */
export const UPDATE_TENANT_PROFILE = gql`
  ${STORE_PROFILE_FIELDS}
  mutation UpdateTenantProfile($id: ID!, $input: UpdateTenantInput!) {
    updateTenant(id: $id, input: $input) {
      id
      profile {
        ...StoreProfileFields
      }
    }
  }
`;

/** FR-6.3: the newest snapshot's health block (`platformUsage`, one month). */
export const PLATFORM_TENANT_HEALTH = gql`
  query PlatformTenantHealth($tenantId: ID!) {
    platformUsage(tenantId: $tenantId, months: 1) {
      date
      partial
      health {
        logins30d
        checkoutFailures7d
        paymentFailures7d
        repeatCustomerRate
        unpaidExpiries30d
        returns30d
        refunds30d {
          count
          amount
        }
        stockOutVariants
        outboxPending
        dlqDepth
        orders14d
      }
    }
  }
`;

// ─── Stores list ──────────────────────────────────────────────────────────

/** FR-6.5: stores the nightly snapshot flags, with the reasons (server-paged). */
export const PLATFORM_STORES_AT_RISK = gql`
  query PlatformStoresAtRisk($limit: Int, $offset: Int) {
    platformStoresAtRisk(limit: $limit, offset: $offset) {
      items {
        tenantId
        slug
        name
        status
        reasons
        snapshotDate
        overdueInvoices
        checkoutFailures7d
        dlqDepth
        orders14d
        lastActiveAt
      }
      totalCount
    }
  }
`;
