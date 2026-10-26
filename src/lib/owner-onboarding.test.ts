import { describe, expect, it } from "vitest";
import { ownerNoticeKind, ownerNoticeKindEnum } from "./owner-onboarding";

describe("ownerNoticeKind (PRD-014 PLT-07)", () => {
  it("says the invite was sent and never shows a password then", () => {
    expect(
      ownerNoticeKind({ ownerInviteSent: true, ownerTemporaryPassword: "x" }),
    ).toBe(ownerNoticeKindEnum.INVITE_SENT);
  });

  it("shows a temporary password only from a server that still sends one", () => {
    expect(
      ownerNoticeKind({ ownerInviteSent: false, ownerTemporaryPassword: "x" }),
    ).toBe(ownerNoticeKindEnum.TEMPORARY_PASSWORD);
  });

  it("points to Resend owner invite when nothing was sent", () => {
    expect(
      ownerNoticeKind({ ownerInviteSent: false, ownerTemporaryPassword: null }),
    ).toBe(ownerNoticeKindEnum.INVITE_NOT_SENT);
  });
});
