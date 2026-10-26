/**
 * Platform invoices, payments, coupons and reminders (PRD-005 FR-5, FR-7.2,
 * FR-7.3), plus the PRD-016 review queue, refunds and credits (FR-19..21)
 * and the PRD-017 invoice list (FR-4.3).
 */

import { gql } from "@apollo/client";

export const PLATFORM_INVOICE_FIELDS = gql`
  fragment PlatformInvoiceFields on PlatformInvoice {
    id
    tenantId
    tenantName
    subscriptionId
    number
    planName
    billingCycle
    periodStart
    periodEnd
    amount
    discount
    tax
    total
    currency
    status
    issuedAt
    dueAt
    paidAt
    couponCode
    voidReason
    billingReason
    amountPaid
    creditApplied
    amountDue
    restart
  }
`;

/** PRD-017 FR-4.3: server-paged invoices (status, store, due-date, search). */
export const PLATFORM_INVOICES = gql`
  ${PLATFORM_INVOICE_FIELDS}
  query PlatformInvoices(
    $filter: PlatformInvoiceFilter
    $limit: Int
    $offset: Int
  ) {
    platformInvoices(filter: $filter, limit: $limit, offset: $offset) {
      items {
        ...PlatformInvoiceFields
      }
      totalCount
    }
  }
`;

/**
 * PRD-024 FR-3.8: one invoice's status history and linked payments, read
 * when its detail dialog opens (the lists don't select them). The invoice
 * search matches the number, so the dialog picks its row by id.
 */
export const PLATFORM_INVOICE_DETAIL = gql`
  query PlatformInvoiceDetail($filter: PlatformInvoiceFilter, $limit: Int) {
    platformInvoices(filter: $filter, limit: $limit) {
      items {
        id
        statusHistory {
          status
          at
          actor
        }
        payments {
          id
          amount
          currency
          provider
          type
          status
          transactionId
          createdAt
          failureReason
          flagged
          resolution
        }
      }
    }
  }
`;

export const PLATFORM_PAYMENT_FIELDS = gql`
  fragment PlatformPaymentFields on PlatformPayment {
    id
    tenantId
    tenantName
    amount
    currency
    provider
    type
    status
    planName
    transactionId
    periodStart
    periodEnd
    createdAt
    failureReason
    invoiceId
    expectedAmount
    flagged
    resolution
    resolutionNote
    resolvedAt
  }
`;

export const PLATFORM_PAYMENTS = gql`
  ${PLATFORM_PAYMENT_FIELDS}
  query PlatformPayments($filter: PlatformPaymentFilter, $limit: Int, $offset: Int) {
    platformPayments(filter: $filter, limit: $limit, offset: $offset) {
      items {
        ...PlatformPaymentFields
      }
      totalCount
      countsByStatus {
        status
        count
      }
    }
  }
`;

// ─── Review queue, refunds and credits (PRD-016 FR-19..FR-21) ─────────────

/** APPLY / REFUNDED_OUTSIDE / DISMISS a flagged payment, with a note. */
export const RESOLVE_FLAGGED_PLATFORM_PAYMENT = gql`
  ${PLATFORM_PAYMENT_FIELDS}
  mutation ResolveFlaggedPlatformPayment(
    $id: ID!
    $action: PlatformFlaggedPaymentAction!
    $invoiceId: ID
    $note: String!
  ) {
    resolveFlaggedPlatformPayment(
      id: $id
      action: $action
      invoiceId: $invoiceId
      note: $note
    ) {
      ...PlatformPaymentFields
    }
  }
`;

/** A refund Zerror made outside the platform (no provider call). */
export const RECORD_PLATFORM_REFUND = gql`
  ${PLATFORM_PAYMENT_FIELDS}
  mutation RecordPlatformRefund(
    $paymentId: ID!
    $amount: Float!
    $reference: String!
    $reason: String!
  ) {
    recordPlatformRefund(
      paymentId: $paymentId
      amount: $amount
      reference: $reference
      reason: $reason
    ) {
      ...PlatformPaymentFields
    }
  }
`;

export const PLATFORM_CREDIT_FIELDS = gql`
  fragment PlatformCreditFields on PlatformCredit {
    id
    tenantId
    number
    amount
    remaining
    reason
    note
    sourceInvoiceId
    createdBy
    createdAt
  }
`;

export const PLATFORM_CREDITS = gql`
  ${PLATFORM_CREDIT_FIELDS}
  query PlatformCredits($tenantId: ID!) {
    platformCredits(tenantId: $tenantId) {
      ...PlatformCreditFields
    }
  }
`;

/** A MANUAL credit; spent by the store's next invoices, never paid out. */
export const ISSUE_PLATFORM_CREDIT = gql`
  ${PLATFORM_CREDIT_FIELDS}
  mutation IssuePlatformCredit(
    $tenantId: ID!
    $amount: Float!
    $reason: String!
  ) {
    issuePlatformCredit(tenantId: $tenantId, amount: $amount, reason: $reason) {
      ...PlatformCreditFields
    }
  }
`;

