/**
 * Platform users, the audit log and impersonation (PRD-005 FR-8, FR-10).
 */

import { gql } from "@apollo/client";
import { PLATFORM_USER_FIELDS } from "./auth";

export const PLATFORM_USERS = gql`
  ${PLATFORM_USER_FIELDS}
  query PlatformUsers($limit: Int, $offset: Int) {
    platformUsers(limit: $limit, offset: $offset) {
      items {
        ...PlatformUserFields
      }
      totalCount
    }
  }
`;

export const PLATFORM_INVITE_USER = gql`
  ${PLATFORM_USER_FIELDS}
  mutation PlatformInviteUser($email: String!, $name: String!, $role: PlatformRole!) {
    platformInviteUser(email: $email, name: $name, role: $role) {
      user {
        ...PlatformUserFields
      }
      setupUrl
    }
  }
`;

export const PLATFORM_UPDATE_USER_ROLE = gql`
  ${PLATFORM_USER_FIELDS}
  mutation PlatformUpdateUserRole($id: ID!, $role: PlatformRole!) {
    platformUpdateUserRole(id: $id, role: $role) {
      ...PlatformUserFields
    }
  }
`;

export const PLATFORM_DISABLE_USER = gql`
  ${PLATFORM_USER_FIELDS}
  mutation PlatformDisableUser($id: ID!) {
    platformDisableUser(id: $id) {
      ...PlatformUserFields
    }
  }
`;

export const PLATFORM_RESET_USER_MFA = gql`
  ${PLATFORM_USER_FIELDS}
  mutation PlatformResetUserMfa($id: ID!) {
    platformResetUserMfa(id: $id) {
      ...PlatformUserFields
    }
  }
`;

export const PLATFORM_AUDIT_LOG = gql`
  query PlatformAuditLog($filter: PlatformAuditFilter, $limit: Int, $offset: Int) {
    platformAuditLog(filter: $filter, limit: $limit, offset: $offset) {
      items {
        id
        actorId
        actorEmail
        action
        targetType
        targetId
        before
        after
        ip
        at
      }
      totalCount
    }
  }
`;

export const IMPERSONATE_TENANT = gql`
  mutation ImpersonateTenant($tenantId: ID!, $reason: String) {
    impersonateTenant(tenantId: $tenantId, reason: $reason) {
      accessToken
      expiresAt
      adminUrl
      adminEmail
      tenantId
    }
  }
`;
