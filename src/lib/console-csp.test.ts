/**
 * The deployed console calls the API host directly (ADR-003), so the CSP in
 * `customHttp.yml` (Amplify's headers file) must allow that origin in
 * `connect-src` (PRD-014 FR-0.7, finding FE-01). Without it every request
 * and the session refresh are blocked by the browser.
 */

import { describe, expect, it } from "vitest";
import customHttp from "../../customHttp.yml?raw";

// ─── Constants ────────────────────────────────────────────────────────────

/** Origin of the production `VITE_GATEWAY_URL` (README, `.env.example`). */
const PRODUCTION_GATEWAY_URL = "https://api.zerrorstudios.com/v1/graphql";

// ─── Helpers ──────────────────────────────────────────────────────────────

function headerValue(key: string): string | undefined {
  const match = customHttp.match(
    new RegExp(`key: "${key}"\\s*\\n\\s*value: "([^"]+)"`),
  );
  return match?.[1];
}

function cspDirective(name: string): string[] {
  const directive = (headerValue("Content-Security-Policy") ?? "")
    .split(";")
    .map((part) => part.trim().split(/\s+/))
    .find(([directiveName]) => directiveName === name);
  return directive?.slice(1) ?? [];
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("customHttp.yml CSP", () => {
  it("has a Content-Security-Policy", () => {
    expect(cspDirective("default-src")).toEqual(["'self'"]);
  });

  it("allows the production gateway origin in connect-src", () => {
    const origin = new URL(PRODUCTION_GATEWAY_URL).origin;
    expect(cspDirective("connect-src")).toContain(origin);
  });

  it("keeps connect-src otherwise closed", () => {
    expect(cspDirective("connect-src")).not.toContain("*");
    expect(cspDirective("connect-src")).not.toContain("https:");
  });

  it("keeps scripts to the bundle", () => {
    expect(cspDirective("script-src")).toEqual(["'self'"]);
  });

  // PRD-033 FR-2.7: `/push-sw.js` is a same-origin worker.
  it("allows the same-origin push service worker", () => {
    expect(cspDirective("worker-src")).toContain("'self'");
  });

  it("refuses framing and indexing", () => {
    expect(cspDirective("frame-ancestors")).toEqual(["'none'"]);
    expect(headerValue("X-Frame-Options")).toBe("DENY");
    expect(headerValue("X-Robots-Tag")).toBe("noindex, nofollow");
  });
});
