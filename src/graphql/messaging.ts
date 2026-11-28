/**
 * Console › Messaging (backend PRD-050 FR-1.1, FR-1.2, FR-1.10, FR-1.11;
 * platform-admin subgraph, `messaging.schema.ts`): the MSG91 work queue,
 * every store's MSG91 account and the message rates; since FR-4.6 the
 * stores' prepaid message balances, their ledgers and top-up requests.
 *
 * Reads need platform:messaging:read; every mutation needs
 * platform:messaging:manage. No field ever returns a credential: accounts
 * say only `hasAuthKey` / `hasSmtpLogin`.
 */

import { gql } from "@apollo/client";

// ─── Fragments ────────────────────────────────────────────────────────────

const MESSAGING_TASK_FIELDS = gql`
  fragment PlatformMessagingTaskFields on PlatformMessagingTask {
    id
    tenantId
    slug
    storeName
    type
    subject
    status
    values {
      label
      value
    }
    source
    dueAt
    overdue
    note
    rejectReason
    completedAt
    completedBy
    reopenedCount
    createdAt
    updatedAt
  }
`;

const MESSAGING_ACCOUNT_FIELDS = gql`
  fragment PlatformMessagingAccountFields on PlatformMessagingAccount {
    tenantId
    slug
    storeName
    kind
    state
    childId
    childUsername
    hasAuthKey
    hasSmtpLogin
    smtpHost
    sendMode
    sendingEnabled
    sendingEnabledAt
    domain
    domainRecords {
      type
      host
      value
      purpose
      required
      priority
    }
    msg91Verified
    sharedDomainVerified
    hourlyEmailLimit
    kycStatus
    kycNote
    kycUpdatedAt
    kycUpdatedBy
    whatsapp {
      status
      number
      wabaId
      displayName
      displayNameStatus
      businessVerification
      limitTier
      qualityRating
      requestedNumber
      requestedDisplayName
      requestedAt
      connectedAt
      healthCheckedAt
      healthSource
      healthError
      statusNote
    }
    lastTestOk
    lastTestAt
    lastTestMessage
    failureReason
    requestedAt
    connectedAt
    version
    updatedAt
  }
`;

const MESSAGING_RATE_TABLE_FIELDS = gql`
  fragment PlatformMessagingRateTableFields on PlatformMessagingRateTable {
    MARKETING
    TRANSACTIONAL
    SERVICE
  }
`;

const MESSAGING_SETTINGS_FIELDS = gql`
  fragment PlatformMessagingSettingsFields on PlatformMessagingSettings {
    rates {
      version
      updatedAt
      updatedBy
      EMAIL {
        ...PlatformMessagingRateTableFields
      }
      SMS {
        ...PlatformMessagingRateTableFields
      }
      WHATSAPP {
        ...PlatformMessagingRateTableFields
      }
      WHATSAPP_CATEGORY {
        MARKETING
        UTILITY
        AUTHENTICATION
        SERVICE
      }
    }
    addClientApiEnabled
    parentHourlyEmailLimit
    marketingHourlySharePercent
    whatsappNumberMonthlyFeePaise
  }
  ${MESSAGING_RATE_TABLE_FIELDS}
`;

// ─── Queries ──────────────────────────────────────────────────────────────

export const PLATFORM_MESSAGING_TASKS = gql`
  query PlatformMessagingTasks(
    $status: PlatformMessagingTaskStatus
    $type: PlatformMessagingTaskType
    $tenantId: ID
    $limit: Int
    $offset: Int
  ) {
    platformMessagingTasks(
      status: $status
      type: $type
      tenantId: $tenantId
      limit: $limit
      offset: $offset
    ) {
      items {
        ...PlatformMessagingTaskFields
      }
      totalCount
      openCount
      overdueCount
    }
  }
  ${MESSAGING_TASK_FIELDS}
`;

