/**
 * Session device labels (PRD-024 FR-4.3)
 *
 * A short, human label for a session's user agent ("Chrome on macOS"),
 * parsed simply: the first browser and system that match, else "Unknown
 * browser" / "unknown system". It only helps staff recognise their own
 * sessions; it is never a security signal.
 */

// ─── Constants ────────────────────────────────────────────────────────────

/** Order matters: Edge and Opera also say "Chrome", Chrome also says "Safari". */
const BROWSERS: readonly [RegExp, string][] = [
  [/Edg(e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
];

/** iOS and Android before macOS and Linux, which their agents also mention. */
const SYSTEMS: readonly [RegExp, string][] = [
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
];

// ─── Labels ───────────────────────────────────────────────────────────────

function firstMatch(
  value: string,
  patterns: readonly [RegExp, string][],
): string | null {
  return patterns.find(([pattern]) => pattern.test(value))?.[1] ?? null;
}

/** "Chrome on macOS", "Firefox", "Unknown device". */
export function deviceLabel(userAgent: string | null | undefined): string {
  const agent = userAgent?.trim();
  if (!agent) return "Unknown device";
  const browser = firstMatch(agent, BROWSERS);
  const system = firstMatch(agent, SYSTEMS);
  if (browser && system) return `${browser} on ${system}`;
  return browser ?? system ?? "Unknown device";
}
