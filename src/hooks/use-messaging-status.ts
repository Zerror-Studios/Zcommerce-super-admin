/**
 * `platformMessagingStatus` (PRD-024 FR-4.2.4, billing:read): whether the
 * backend can send SMS and WhatsApp reminders. Read once per session; the
 * env names only change with a backend deploy.
 */

import { useQuery } from "@apollo/client";

import { PLATFORM_MESSAGING_STATUS } from "../graphql/settings";
import type { MessagingStatusState } from "../lib/messaging-channels.util";
import { PLATFORM_PERMISSIONS } from "../lib/permissions";
import { useAuth } from "../providers/AuthProvider";
import type { PlatformMessagingStatus } from "../types/platform-api";

export function useMessagingStatus(): MessagingStatusState {
  const { isAuthenticated, can } = useAuth();
  const query = useQuery<{ platformMessagingStatus: PlatformMessagingStatus }>(
    PLATFORM_MESSAGING_STATUS,
    {
      skip: !isAuthenticated || !can(PLATFORM_PERMISSIONS.BILLING_READ),
      fetchPolicy: "cache-first",
    },
  );
  return {
    status: query.data?.platformMessagingStatus ?? null,
    loading: query.loading,
    error: !!query.error,
  };
}
