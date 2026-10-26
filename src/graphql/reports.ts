/**
 * Server-side revenue and collections rollups (PRD-005 FR-5.3). Money is
 * computed on the server; the console only formats these rows.
 */

import { gql } from "@apollo/client";

export const PLATFORM_REVENUE_OVERVIEW = gql`
  query PlatformRevenueOverview($range: DateRangeInput!) {
    platformRevenueOverview(range: $range) {
      rangeStart
      rangeEnd
      kpis {
        planRevenue
        netCollected
        pendingAmount
        failedAmount
        refundedAmount
        activeMrr
        payingStores
        momChangePercent
      }
      monthly {
        key
        label
        year
        month
        STARTER
        PREMIUM
        PLUS
        ENTERPRISE
        total
      }
      trend {
        month
        fullLabel
        revenue
      }
      planRows {
        plan
        revenue
        sharePercent
        storeCount
        mrr
      }
      gatewayRows {
        gateway
        collected
        failed
        pending
        refunded
        sharePercent
      }
      topStores {
        tenantId
        storeName
        ownerEmail
        plan
        collected
        failed
        txnCount
      }
      summary {
        monthlyBilling
        trialPipeline
        atRiskMrr
        billableStores
        earnedMonth
        earnedYear
        earnedLastYearToDate
        paidStoresMonth
        projectedYear
        outstandingAmount
        unpaidStores
        overdueStores
        collectionRate
      }
    }
  }
`;

export const PLATFORM_COLLECTIONS = gql`
  query PlatformCollections(
    $range: DateRangeInput!
    $drill: CollectionsDrill
    $search: String
    $planId: ID
    $health: CollectionsHealthFilter
  ) {
    platformCollections(range: $range, drill: $drill, search: $search, planId: $planId, health: $health) {
      rangeStart
      rangeEnd
      overview {
        totalShops
        healthyCount
        atRiskCount
        unhealthyCount
        overdueInGraceCount
        paidThisMonth {
          count
          amount
        }
        pendingPayments {
          count
          amount
        }
        overduePayments {
          count
          amount
        }
        expectedRevenue
        collectedRevenue
        collectedPercent
        renewals7
        renewals30
        churnedThisMonth
        currentPeriod {
          collectedCount
          collectedAmount
          pendingCount
          pendingAmount
          expectedAmount
          collectedPercent
          newSubscriptions
          renewals
          cancellations
        }
        previousPeriod {
          collectedCount
          collectedAmount
          pendingCount
          pendingAmount
          expectedAmount
          collectedPercent
          newSubscriptions
          renewals
          cancellations
        }
      }
      shops {
        tenantId
        storeName
        ownerName
        ownerEmail
        plan
        clientStatus
        subscriptionStatus
        health
        healthReason
        lastPaymentDate
        nextDueDate
        amountDue
        daysOverdue
        isOverdueInGrace
        mrr
      }
      invoices {
        id
        tenantId
        shopName
        ownerEmail
        plan
        amount
        currency
        dueDate
        paidDate
        status
        paymentMethod
        transactionId
      }
    }
  }
`;

// ─── PRD-024 Phase C reads ────────────────────────────────────────────────

/**
 * FR-3.1 (reports:read): recorded MRR days from the daily snapshot job,
 * YYYY-MM-DD, at most 731 days. Days before the first run are absent.
 */
export const PLATFORM_MRR_HISTORY = gql`
  query PlatformMrrHistory($from: String!, $to: String!) {
    platformMrrHistory(from: $from, to: $to) {
      date
      mrr
      payingStores
      newMrr
      expansionMrr
      contractionMrr
      churnedMrr
      byPlan {
        plan
        mrr
        stores
      }
    }
  }
`;

/**
 * FR-3.4 (reports:read): net revenue and paid orders per store for the
 * window and the one before it; totals per currency.
 */
export const PLATFORM_STORE_SALES = gql`
  query PlatformStoreSales($range: DateRangeInput!, $limit: Int, $offset: Int) {
    platformStoreSales(range: $range, limit: $limit, offset: $offset) {
      rangeStart
      rangeEnd
      previousStart
      previousEnd
      totals {
        currency
        revenue
        orders
        previousRevenue
        previousOrders
        growthPercent
        stores
      }
      stores {
        tenantId
        slug
        name
        currency
        revenue
        orders
        previousRevenue
        previousOrders
        growthPercent
        averageOrderValue
      }
      totalCount
    }
  }
`;

/** FR-3.9 (billing:read): reminders sent, newest first; one store with tenantId. */
export const PLATFORM_REMINDER_LOG = gql`
  query PlatformReminderLog($tenantId: ID, $limit: Int, $offset: Int) {
    platformReminderLog(tenantId: $tenantId, limit: $limit, offset: $offset) {
      items {
        id
        tenantId
        tenantName
        channel
        recipient
        subject
        offsetDays
        dueDay
        requestedBy
        createdAt
        sentAt
        result
      }
      totalCount
    }
  }
`;

/** FR-3.10 (settings:manage): the platform jobs' latest runs, newest first. */
export const PLATFORM_JOB_RUNS = gql`
  query PlatformJobRuns($job: String, $limit: Int) {
    platformJobRuns(job: $job, limit: $limit) {
      id
      job
      day
      status
      startedAt
      finishedAt
      durationMs
      summary
      error
    }
  }
`;