export const RECORD_INVOICE_PAYMENT = gql`
  ${PLATFORM_INVOICE_FIELDS}
  mutation RecordInvoicePayment($id: ID!, $amount: Float!, $paidAt: String!, $reference: String!) {
    recordInvoicePayment(id: $id, amount: $amount, paidAt: $paidAt, reference: $reference) {
      ...PlatformInvoiceFields
    }
  }
`;

export const VOID_INVOICE = gql`
  ${PLATFORM_INVOICE_FIELDS}
  mutation VoidInvoice($id: ID!, $reason: String!) {
    voidInvoice(id: $id, reason: $reason) {
      ...PlatformInvoiceFields
    }
  }
`;

export const APPLY_COUPON_TO_INVOICE = gql`
  ${PLATFORM_INVOICE_FIELDS}
  mutation ApplyCouponToInvoice($invoiceId: ID!, $code: String!) {
    applyCouponToInvoice(invoiceId: $invoiceId, code: $code) {
      ...PlatformInvoiceFields
    }
  }
`;

// ─── Coupons ──────────────────────────────────────────────────────────────

export const PLATFORM_COUPON_FIELDS = gql`
  fragment PlatformCouponFields on PlatformCoupon {
    id
    code
    discountType
    discountValue
    appliesTo
    appliesToPlanIds
    maxRedemptions
    redemptions
    expiresAt
    active
    createdAt
  }
`;

export const PLATFORM_COUPONS = gql`
  ${PLATFORM_COUPON_FIELDS}
  query PlatformCoupons(
    $limit: Int
    $offset: Int
    $search: String
    $status: [PlatformCouponStatus!]
  ) {
    platformCoupons(limit: $limit, offset: $offset, search: $search, status: $status) {
      ...PlatformCouponFields
    }
    platformCouponCount(search: $search, status: $status)
  }
`;

export const CREATE_PLATFORM_COUPON = gql`
  ${PLATFORM_COUPON_FIELDS}
  mutation CreatePlatformCoupon($input: PlatformCouponInput!) {
    createPlatformCoupon(input: $input) {
      ...PlatformCouponFields
    }
  }
`;

// ─── Reminders ────────────────────────────────────────────────────────────

export const PREVIEW_RENEWAL_REMINDER = gql`
  query PreviewRenewalReminder($tenantId: ID!) {
    previewRenewalReminder(tenantId: $tenantId) {
      tenantId
      recipient
      channel
      subject
      body
      daysUntilDue
    }
  }
`;

export const SEND_RENEWAL_REMINDERS = gql`
  mutation SendRenewalReminders($tenantIds: [ID!]!, $channels: [PlatformReminderChannel!]) {
    sendRenewalReminders(tenantIds: $tenantIds, channels: $channels) {
      queued
      skipped {
        tenantId
        reason
      }
    }
  }
`;


// ─── Coupon edits (PRD-014 PLT-13) ────────────────────────────────────────

export const UPDATE_PLATFORM_COUPON = gql`
  ${PLATFORM_COUPON_FIELDS}
  mutation UpdatePlatformCoupon($id: ID!, $input: PlatformCouponUpdateInput!) {
    updatePlatformCoupon(id: $id, input: $input) {
      ...PlatformCouponFields
    }
  }
`;

export const DEACTIVATE_PLATFORM_COUPON = gql`
  ${PLATFORM_COUPON_FIELDS}
  mutation DeactivatePlatformCoupon($id: ID!) {
    deactivatePlatformCoupon(id: $id) {
      ...PlatformCouponFields
    }
  }
`;

// ─── Jobs (PRD-014 PLT-13) ────────────────────────────────────────────────

/** Runs the daily billing cycle or the reminder pass now (settings:manage). */
export const RUN_PLATFORM_JOB = gql`
  mutation RunPlatformJob($job: PlatformBillingJob!) {
    runPlatformJob(job: $job)
  }
`;

/** Runs today's usage snapshot now (settings:manage). */
export const RUN_USAGE_SNAPSHOT_JOB = gql`
  mutation RunUsageSnapshotJob {
    runUsageSnapshotJob
  }
`;

/**
 * PRD-018 FR-1.8 (billing:read): store payments still PENDING 48 h after
 * they were opened, in every SUSPENDED store (or one store by
 * `tenantId`), oldest first; `partial` = a store DB couldn't be read.
 */
export const PLATFORM_STALE_PENDING_PAYMENTS = gql`
  query PlatformStalePendingPayments($tenantId: ID, $limit: Int) {
    platformStalePendingPayments(tenantId: $tenantId, limit: $limit) {
      items {
        tenantId
        tenantName
        tenantSlug
        tenantStatus
        paymentId
        orderId
        provider
        amount
        currency
        createdAt
        lastEnquiryAt
      }
      partial
    }
  }
`;
