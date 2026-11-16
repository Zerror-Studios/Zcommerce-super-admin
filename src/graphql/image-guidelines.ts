/**
 * Store image guidelines (PRD-045 D7, §5.6)
 *
 * The store page's Settings › Image guidelines card reads one store's
 * merged guidelines and saves its overrides through `updateTenant`. Kept
 * off the shared `PlatformTenantFields` fragment, like the PRD-025 reads,
 * so the stores list doesn't pay for a field only this card shows.
 */

import { gql } from "@apollo/client";

// ─── Fragments ────────────────────────────────────────────────────────────

export const IMAGE_GUIDELINE_FIELDS = gql`
  fragment ImageGuidelineFields on PlatformImageGuideline {
    slot
    width
    height
    minWidth
    minHeight
    ratio
    note
    isCustom
  }
`;

// ─── Queries ──────────────────────────────────────────────────────────────

/** The platform defaults merged with the store's overrides, in slot order. */
export const PLATFORM_TENANT_IMAGE_GUIDELINES = gql`
  ${IMAGE_GUIDELINE_FIELDS}
  query PlatformTenantImageGuidelines($id: ID!) {
    platformTenant(id: $id) {
      id
      imageGuidelines {
        ...ImageGuidelineFields
      }
    }
  }
`;

// ─── Mutations ────────────────────────────────────────────────────────────

/**
 * Replaces every override (`[]` clears them; `tenants:manage`). Returns the
 * merged list on the tenant's id so Apollo updates the read above.
 */
export const UPDATE_TENANT_IMAGE_GUIDELINES = gql`
  ${IMAGE_GUIDELINE_FIELDS}
  mutation UpdateTenantImageGuidelines($id: ID!, $input: UpdateTenantInput!) {
    updateTenant(id: $id, input: $input) {
      id
      imageGuidelines {
        ...ImageGuidelineFields
      }
    }
  }
`;
