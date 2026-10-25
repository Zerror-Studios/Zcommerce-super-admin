/**
 * Apollo link tests (PRD-014 FR-1.11 CSRF, QA-27 first link-level tests)
 *
 * Runs the console's real error + auth links over a fake transport, with
 * `fetch` stubbed for the refresh call, so the header and the
 * refresh-and-retry rules are checked without a gateway.
 */

import {
  ApolloLink,
  Observable,
  execute,
  gql,
  type FetchResult,
  type Operation,
} from "@apollo/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { addToast } = vi.hoisted(() => ({ addToast: vi.fn() }));
vi.mock("@heroui/react", () => ({ addToast }));

import { CSRF_HEADER, apiLink, isMutationRequest } from "./apollo-client";
import {
  clearSession,
  getAccessToken,
  getCsrfToken,
  setAccessToken,
  setCsrfToken,
} from "./session-store";

// ─── Fixtures ─────────────────────────────────────────────────────────────

const MUTATION = gql`
  mutation SuspendTenant($id: ID!) {
    suspendTenant(id: $id, reason: "x") {
      id
    }
  }
`;

const QUERY = gql`
  query PlatformMe {
    platformMe {
      id
    }
  }
`;

const OK: FetchResult = { data: { ok: true } };
const CSRF_ERROR: FetchResult = {
  errors: [
    {
      message: "CSRF token required",
      extensions: { code: "FORBIDDEN", reason: "CSRF_REQUIRED" },
    },
  ] as never,
};

/** A JWT-shaped token whose `exp` is an hour away. */
function jwt(subject: string): string {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const payload = btoa(JSON.stringify({ sub: subject, exp }));
  return `header.${payload}.signature`;
}

/** Fake transport: answers from `replies` in order, recording each request. */
function transport(replies: FetchResult[]) {
  const seen: Array<Record<string, string>> = [];
  const link = new ApolloLink((operation: Operation) => {
    seen.push({ ...(operation.getContext().headers ?? {}) });
    const reply = replies.shift() ?? OK;
    return Observable.of(reply);
  });
  return { link, seen };
}

function run(
  query: typeof MUTATION,
  link: ApolloLink,
): Promise<FetchResult> {
  return new Promise((resolve, reject) => {
    execute(apiLink.concat(link), { query, variables: { id: "t1" } }).subscribe({
      next: resolve,
      error: reject,
    });
  });
}

function stubRefresh(accessToken: string, csrfToken: string) {
  const fetchMock = vi.fn(async () =>
    new Response(
      JSON.stringify({ data: { platformRefreshToken: { accessToken, csrfToken } } }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  clearSession();
  addToast.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Tests ────────────────────────────────────────────────────────────────

describe("isMutationRequest", () => {
  it("tells a mutation from a query", () => {
    expect(isMutationRequest(MUTATION)).toBe(true);
    expect(isMutationRequest(QUERY)).toBe(false);
  });
});

describe("CSRF header (PRD-014 FR-1.11)", () => {
  it("sends the session's CSRF token on a mutation", async () => {
    setCsrfToken("csrf-1");
    setAccessToken(jwt("a"));
    const { link, seen } = transport([OK]);
    await run(MUTATION, link);
    expect(seen[0][CSRF_HEADER]).toBe("csrf-1");
  });

  it("does not send it on a query", async () => {
    setCsrfToken("csrf-1");
    setAccessToken(jwt("a"));
    const { link, seen } = transport([OK]);
    await run(QUERY, link);
    expect(seen[0][CSRF_HEADER]).toBeUndefined();
  });

  it("refreshes once on CSRF_REQUIRED and retries with the new token", async () => {
    setAccessToken(jwt("old"));
    const fresh = jwt("new");
    const fetchMock = stubRefresh(fresh, "csrf-2");
    const { link, seen } = transport([CSRF_ERROR, OK]);

    const result = await run(MUTATION, link);

    expect(result).toEqual(OK);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(seen).toHaveLength(2);
    expect(seen[0][CSRF_HEADER]).toBeUndefined();
    expect(seen[1][CSRF_HEADER]).toBe("csrf-2");
    expect(seen[1].authorization).toBe(`Bearer ${fresh}`);
    expect(getAccessToken()).toBe(fresh);
    expect(getCsrfToken()).toBe("csrf-2");
    // A CSRF retry is not a permission problem.
    expect(addToast).not.toHaveBeenCalled();
  });

  it("does not loop when the retry is refused too", async () => {
    setAccessToken(jwt("old"));
    const fetchMock = stubRefresh(jwt("new"), "csrf-2");
    const { link, seen } = transport([CSRF_ERROR, CSRF_ERROR]);

    const result = await run(MUTATION, link);

    expect(result.errors?.[0].extensions?.reason).toBe("CSRF_REQUIRED");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(seen).toHaveLength(2);
    expect(addToast).toHaveBeenCalledTimes(1);
    expect(addToast.mock.calls[0][0].title).toBe("Your session couldn't be verified.");
  });
});
