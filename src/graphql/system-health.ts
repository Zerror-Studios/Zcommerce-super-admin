/**
 * System health (backend PRD-036 R2-9, platform-admin `platformSystemHealth`, platform:tenants:read): queue lag,
 * failed webhooks, GA sync per store, payment provider status and the nightly jobs, read from data Zcom already
 * keeps. Uptime, page speed and error rate come back `available: false` with the reason (nothing measures them yet).
 */

import { gql } from "@apollo/client";

export const PLATFORM_SYSTEM_HEALTH = gql`
  query PlatformSystemHealth {
    platformSystemHealth {
      generatedAt
      uptime {
        available
        value
        reason
      }
      pageSpeedMs {
        available
        value
        reason
      }
      errorRate {
        available
        value
        reason
      }
      queue {
        scope
        pending
        failed
        oldestPendingAt
        lagSeconds
        lagging
      }
      webhooks {
        failed24h
        failed7d
        received7d
        byProvider {
          provider
          received7d
          failed7d
          failed24h
          storesAffected
          lastFailedAt
        }
      }
      analyticsSync {
        installations
        healthy
        failing
        paused
        stores {
          tenantId
          storeName
          storeSlug
          provider
          health
          lastSuccessAt
          lastRunAt
          lastError
          consecutiveFailures
          dataThrough
        }
      }
      paymentProviders {
        provider
        installs
        errors
        lastError
        lastErrorAt
        failedWebhooks7d
        state
      }
      jobs {
        job
        status
        startedAt
        finishedAt
      }
    }
  }
`;
