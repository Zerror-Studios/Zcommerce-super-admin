import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpTimeoutError, createTimeoutFetch } from "./fetch-timeout.util";

/** A fetch that never answers until its signal aborts. */
const hangingFetch: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () =>
      reject(new DOMException("aborted", "AbortError")),
    );
  });

describe("createTimeoutFetch (FE-23)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fails with HttpTimeoutError when the server doesn't answer", async () => {
    vi.useFakeTimers();
    const request = createTimeoutFetch(1000, hangingFetch)("/v1/graphql");
    const assertion = expect(request).rejects.toBeInstanceOf(HttpTimeoutError);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it("returns the response when it arrives in time", async () => {
    const response = new Response("{}");
    const timed = createTimeoutFetch(1000, async () => response);
    await expect(timed("/v1/graphql")).resolves.toBe(response);
  });

  it("still honours the caller's abort signal", async () => {
    const caller = new AbortController();
    const request = createTimeoutFetch(60_000, hangingFetch)("/v1/graphql", {
      signal: caller.signal,
    });
    caller.abort();
    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });
});
