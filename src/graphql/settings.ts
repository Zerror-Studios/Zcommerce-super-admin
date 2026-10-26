/**
 * Platform settings (PRD-005 FR-7.1): health thresholds, grace period and
 * the renewal-reminder schedule, stored on the server.
 */

import { gql } from "@apollo/client";

export const PLATFORM_SETTINGS_FIELDS = gql`
  fragment PlatformSettingsFields on PlatformSettings {
    health {
      expiringWithinDays
      inactiveAfterDays
    }
    gracePeriodDays
    billing {
      provider
      configured
      checkoutAvailable
      bankTransferInstructions
      supportContact
    }
    reminders {
      daysBeforeDue
      daysAfterDue
      channels {
        email
        sms
        whatsapp
      }
      template
    }
    yearKind
    dunning {
      enabled
      pauseOrdersAfterDays
      suspendAfterDays
      trialSuspendAfterDays
    }
    entitlementsMode
  }
`;

export const PLATFORM_SETTINGS = gql`
  ${PLATFORM_SETTINGS_FIELDS}
  query PlatformSettings {
    platformSettings {
      ...PlatformSettingsFields
    }
  }
`;

export const UPDATE_PLATFORM_SETTINGS = gql`
  ${PLATFORM_SETTINGS_FIELDS}
  mutation UpdatePlatformSettings($input: PlatformSettingsInput!) {
    updatePlatformSettings(input: $input) {
      ...PlatformSettingsFields
    }
  }
`;

/** PRD-024 FR-4.2.4 (billing:read): which reminder channels can deliver. */
export const PLATFORM_MESSAGING_STATUS = gql`
  query PlatformMessagingStatus {
    platformMessagingStatus {
      smsConfigured
      whatsappConfigured
    }
  }
`;
