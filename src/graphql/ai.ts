/**
 * ZCOM AI for Zerror staff (PRD-021 FR-6, backend guide §9): usage and
 * cost per store, platform totals, top questions, `ai_config`, per-store
 * pause and overrides, top-ups, data health and benchmarks. Reads need
 * `platform:ai:read`; changes `platform:ai:manage` (MFA for manage roles)
 * and are audit-logged by the server.
 *
 * The selections are spelled out (no fragment interpolation) so the
 * workspace contract validator can check every document.
 */

import { gql } from "@apollo/client";

// ─── Reads ────────────────────────────────────────────────────────────────

export const AI_PLATFORM_TOTALS = gql`
  query AiPlatformTotals {
    aiPlatformTotals {
      spendTodayUsd
      dailyCapUsd
      dailyCapReached
      spendMonthUsd
      spendMonthInr
      monthlyBudgetUsd
      budgetUsedPercent
      alertsCrossed
      chatCalls
      answeredQuestions
      cachedAnswers
      avgCostPerQuestionUsd
      cacheHitRate
      refusals
      failures
      modelMix {
        model
        calls
        costUsd
      }
    }
  }
`;

export const AI_USAGE_BY_TENANT = gql`
  query AiUsageByTenant($limit: Int, $offset: Int, $search: String, $tenantId: ID) {
    aiUsageByTenant(limit: $limit, offset: $offset, search: $search, tenantId: $tenantId) {
      totalCount
      items {
        tenantId
        name
        slug
        planName
        aiEnabled
        paused
        questionsThisWeek
        questionsThisMonth
        questionsPerWeek
        percentOfLimit
        tokensThisMonth
        costUsdThisMonth
        costInrThisMonth
        cacheHitRate
      }
    }
  }
`;

export const AI_USAGE_CSV = gql`
  query AiUsageCsv {
    aiUsageCsv
  }
`;

/** One store only; the server writes an audit row for every view (Q10). */
export const AI_TOP_QUESTIONS = gql`
  query AiTopQuestions($tenantId: ID!, $limit: Int) {
    aiTopQuestions(tenantId: $tenantId, limit: $limit) {
      excerpt
      count
      lastAskedAt
    }
  }
`;

export const AI_CONFIG = gql`
  query AiConfig {
    aiConfig {
      enabled
      defaultModel
      reasoningModel
      allowedModels
      pricing {
        model
        inputPerMTok
        outputPerMTok
        cacheWritePerMTok
        cacheReadPerMTok
        batchDiscount
      }
      globalDailySpendCapUsd
      monthlyBudgetUsd
      alertThresholds
      usdInrRate
      nightCoolingStart
      nightCoolingEnd
      perQuestionTokenCeiling
      rateLimitPerMinute
      benchmarkMinStores
    }
  }
`;

export const AI_TENANT_SETTING = gql`
  query AiTenantSetting($tenantId: ID!) {
    aiTenantSetting(tenantId: $tenantId) {
      tenantId
      paused
      pausedReason
      questionsPerWeek
      connectorCallsPerWeek
      monthlyTokenBudget
    }
  }
`;

export const AI_TOP_UP_REQUESTS = gql`
  query AiTopUpRequests(
    $status: PlatformAiTopupRequestStatus
    $limit: Int
    $offset: Int
  ) {
    aiTopUpRequests(status: $status, limit: $limit, offset: $offset) {
      totalCount
      items {
        id
        tenantId
        storeName
        week
        status
        createdAt
        handledAt
      }
    }
  }
`;

export const AI_DATA_HEALTH = gql`
  query AiDataHealth($needsAttention: Boolean, $limit: Int, $offset: Int) {
    aiDataHealth(
      needsAttention: $needsAttention
      limit: $limit
      offset: $offset
    ) {
      totalCount
      items {
        tenantId
        storeName
        slug
        computedAt
        costCoveragePct
        settingsFilled
        spendMonths
        computeStatus
        computeMs
        canSeeProfitability
      }
    }
  }
`;

export const AI_BENCHMARKS = gql`
  query AiBenchmarks($period: PlatformAiBenchmarkPeriod) {
    aiBenchmarks(period: $period) {
      period
      metricKey
      category
      unit
      stores
      p25
      median
      p75
      computedFor
    }
  }
`;

// ─── Changes (platform:ai:manage) ─────────────────────────────────────────

export const UPDATE_AI_CONFIG = gql`
  mutation UpdateAiConfig($input: PlatformAiConfigInput!) {
    updateAiConfig(input: $input) {
      enabled
      defaultModel
      reasoningModel
      allowedModels
      pricing {
        model
        inputPerMTok
        outputPerMTok
        cacheWritePerMTok
        cacheReadPerMTok
        batchDiscount
      }
      globalDailySpendCapUsd
      monthlyBudgetUsd
      alertThresholds
      usdInrRate
      nightCoolingStart
      nightCoolingEnd
      perQuestionTokenCeiling
      rateLimitPerMinute
      benchmarkMinStores
    }
  }
`;

export const GRANT_AI_TOP_UP = gql`
  mutation GrantAiTopUp($tenantId: ID!, $questions: Int!, $note: String) {
    grantAiTopUp(tenantId: $tenantId, questions: $questions, note: $note) {
      id
      tenantId
      questions
      expiresAt
    }
  }
`;

export const DISMISS_AI_TOP_UP_REQUEST = gql`
  mutation DismissAiTopUpRequest($requestId: ID!) {
    dismissAiTopUpRequest(requestId: $requestId)
  }
`;

export const SET_TENANT_AI_PAUSED = gql`
  mutation SetTenantAiPaused(
    $tenantId: ID!
    $paused: Boolean!
    $reason: String
  ) {
    setTenantAiPaused(tenantId: $tenantId, paused: $paused, reason: $reason) {
      tenantId
      paused
      pausedReason
      questionsPerWeek
      connectorCallsPerWeek
      monthlyTokenBudget
    }
  }
`;

export const SET_TENANT_AI_OVERRIDE = gql`
  mutation SetTenantAiOverride(
    $tenantId: ID!
    $input: PlatformAiOverrideInput!
  ) {
    setTenantAiOverride(tenantId: $tenantId, input: $input) {
      tenantId
      paused
      pausedReason
      questionsPerWeek
      connectorCallsPerWeek
      monthlyTokenBudget
    }
  }
`;
