/**
 * Platform notifications feed (PRD-024 FR-4.1)
 *
 * The bell's unread counts, one page of a tab, and the per-user read marks.
 * The server returns only the kinds the caller may read (FR-4.1.3); the
 * console also skips the tabs the role can't open, so a count is never
 * asked for a category the caller can't see. No fragments: the documents
 * name only the PRD's root fields and enums, not the item type's name.
 */

import { gql } from "@apollo/client";

/** One page of a tab, newest first. */
export const PLATFORM_NOTIFICATIONS = gql`
  query PlatformNotifications(
    $category: PlatformNotificationCategory!
    $limit: Int!
    $offset: Int!
  ) {
    platformNotifications(
      category: $category
      limit: $limit
      offset: $offset
    ) {
      items {
        id
        kind
        category
        severity
        title
        body
        tenantId
        tenantName
        link
        createdAt
        read
      }
      totalCount
      unreadCount
    }
  }
`;

/** Unread count per tab for the bell (polled every 60 s while visible). */
export const PLATFORM_NOTIFICATION_COUNTS = gql`
  query PlatformNotificationCounts(
    $payments: Boolean!
    $stores: Boolean!
    $health: Boolean!
  ) {
    payments: platformNotifications(category: PAYMENTS, limit: 1, offset: 0)
      @include(if: $payments) {
      unreadCount
    }
    stores: platformNotifications(category: STORES, limit: 1, offset: 0)
      @include(if: $stores) {
      unreadCount
    }
    health: platformNotifications(category: HEALTH, limit: 1, offset: 0)
      @include(if: $health) {
      unreadCount
    }
  }
`;

/** Returns how many were newly marked. */
export const MARK_PLATFORM_NOTIFICATIONS_READ = gql`
  mutation MarkPlatformNotificationsRead($ids: [ID!]!) {
    markPlatformNotificationsRead(ids: $ids)
  }
`;

/** "Mark all read" for one tab. */
export const MARK_ALL_PLATFORM_NOTIFICATIONS_READ = gql`
  mutation MarkAllPlatformNotificationsRead(
    $category: PlatformNotificationCategory!
  ) {
    markAllPlatformNotificationsRead(category: $category)
  }
`;
