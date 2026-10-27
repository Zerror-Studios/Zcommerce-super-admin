/**
 * Plan reads (PRD-005 FR-4.1) and the plan catalog (PRD-017 FR-1, FR-4.1):
 * versions, status, counts, create / edit / archive / migrate.
 */

import { gql } from "@apollo/client";

export const PLATFORM_PLAN_FIELDS = gql`
  fragment PlatformPlanFields on PlatformPlan {
    id
    tenantId
    name
    price {
      monthly
      yearly
      currency
    }
    limits {
      maxSkus
      emailsPerMonth
      smsPerMonth
      whatsappPerMonth
      maxStaffAccounts
      internationalMarkets
      developmentHours
    }
    features {
      onlineStore
      blogSystem
      lookCreation
      analytics
      salesChannels
      prioritySupport
      unlimitedWebHosting
      sslCertificate
    }
    isActive
    createdAt
    version
    status
    isPublic
    displayName
    description
    sortOrder
    supersedesPlanId
    supersededByPlanId
  }
`;

/**
 * The plan's ZCOM AI settings (PRD-017 D14), asked only by the plan
 * screens: the shared fragment is in `PlatformTenants` twice per store, and
 * these fields there took it past the gateway's query cost limit (5000).
 */
export const PLATFORM_PLAN_AI_FIELDS = gql`
  fragment PlatformPlanAiFields on PlatformPlan {
    limits {
      aiQuestionsPerWeek
      aiConnectorCallsPerWeek
      aiMonthlyTokenBudget
    }
    features {
      aiEnabled
      aiDailySummary
    }
  }
`;

export const PLATFORM_PLANS = gql`
  ${PLATFORM_PLAN_FIELDS}
  ${PLATFORM_PLAN_AI_FIELDS}
  query PlatformPlans(
    $includeInactive: Boolean
    $tenantId: ID
    $status: [PlatformPlanStatus!]
  ) {
    platformPlans(
      includeInactive: $includeInactive
      tenantId: $tenantId
      status: $status
    ) {
      ...PlatformPlanFields
      ...PlatformPlanAiFields
      # Counted on the server, only here (not in the shared fragment).
      tenantCount
      subscriberCount
      pendingCount
    }
  }
`;

// ─── Catalog (PRD-017 FR-1; platform:plans:manage + MFA) ──────────────────

/** One plan with its version chain, oldest first (FR-1.7). */
export const PLATFORM_PLAN = gql`
  ${PLATFORM_PLAN_FIELDS}
  ${PLATFORM_PLAN_AI_FIELDS}
  query PlatformPlan($id: ID!) {
    platformPlan(id: $id) {
      ...PlatformPlanFields
      ...PlatformPlanAiFields
      tenantCount
      subscriberCount
      pendingCount
      versions {
        ...PlatformPlanFields
        subscriberCount
      }
    }
  }
`;

export const CREATE_PLAN = gql`
  ${PLATFORM_PLAN_FIELDS}
  ${PLATFORM_PLAN_AI_FIELDS}
  mutation CreatePlan($input: PlatformPlanInput!) {
    createPlan(input: $input) {
      ...PlatformPlanFields
      ...PlatformPlanAiFields
      tenantCount
      subscriberCount
      pendingCount
    }
  }
`;

/** Versioned when the plan is in use (`versioned: true`, FR-1.4). */
export const UPDATE_PLAN = gql`
  ${PLATFORM_PLAN_FIELDS}
  ${PLATFORM_PLAN_AI_FIELDS}
  mutation UpdatePlan($id: ID!, $input: PlatformPlanUpdateInput!) {
    updatePlan(id: $id, input: $input) {
      versioned
      plan {
        ...PlatformPlanFields
        ...PlatformPlanAiFields
        tenantCount
        subscriberCount
        pendingCount
      }
      previousPlan {
        ...PlatformPlanFields
        ...PlatformPlanAiFields
        tenantCount
        subscriberCount
        pendingCount
      }
    }
  }
`;

export const ARCHIVE_PLAN = gql`
  ${PLATFORM_PLAN_FIELDS}
  mutation ArchivePlan($id: ID!, $replacementPlanId: ID) {
    archivePlan(id: $id, replacementPlanId: $replacementPlanId) {
      ...PlatformPlanFields
      tenantCount
      subscriberCount
      pendingCount
    }
  }
`;

/**
 * PRD-017 FR-1.6 (plans:read): the counts `migratePlanSubscribers` would
 * answer for these arguments; writes nothing.
 */
export const PREVIEW_PLAN_MIGRATION = gql`
  query PreviewPlanMigration(
    $fromPlanId: ID!
    $toPlanId: ID!
    $noticeDays: Int!
  ) {
    previewPlanMigration(
      fromPlanId: $fromPlanId
      toPlanId: $toPlanId
      noticeDays: $noticeDays
    ) {
      scheduled
      alreadyScheduled
      deferredForNotice
    }
  }
`;

export const MIGRATE_PLAN_SUBSCRIBERS = gql`
  mutation MigratePlanSubscribers(
    $fromPlanId: ID!
    $toPlanId: ID!
    $noticeDays: Int!
  ) {
    migratePlanSubscribers(
      fromPlanId: $fromPlanId
      toPlanId: $toPlanId
      noticeDays: $noticeDays
    ) {
      scheduled
      alreadyScheduled
      deferredForNotice
    }
  }
`;
