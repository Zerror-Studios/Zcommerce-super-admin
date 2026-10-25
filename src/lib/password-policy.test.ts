import { describe, expect, it } from "vitest";
import {
  MIN_PASSWORD_LENGTH,
  looksLikeEmail,
  passwordPolicyError,
} from "./password-policy";

describe("passwordPolicyError (PRD-014 UX-34)", () => {
  it("uses the shared 8-character minimum", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });

  it("rejects a 7-character password", () => {
    expect(passwordPolicyError("abcdefg")).toBe("Use at least 8 characters.");
  });

  it("accepts an 8-character password", () => {
    expect(passwordPolicyError("abcdefgh")).toBeNull();
  });
});

describe("looksLikeEmail", () => {
  it("accepts a plain address with surrounding spaces", () => {
    expect(looksLikeEmail(" ops@zerrorstudios.com ")).toBe(true);
  });

  it("rejects text without a domain", () => {
    expect(looksLikeEmail("ops@")).toBe(false);
    expect(looksLikeEmail("ops")).toBe(false);
  });
});
