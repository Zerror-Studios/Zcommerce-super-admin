/**
 * Platform identity operations (PRD-005 FR-1). Operation names matter: the
 * Apollo error link never refreshes or signs out on these.
 */

import { gql } from "@apollo/client";

export const PLATFORM_USER_FIELDS = gql`
  fragment PlatformUserFields on PlatformUser {
    id
    email
    name
    role
    status
    mfaEnabled
    lastLoginAt
    createdAt
  }
`;

export const PLATFORM_LOGIN = gql`
  ${PLATFORM_USER_FIELDS}
  mutation PlatformLogin($email: String!, $password: String!, $totp: String) {
    platformLogin(email: $email, password: $password, totp: $totp) {
      accessToken
      csrfToken
      expiresIn
      mfaRequired
      user {
        ...PlatformUserFields
      }
    }
  }
`;

export const PLATFORM_LOGOUT = gql`
  mutation PlatformLogout {
    platformLogout
  }
`;

/** Ends every session of the signed-in user, this one included (PRD-014 PLT-13). */
export const PLATFORM_LOGOUT_ALL = gql`
  mutation PlatformLogoutAll {
    platformLogoutAll
  }
`;

export const PLATFORM_ME = gql`
  ${PLATFORM_USER_FIELDS}
  query PlatformMe {
    platformMe {
      ...PlatformUserFields
    }
  }
`;

export const PLATFORM_ENROL_MFA = gql`
  mutation PlatformEnrolMfa($password: String!, $currentCode: String) {
    platformEnrolMfa(password: $password, currentCode: $currentCode) {
      otpauthUrl
      secret
    }
  }
`;

export const PLATFORM_CONFIRM_MFA = gql`
  mutation PlatformConfirmMfa($totp: String!) {
    platformConfirmMfa(totp: $totp) {
      recoveryCodes
      accessToken
    }
  }
`;

/** Always `true`, whether or not the email has an account (PRD-014 §5.2). */
export const PLATFORM_REQUEST_PASSWORD_RESET = gql`
  mutation PlatformRequestPasswordReset($email: String!) {
    platformRequestPasswordReset(email: $email)
  }
`;

export const PLATFORM_SET_PASSWORD = gql`
  mutation PlatformSetPassword($token: String!, $password: String!) {
    platformSetPassword(token: $token, password: $password)
  }
`;

// ─── Profile & security (PRD-024 FR-4.3) ──────────────────────────────────

/** Re-checks the current password and signs out every other session. */
export const PLATFORM_CHANGE_PASSWORD = gql`
  mutation PlatformChangePassword(
    $currentPassword: String!
    $newPassword: String!
  ) {
    platformChangePassword(
      currentPassword: $currentPassword
      newPassword: $newPassword
    )
  }
`;

/** The signed-in user's own unrevoked sessions. */
export const PLATFORM_MY_SESSIONS = gql`
  query PlatformMySessions {
    platformMySessions {
      id
      userAgent
      ipAddress
      createdAt
      lastUsedAt
      expiresAt
      current
    }
  }
`;

/** Ends one of the caller's own sessions (never another user's). */
export const REVOKE_PLATFORM_SESSION = gql`
  mutation RevokePlatformSession($id: ID!) {
    revokePlatformSession(id: $id)
  }
`;
