/**
 * Platform analytics (PRD-012 FR-8.3): traffic, orders and GMV across
 * stores, integration health and the analytics sync monitor. Everything is
 * read from master collections the backend jobs write; the console never
 * touches a tenant database.
 *
 * The selections are spelled out (no fragment interpolation) so the
 * workspace contract validator can check every document.
 */

import { gql } from "@apollo/client";

export const PLATFORM_ANALYTICS_OVERVIEW = gql`
  query PlatformAnalyticsOverview($range: DateRangeInput!) {
    platformAnalyticsOverview(range: $range) {
      kpis {
        sessions
        orders
        gmv
        conversionRate
        storesWithTraffic
        storesTotal
      }
      previous {
        sessions
        orders
        gmv
        conversionRate
      }
      topStoresByGmv {
        tenantId
        slug
        name
        sessions30d
        orders30d
        revenue30d
        growthPercent
        conversionRate30d
        pageViews30d
        analyticsHealth
      }
      topStoresByGrowth {
        tenantId
        slug
        name
        sessions30d
        orders30d
        revenue30d
        growthPercent
        conversionRate30d
        pageViews30d
        analyticsHealth
      }
      trend {
        date
        sessions
        orders
        gmv
      }
    }
  }
`;

export const PLATFORM_INTEGRATION_HEALTH = gql`
  query PlatformIntegrationHealth(
    $filter: IntegrationHealthFilter
    $limit: Int
    $offset: Int
  ) {
    platformIntegrationHealth(filter: $filter, limit: $limit, offset: $offset) {
      rows {
        tenantId
        slug
        name
        connectionId
        provider
        channelType
        status
        lastTestedAt
        lastSyncAt
        lastError
        analyticsHealth
        dataThrough
      }
      totalCount
      counts {
        status
        count
      }
      byProvider {
        provider
        count
        errors
      }
    }
  }
`;

export const PLATFORM_SYNC_MONITOR = gql`
  query PlatformSyncMonitor {
    platformSyncMonitor {
      summary {
        installations
        healthy
        error
        quotaPaused
        backfilling
        runs24hCompleted
        runs24hFailed
        quotaTokensToday
        durationMsP95
      }
      failing {
        tenantId
        slug
        name
        connectionId
        provider
        propertyId
        health
        lastSuccessAt
        lastRunAt
        lastError
        consecutiveFailures
        quotaTokensToday
        quotaPausedUntil
        backfillDone
        backfillTotal
        sessions7d
        sessions30d
        dataThrough
        runs24hCompleted
        runs24hFailed
        rerunRequestedAt
      }
      backfills {
        tenantId
        slug
        name
        connectionId
        provider
        propertyId
        health
        lastSuccessAt
        lastRunAt
        lastError
        consecutiveFailures
        quotaTokensToday
        quotaPausedUntil
        backfillDone
        backfillTotal
        sessions7d
        sessions30d
        dataThrough
        runs24hCompleted
        runs24hFailed
        rerunRequestedAt
      }
      installations {
        tenantId
        slug
        name
        connectionId
        provider
        propertyId
        health
        lastSuccessAt
        lastRunAt
        lastError
        consecutiveFailures
        quotaTokensToday
        quotaPausedUntil
        backfillDone
        backfillTotal
        sessions7d
        sessions30d
        dataThrough
        runs24hCompleted
        runs24hFailed
        rerunRequestedAt
      }
    }
  }
`;

export const PLATFORM_RERUN_ANALYTICS_SYNC = gql`
  mutation PlatformRerunAnalyticsSync($tenantId: ID!, $connectionId: ID!) {
    platformRerunAnalyticsSync(tenantId: $tenantId, connectionId: $connectionId)
  }
`;
