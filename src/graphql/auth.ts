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

export const PLATFORM_SET_PASSWORD = gql`
  mutation PlatformSetPassword($token: String!, $password: String!) {
    platformSetPassword(token: $token, password: $password)
  }
`;