export const PLATFORM_MESSAGING_ACCOUNTS = gql`
  query PlatformMessagingAccounts(
    $state: PlatformMessagingAccountState
    $limit: Int
    $offset: Int
  ) {
    platformMessagingAccounts(state: $state, limit: $limit, offset: $offset) {
      items {
        ...PlatformMessagingAccountFields
      }
      totalCount
    }
  }
  ${MESSAGING_ACCOUNT_FIELDS}
`;

export const PLATFORM_MESSAGING_ACCOUNT = gql`
  query PlatformMessagingAccount($tenantId: ID!) {
    platformMessagingAccount(tenantId: $tenantId) {
      ...PlatformMessagingAccountFields
    }
  }
  ${MESSAGING_ACCOUNT_FIELDS}
`;

export const PLATFORM_MESSAGING_SETTINGS = gql`
  query PlatformMessagingSettings {
    platformMessagingSettings {
      ...PlatformMessagingSettingsFields
    }
  }
  ${MESSAGING_SETTINGS_FIELDS}
`;

/**
 * Backend PRD-051 FR-11 (Q6), platform:messaging:read: the WhatsApp number
 * fees of a month (default this IST month). BAD_USER_INPUT INVALID_MONTH,
 * INVALID_STATUS.
 */
export const PLATFORM_WHATSAPP_NUMBER_FEES = gql`
  query PlatformWhatsAppNumberFees(
    $month: String
    $status: PlatformWhatsAppNumberFeeStatus
    $limit: Int
    $offset: Int
  ) {
    platformWhatsAppNumberFees(
      month: $month
      status: $status
      limit: $limit
      offset: $offset
    ) {
      month
      feePaise
      total
      items {
        tenantId
        tenantName
        month
        amountPaise
        status
        numberLast4
        attempts
        lastError
        chargedAt
        createdAt
      }
    }
  }
`;

// ─── Mutations ────────────────────────────────────────────────────────────

export const CREATE_MESSAGING_CHILD_ACCOUNT = gql`
  mutation CreateMessagingChildAccount(
    $tenantId: ID!
    $input: PlatformMessagingCreateChildInput
  ) {
    createMessagingChildAccount(tenantId: $tenantId, input: $input) {
      ...PlatformMessagingAccountFields
    }
  }
  ${MESSAGING_ACCOUNT_FIELDS}
`;

export const CONNECT_MESSAGING_ACCOUNT = gql`
  mutation ConnectMessagingAccount(
    $tenantId: ID!
    $input: PlatformMessagingConnectInput!
  ) {
    connectMessagingAccount(tenantId: $tenantId, input: $input) {
      ...PlatformMessagingAccountFields
    }
  }
  ${MESSAGING_ACCOUNT_FIELDS}
`;

export const COMPLETE_MESSAGING_TASK = gql`
  mutation CompleteMessagingTask(
    $id: ID!
    $input: PlatformMessagingTaskCompleteInput
  ) {
    completeMessagingTask(id: $id, input: $input) {
      ...PlatformMessagingTaskFields
    }
  }
  ${MESSAGING_TASK_FIELDS}
`;

export const REJECT_MESSAGING_TASK = gql`
  mutation RejectMessagingTask($id: ID!, $reason: String!) {
    rejectMessagingTask(id: $id, reason: $reason) {
      ...PlatformMessagingTaskFields
    }
  }
  ${MESSAGING_TASK_FIELDS}
`;

export const UPDATE_PLATFORM_MESSAGING_SETTINGS = gql`
  mutation UpdatePlatformMessagingSettings(
    $input: PlatformMessagingSettingsInput!
  ) {
    updatePlatformMessagingSettings(input: $input) {
      ...PlatformMessagingSettingsFields
    }
  }
  ${MESSAGING_SETTINGS_FIELDS}
`;

// ─── KYC and the hourly email limit (D21) ─────────────────────────────────

export const SET_MESSAGING_ACCOUNT_KYC = gql`
  mutation SetMessagingAccountKyc(
    $tenantId: ID!
    $status: PlatformMessagingKycStatus!
    $note: String
  ) {
    setMessagingAccountKyc(tenantId: $tenantId, status: $status, note: $note) {
      ...PlatformMessagingAccountFields
    }
  }
  ${MESSAGING_ACCOUNT_FIELDS}
`;

