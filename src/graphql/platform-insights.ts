/**
 * Super Admin AI (backend PRD-026, console guide
 * `zcom-backend/docs/architecture/super-admin-ai-console-integration.md`):
 * the nightly platform snapshot (`platformMetrics`), the Home page
 * (`platformAttention`), Refresh now, and the internal Ask ZCOM chat.
 *
 * - Reads need `platform:tenants:read`; money parts need
 *   `platform:billing:read` and AI cost `platform:ai:read` (left out or
 *   null otherwise, never an error). Refresh needs `platform:reports:read`;
 *   the chat `platform:ai:ask` (Owner and Admin, MFA).
 * - Selections are spelled out (no fragment interpolation) so the
 *   workspace contract validator can check every document.
 */

import { gql } from "@apollo/client";

// ─── Home (guide §3) ──────────────────────────────────────────────────────

export const PLATFORM_ATTENTION = gql`
  query PlatformAttention {
    platformAttention {
      computedAt
      stale
      activeStores
      smallSample
      smallSampleThreshold
      moneyDue {
        total
        storeCount
        items {
          tenantId
          name
          slug
          amount
          dueAt
          daysOverdue
          invoiceCount
          overdue
        }
      }
      atRisk {
        totalCount
        items {
          tenantId
          name
          slug
          status
          score
          reasons
          days
        }
      }
      thisMonth {
        mrr {
          ...PlatformMetricFields
        }
        collected {
          ...PlatformMetricFields
        }
        outstanding {
          ...PlatformMetricFields
        }
        newStoresLive {
          ...PlatformMetricFields
        }
        churned {
          ...PlatformMetricFields
        }
        aiCostUsd {
          ...PlatformMetricFields
        }
      }
      development {
        totalCount
        items {
          tenantId
          name
          slug
          days
          detail
        }
      }
      whatNeedsAttention {
        date
        generatedAt
        bullets
        items {
          text
          storeIds
          metricKeys
          # PRD-036 round 2 gaps: the attention rule behind the item (null when none fired)
          rule
        }
      }
    }
  }

  fragment PlatformMetricFields on PlatformMetric {
    key
    label
    unit
    value
    previousValue
    changePercent
    status
    count
    names
    reason
    fix
    definition
    formula
  }
`;

// ─── Tabs (guide §4) ──────────────────────────────────────────────────────

export const PLATFORM_METRICS = gql`
  query PlatformMetrics($period: PlatformMetricsPeriod!) {
    platformMetrics(period: $period) {
      period
      from
      to
      computedAt
      dataThrough
      stale
      activeStores
      smallSampleThreshold
      smallSample
      sections {
        key
        metrics {
          key
          label
          section
          unit
          value
          previousValue
          changePercent
          status
          count
          names
          reason
          fix
          definition
          formula
          items {
            label
            value
            total
            tenantId
            values {
              key
              value
            }
          }
          coverage {
            covered
            total
          }
        }
      }
      lists {
        atRisk {
          tenantId
          name
          slug
          status
          score
          reasons
        }
        overdue {
          tenantId
          name
          slug
          value
          days
        }
        inGrace {
          tenantId
          name
          slug
        }
        churned {
          tenantId
          name
          slug
          detail
          days
        }
        development {
          tenantId
          name
          slug
          days
          detail
        }
        newLive {
          tenantId
          name
          slug
        }
        topGmv {
          tenantId
          name
          slug
          value
        }
        bottomGmv {
          tenantId
          name
          slug
          value
        }
        growing {
          tenantId
          name
          slug
          value
        }
        shrinking {
          tenantId
          name
          slug
          value
        }
        dormant {
          tenantId
          name
          slug
          days
        }
      }
    }
  }
`;

// ─── Refresh now (guide §5) ───────────────────────────────────────────────

export const REFRESH_PLATFORM_METRICS = gql`
  mutation RefreshPlatformMetrics {
    refreshPlatformMetrics {
      computedAt
      refreshAvailableAt
    }
  }
`;

// ─── Ask ZCOM for staff (guide §12) ───────────────────────────────────────

export const ASK_ZCOM_PLATFORM = gql`
  mutation AskZcomPlatform($input: AskZcomPlatformInput!) {
    askZcomPlatform(input: $input) {
      id
      conversationId
      status
      seq
      delta
      toolActivity {
        tool
        label
        status
        ms
      }
    }
  }
`;

export const PLATFORM_ASSISTANT_RUN = gql`
  query PlatformAssistantRun($runId: ID!, $afterSeq: Int) {
    platformAssistantRun(runId: $runId, afterSeq: $afterSeq) {
      id
      conversationId
      status
      seq
      delta
      toolActivity {
        tool
        label
        status
        ms
      }
      message {
        id
        text
        sources
        rating
        createdAt
      }
      error {
        code
        reason
        message
      }
    }
  }
`;

export const PLATFORM_ASSISTANT_CANCEL_RUN = gql`
  mutation PlatformAssistantCancelRun($runId: ID!) {
    platformAssistantCancelRun(runId: $runId) {
      id
      status
    }
  }
`;

export const PLATFORM_ASSISTANT_USAGE = gql`
  query PlatformAssistantUsage {
    platformAssistantUsage {
      available
      reason
      tokensUsedThisMonth
      monthlyTokenBudget
      budgetUsedPercent
      monthResetsAt
    }
  }
`;

export const PLATFORM_ASSISTANT_CONVERSATIONS = gql`
  query PlatformAssistantConversations($limit: Int, $offset: Int) {
    platformAssistantConversations(limit: $limit, offset: $offset) {
      totalCount
      items {
        id
        title
        turnCount
        lastMessageAt
      }
    }
  }
`;

export const PLATFORM_ASSISTANT_CONVERSATION = gql`
  query PlatformAssistantConversation($id: ID!) {
    platformAssistantConversation(id: $id) {
      id
      title
      messages {
        id
        role
        text
        status
        sources
        rating
        createdAt
      }
    }
  }
`;

export const PLATFORM_ASSISTANT_DELETE_CONVERSATION = gql`
  mutation PlatformAssistantDeleteConversation($id: ID!) {
    platformAssistantDeleteConversation(id: $id)
  }
`;

export const PLATFORM_ASSISTANT_RATE_MESSAGE = gql`
  mutation PlatformAssistantRateMessage(
    $messageId: ID!
    $rating: PlatformAssistantRating!
    $reason: String
  ) {
    platformAssistantRateMessage(
      messageId: $messageId
      rating: $rating
      reason: $reason
    )
  }
`;
