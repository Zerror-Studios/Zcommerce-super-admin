import { describe, expect, it } from "vitest";
import { ownerContactGaps } from "./owner-contact.util";

describe("ownerContactGaps (PRD-024 FR-4.4)", () => {
  it("flags a store whose server row has no owner email", () => {
    expect(ownerContactGaps({ ownerEmailSet: false, ownerPhone: "9876543210" })).toEqual({
      isMissingEmail: true,
      isMissingPhone: false,
    });
  });

  it("flags a missing or blank owner phone", () => {
    expect(ownerContactGaps({ ownerEmailSet: true, ownerPhone: undefined }).isMissingPhone).toBe(true);
    expect(ownerContactGaps({ ownerEmailSet: true, ownerPhone: " " }).isMissingPhone).toBe(true);
  });

  it("doesn't flag a client the server didn't describe", () => {
    expect(ownerContactGaps({ ownerPhone: "9876543210" }).isMissingEmail).toBe(false);
  });
});