export const SET_MESSAGING_HOURLY_EMAIL_LIMIT = gql`
  mutation SetMessagingHourlyEmailLimit($tenantId: ID!, $hourlyEmailLimit: Int!) {
    setMessagingHourlyEmailLimit(tenantId: $tenantId, hourlyEmailLimit: $hourlyEmailLimit) {
      ...PlatformMessagingAccountFields
    }
  }
  ${MESSAGING_ACCOUNT_FIELDS}
`;

// ─── WhatsApp numbers (backend PRD-051 FR-1) ──────────────────────────────

/** messaging:manage, audited. BAD_USER_INPUT INVALID_INPUT (with `field`); NOT_FOUND (no account yet). */
export const UPDATE_MESSAGING_WHATSAPP_NUMBER = gql`
  mutation UpdateMessagingWhatsAppNumber($tenantId: ID!, $input: PlatformWhatsAppNumberInput!) {
    updateMessagingWhatsAppNumber(tenantId: $tenantId, input: $input) {
      ...PlatformMessagingAccountFields
    }
  }
  ${MESSAGING_ACCOUNT_FIELDS}
`;

/** messaging:manage, audited. CONFLICT MESSAGING_ACCOUNT_NOT_READY; an MSG91 failure comes back as `whatsapp.healthError`. */
export const REFRESH_MESSAGING_WHATSAPP_HEALTH = gql`
  mutation RefreshMessagingWhatsAppHealth($tenantId: ID!) {
    refreshMessagingWhatsAppHealth(tenantId: $tenantId) {
      ...PlatformMessagingAccountFields
    }
  }
  ${MESSAGING_ACCOUNT_FIELDS}
`;

// ─── Message balances and top-ups (FR-4.6) ────────────────────────────────

const MESSAGING_BALANCE_FIELDS = gql`
  fragment PlatformMessagingBalanceFields on PlatformMessagingBalance {
    tenantId
    tenantName
    balancePaise
    reservedPaise
    availablePaise
    lastTopUpPaise
    level
    updatedAt
    autoTopUpEnabled
    autoTopUpThresholdPaise
    autoTopUpAmountPaise
  }
`;

const MESSAGING_TOPUP_FIELDS = gql`
  fragment PlatformMessagingTopUpFields on PlatformMessagingTopUp {
    id
    tenantId
    tenantName
    number
    amountPaise
    status
    provider
    reference
    requestedBy
    auto
    paidAt
    paidBy
    createdAt
  }
`;

export const PLATFORM_MESSAGING_BALANCES = gql`
  query PlatformMessagingBalances($lowOnly: Boolean, $limit: Int, $offset: Int) {
    platformMessagingBalances(lowOnly: $lowOnly, limit: $limit, offset: $offset) {
      items {
        ...PlatformMessagingBalanceFields
      }
      total
    }
  }
  ${MESSAGING_BALANCE_FIELDS}
`;

export const PLATFORM_MESSAGING_BALANCE = gql`
  query PlatformMessagingBalance($tenantId: ID!, $limit: Int, $offset: Int) {
    platformMessagingBalance(
      tenantId: $tenantId
      limit: $limit
      offset: $offset
    ) {
      balance {
        ...PlatformMessagingBalanceFields
      }
      ledger {
        id
        kind
        amountPaise
        reservedDeltaPaise
        balanceAfterPaise
        reason
        by
        campaignId
        automationRunId
        topUpId
        createdAt
      }
      ledgerTotal
      topUps {
        ...PlatformMessagingTopUpFields
      }
    }
  }
  ${MESSAGING_BALANCE_FIELDS}
  ${MESSAGING_TOPUP_FIELDS}
`;

