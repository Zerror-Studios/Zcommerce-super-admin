import { describe, expect, it } from "vitest";
import { isSessionRejection } from "./session-failure.util";

const graphQLError = (code: string) => ({
  graphQLErrors: [{ message: "x", extensions: { code } }],
});

describe("isSessionRejection (FE-23)", () => {
  it("signs out only when the server rejects the session", () => {
    expect(isSessionRejection(graphQLError("UNAUTHENTICATED"))).toBe(true);
    expect(isSessionRejection(graphQLError("INVALID_AUTH_TOKEN"))).toBe(true);
  });

  it("keeps the session on a network failure or a server error", () => {
    expect(
      isSessionRejection({ graphQLErrors: [], networkError: new TypeError("Failed to fetch") }),
    ).toBe(false);
    expect(isSessionRejection(graphQLError("INTERNAL_SERVER_ERROR"))).toBe(false);
    expect(isSessionRejection(undefined)).toBe(false);
  });
});
