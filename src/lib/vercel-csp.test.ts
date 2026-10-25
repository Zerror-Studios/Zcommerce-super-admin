/**
 * The deployed console calls the API host directly (ADR-003), so the CSP in
 * `vercel.json` must allow that origin in `connect-src` (PRD-014 FR-0.7,
 * finding FE-01). Without it every request and the session refresh are
 * blocked by the browser.
 */

import { describe, expect, it } from "vitest";
import vercelJson from "../../vercel.json?raw";

// ─── Constants ────────────────────────────────────────────────────────────

/** Origin of the production `VITE_GATEWAY_URL` (README, `.env.example`). */
const PRODUCTION_GATEWAY_URL = "https://api.zerrorstudios.com/v1/graphql";

// ─── Helpers ──────────────────────────────────────────────────────────────

interface VercelHeader {
  key: string;
  value: string;
}

function cspDirective(name: string): string[] {
  const config = JSON.parse(vercelJson) as {
    headers: { headers: VercelHeader[] }[];
  };
  const csp = config.headers
    .flatMap((entry) => entry.headers)
    .find((header) => header.key === "Content-Security-Policy");
  const directive = csp?.value
    .split(";")
    .map((part) => part.trim().split(/\s+/))
    .find(([directiveName]) => directiveName === name);
  return directive?.slice(1) ?? [];
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("vercel.json CSP", () => {
  it("allows the production gateway origin in connect-src", () => {
    const origin = new URL(PRODUCTION_GATEWAY_URL).origin;
    expect(cspDirective("connect-src")).toContain(origin);
  });

  it("keeps connect-src otherwise closed", () => {
    expect(cspDirective("connect-src")).not.toContain("*");
    expect(cspDirective("connect-src")).not.toContain("https:");
  });
});