export const PLATFORM_MESSAGING_TOPUPS = gql`
  query PlatformMessagingTopUps(
    $status: PlatformMessagingTopUpStatus
    $tenantId: ID
    $limit: Int
    $offset: Int
  ) {
    platformMessagingTopUps(
      status: $status
      tenantId: $tenantId
      limit: $limit
      offset: $offset
    ) {
      items {
        ...PlatformMessagingTopUpFields
      }
      total
    }
  }
  ${MESSAGING_TOPUP_FIELDS}
`;

export const ADJUST_MESSAGING_BALANCE = gql`
  mutation AdjustMessagingBalance(
    $tenantId: ID!
    $amountPaise: Int!
    $reason: String!
  ) {
    adjustMessagingBalance(
      tenantId: $tenantId
      amountPaise: $amountPaise
      reason: $reason
    ) {
      ...PlatformMessagingBalanceFields
    }
  }
  ${MESSAGING_BALANCE_FIELDS}
`;

export const COMPLETE_MESSAGING_TOPUP = gql`
  mutation CompleteMessagingTopUp($id: ID!, $reference: String!) {
    completeMessagingTopUp(id: $id, reference: $reference) {
      ...PlatformMessagingTopUpFields
    }
  }
  ${MESSAGING_TOPUP_FIELDS}
`;

export const CANCEL_MESSAGING_TOPUP = gql`
  mutation CancelMessagingTopUp($id: ID!, $reason: String!) {
    cancelMessagingTopUp(id: $id, reason: $reason) {
      ...PlatformMessagingTopUpFields
    }
  }
  ${MESSAGING_TOPUP_FIELDS}
`;

// ─── Usage reconciliation (backend PRD-050 D20, FR-1.11) ──────────────────

const MESSAGING_USAGE_COUNT_FIELDS = gql`
  fragment PlatformMessagingUsageCountFields on PlatformMessagingUsageCount {
    total
    byPurpose {
      MARKETING
      TRANSACTIONAL
      SERVICE
    }
  }
`;

export const PLATFORM_MESSAGING_RECONCILIATIONS = gql`
  query PlatformMessagingReconciliations(
    $month: String
    $status: PlatformMessagingReconciliationStatus
    $limit: Int
    $offset: Int
  ) {
    platformMessagingReconciliations(
      month: $month
      status: $status
      limit: $limit
      offset: $offset
    ) {
      month
      months
      total
      totals {
        stores
        matched
        mismatched
        providerErrors
        noProviderData
        ours
        provider
      }
      items {
        id
        tenantId
        scope
        slug
        storeName
        month
        status
        ours {
          ...PlatformMessagingUsageCountFields
        }
        usageCounter {
          ...PlatformMessagingUsageCountFields
        }
        storeSmtp
        provider {
          total
          rows
          days
        }
        difference
        differencePct
        tolerance
        error
        attempts
        checkedAt
        parentSources {
          storeShared
          platformMail
          stores
        }
      }
    }
  }
  ${MESSAGING_USAGE_COUNT_FIELDS}
`;

export const RERUN_MESSAGING_RECONCILIATION = gql`
  mutation RerunMessagingReconciliation($month: String!, $tenantId: ID) {
    rerunMessagingReconciliation(month: $month, tenantId: $tenantId) {
      month
      stores
      matched
      mismatched
      providerErrors
      noProviderData
      failed
    }
  }
`;

// Backend PRD-051 FR-13 (platform:messaging:read): stores with an MSG91
// WhatsApp install and what moving each to its sub-account needs. Read only;
// the move itself is the owner-run `messaging-whatsapp-move` CLI.
export const PLATFORM_WHATSAPP_MOVE_REPORT = gql`
  query PlatformWhatsAppMoveReport {
    platformWhatsAppMoveReport {
      slug
      tenantId
      sample
      moved
      needs
      install {
        authKey
        numberLast4
      }
      templates {
        total
        approved
        builder
      }
      account {
        state
        authKey
        kyc
        whatsappStatus
        whatsappNumberLast4
        sameNumber
        movedFromInstallAt
      }
    }
  }
`;
