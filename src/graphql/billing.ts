/**
 * Platform invoices, payments, coupons and reminders (PRD-005 FR-5, FR-7.2, FR-7.3).
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
  }
`;

export const PLATFORM_PAYMENTS = gql`
  query PlatformPayments($filter: PlatformPaymentFilter, $limit: Int, $offset: Int) {
    platformPayments(filter: $filter, limit: $limit, offset: $offset) {
      items {
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
      }
      totalCount
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
    maxRedemptions
    redemptions
    expiresAt
    active
    createdAt
  }
`;

export const PLATFORM_COUPONS = gql`
  ${PLATFORM_COUPON_FIELDS}
  query PlatformCoupons {
    platformCoupons {
      ...PlatformCouponFields
    }
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

