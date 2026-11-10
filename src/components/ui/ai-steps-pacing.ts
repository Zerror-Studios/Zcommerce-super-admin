/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Pacing for the AI-style steps (components/ui/AiSteps.tsx; docs/review-r3/ROUND-3-FIXES.md A3): which step
 * state to show next, one change at a time. Pure, so it is unit-tested (tests/unit/ai-steps-pacing.test.ts).
 */

export type AiStepState = "wait" | "work" | "done" | "error";

const RANK: Record<AiStepState, number> = { wait: 0, work: 1, done: 2, error: 3 };

/** Default time each step is shown working (A3: "each step is visible for at least 400 ms"). */
export const AI_STEP_MIN_MS = 400;

interface NextShown {
  states: AiStepState[];
  /** Apply now (errors, retries, resets) rather than at the calm pace. */
  immediate: boolean;
}

/** The next state to show, one change at a time; null when what is shown already matches `real`. Pure. */
export function nextShownSteps(shown: AiStepState[], real: AiStepState[]): NextShown | null {
  // A list that grows or shrinks (the AI's steps arrive one by one) keeps what is already shown, step by step.
  if (shown.length !== real.length) return { states: real.map((_, index) => shown[index] ?? "wait"), immediate: true };

  // A failure shows at once, with the steps that really finished before it.
  const failed = real.findIndex((state, index) => state === "error" && shown[index] !== "error");
  if (failed > -1) {
    const states = shown.map((state, index) => (index < failed && real[index] === "done" ? "done" : state));
    states[failed] = "error";
    return { states, immediate: true };
  }

  // Try again (error → work) or a reset: go back at once.
  const back = real.findIndex((state, index) => RANK[shown[index]] > RANK[state] || (shown[index] === "error" && state !== "error"));
  if (back > -1) {
    const states = shown.map((state, index) => (index >= back ? (real[index] === "done" ? "work" : real[index]) : state));
    return { states, immediate: true };
  }

  // Forward: the first step not done yet moves one state, at the calm pace.
  const index = shown.findIndex((state) => state !== "done");
  if (index === -1) return null;
  const states = [...shown];
  if (shown[index] === "wait" && RANK[real[index]] >= RANK.work) {
    states[index] = "work";
    return { states, immediate: false };
  }
  if (shown[index] === "work" && real[index] === "done") {
    states[index] = "done";
    // The next step starts working in the same beat when it really has.
    if (index + 1 < states.length && RANK[real[index + 1]] >= RANK.work && real[index + 1] !== "error") states[index + 1] = "work";
    return { states, immediate: false };
  }
  return null;
}
