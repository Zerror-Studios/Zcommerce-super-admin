/**
 * Plan reads (PRD-005 FR-4.1).
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
  }
`;

export const PLATFORM_PLANS = gql`
  ${PLATFORM_PLAN_FIELDS}
  query PlatformPlans($includeInactive: Boolean) {
    platformPlans(includeInactive: $includeInactive) {
      ...PlatformPlanFields
      # Counted on the server, only here (not in the shared fragment).
      tenantCount
    }
  }
`;
