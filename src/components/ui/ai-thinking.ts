/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Round 3 B6 (docs/review-r3/ROUND-3-FIXES.md): while Zcom AI works on an answer, the chat shows the steps it is
 * really taking (the run's tool activity) with <AiSteps>, then "Writing the answer"; once the answer streams, the
 * steps fold into one grey line ("Checked orders and stock · 1.8 s"). Pure, so it is unit-tested.
 */
import type { AiStep } from "./AiSteps";

/** One tool the AI ran for an answer (both apps' run.toolActivity). */
export interface AiToolActivity {
  label: string;
  /** RUNNING | DONE | ERROR */
  status: string;
  ms?: number | null;
}

/** The step shown before the first tool reports in. */
export const READING_STEP = "Reading your question";
export const WRITING_STEP = "Writing the answer";

/** The steps for one answer: each tool, then writing. `hasText` = the answer has started streaming. */
export function thinkingSteps(tools: readonly AiToolActivity[], running: boolean, hasText: boolean): AiStep[] {
  const toolSteps: AiStep[] = tools.map((tool) => ({
    label: tool.label,
    state: tool.status === "RUNNING" && running ? "work" : tool.status === "ERROR" ? "error" : "done",
    error: tool.status === "ERROR" ? `${tool.label} · couldn't read` : undefined,
  }));
  const steps = toolSteps.length ? toolSteps : [{ label: READING_STEP, state: running && !hasText ? "work" : "done" } as AiStep];
  const toolsBusy = steps.some((step) => step.state === "work");
  steps.push({
    label: WRITING_STEP,
    state: hasText || !running ? "done" : toolsBusy ? "wait" : "work",
  });
  return steps;
}

/** "Reading orders" → "orders": the thing a tool looked at, for the summary line. */
function thingOf(label: string): string {
  const words = label.trim().split(/\s+/);
  const rest = words.length > 1 && /ing$/i.test(words[0]) ? words.slice(1) : words;
  return rest.join(" ").replace(/[.…]+$/, "").toLowerCase();
}

/** "a", "a and b", "a, b and c". */
function listInWords(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** The folded line once the answer streams: "Checked orders and stock · 1.8 s". */
export function thinkingSummary(tools: readonly AiToolActivity[]): string {
  const things = [...new Set(tools.filter((tool) => tool.status !== "ERROR").map((tool) => thingOf(tool.label)).filter(Boolean))];
  const ms = tools.reduce((sum, tool) => sum + (typeof tool.ms === "number" && tool.ms > 0 ? tool.ms : 0), 0);
  const head = things.length ? `Checked ${listInWords(things)}` : "Thought it through";
  return ms > 0 ? `${head} · ${(ms / 1000).toFixed(1)} s` : head;
}
