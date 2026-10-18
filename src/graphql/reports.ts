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
        mrr
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
