/**
 * Owner onboarding after provisioning (PRD-014 FR-1.10, PLT-07)
 *
 * `createTenant` now emails the owner a set-password link and returns
 * `ownerInviteSent`; `ownerTemporaryPassword` stays in the schema as null.
 * This decides what the "store is ready" dialog says, so a password is
 * shown only by a server that still sends one.
 */

// ─── Types ────────────────────────────────────────────────────────────────

export const ownerNoticeKindEnum = {
  INVITE_SENT: "INVITE_SENT",
  TEMPORARY_PASSWORD: "TEMPORARY_PASSWORD",
  INVITE_NOT_SENT: "INVITE_NOT_SENT",
} as const;

export type OwnerNoticeKind =
  (typeof ownerNoticeKindEnum)[keyof typeof ownerNoticeKindEnum];

export interface OwnerOnboardingResult {
  ownerInviteSent: boolean;
  ownerTemporaryPassword: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Which notice the dialog shows; an emailed invite always wins. */
export function ownerNoticeKind(result: OwnerOnboardingResult): OwnerNoticeKind {
  if (result.ownerInviteSent) return ownerNoticeKindEnum.INVITE_SENT;
  if (result.ownerTemporaryPassword) {
    return ownerNoticeKindEnum.TEMPORARY_PASSWORD;
  }
  return ownerNoticeKindEnum.INVITE_NOT_SENT;
}
