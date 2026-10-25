/**
 * HTTP timeout for the one Apollo client (PRD-014 FE-23)
 *
 * The browser's `fetch` has no timeout, so a gateway that accepts the
 * connection and never answers left a screen spinning forever. This wraps
 * `fetch` with an `AbortController` deadline (and still honours Apollo's
 * own abort signal); a timed-out request fails with `HttpTimeoutError`,
 * which reaches the screen as an ordinary network error.
 */

// ─── Constants ────────────────────────────────────────────────────────────

/** Deadline for one API request until the response headers arrive. */
export const HTTP_TIMEOUT_MS =
  Number(import.meta.env.VITE_HTTP_TIMEOUT_MS) || 30_000;

// ─── Errors ───────────────────────────────────────────────────────────────

export class HttpTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`The server didn't answer within ${timeoutMs} ms.`);
    this.name = "HttpTimeoutError";
  }
}

// ─── Fetch ────────────────────────────────────────────────────────────────

/** A `fetch` that aborts after `timeoutMs`; `baseFetch` is for tests. */
export function createTimeoutFetch(
  timeoutMs: number = HTTP_TIMEOUT_MS,
  baseFetch: typeof fetch = (input, init) => fetch(input, init),
): typeof fetch {
  return async (input, init = {}) => {
    const controller = new AbortController();
    const upstream = init.signal ?? null;
    const forwardAbort = () => controller.abort(upstream?.reason);
    if (upstream?.aborted) forwardAbort();
    else upstream?.addEventListener("abort", forwardAbort, { once: true });

    const timeout = new HttpTimeoutError(timeoutMs);
    const timer = setTimeout(() => controller.abort(timeout), timeoutMs);
    try {
      return await baseFetch(input, { ...init, signal: controller.signal });
    } catch (error) {
      if (controller.signal.reason === timeout) throw timeout;
      throw error;
    } finally {
      clearTimeout(timer);
      upstream?.removeEventListener("abort", forwardAbort);
    }
  };
}
