import { describe, expect, it } from "vitest";
import type { PlatformAssistantRun } from "../types/platform-insights";
import {
  ASK_MAX_POLL_FAILURES,
  ASK_POLL_TIMEOUT_MS,
  applyRun,
  askQuestionText,
  canRetrySameId,
  consolePath,
  pollOutcome,
  formatSources,
  splitStoreNames,
  turnsFromConversation,
  type AskTurn,
} from "./ask-zcom-platform.util";

const turn: AskTurn = {
  clientMessageId: "c1",
  question: "Who is late?",
  status: "SENDING",
  text: "",
  toolActivity: [],
  sources: [],
};

const run = (patch: Partial<PlatformAssistantRun>): PlatformAssistantRun => ({
  id: "r1",
  conversationId: "conv1",
  status: "RUNNING",
  seq: 0,
  delta: "",
  toolActivity: [],
  ...patch,
});

describe("Ask ZCOM for staff (PRD-026 §12)", () => {
  it("appends deltas while running, then the final text replaces them", () => {
    let next = applyRun(turn, run({ delta: "Nahara ", seq: 7, toolActivity: [{ tool: "money", label: "Checking money", status: "RUNNING", ms: null }] }));
    next = applyRun(next, run({ delta: "owes", seq: 11 }));
    expect(next).toMatchObject({ status: "RUNNING", text: "Nahara owes", runId: "r1" });
    expect(next.toolActivity).toHaveLength(1);
    const done = applyRun(
      next,
      run({
        status: "COMPLETED",
        delta: "",
        message: { id: "m1", text: "Nahara owes ₹5,000.", sources: ["Money"], rating: null, createdAt: "x" },
      }),
    );
    expect(done).toMatchObject({ status: "COMPLETED", text: "Nahara owes ₹5,000.", messageId: "m1", sources: ["Money"] });
  });

  it("keeps the run's error reason", () => {
    const failed = applyRun(turn, run({ status: "FAILED", error: { code: "X", reason: "RUN_INTERRUPTED", message: "" } }));
    expect(failed.runErrorReason).toBe("RUN_INTERRUPTED");
  });

  it("rebuilds turns from a stored conversation", () => {
    const turns = turnsFromConversation([
      { id: "u1", role: "USER", text: "Q1", sources: [], rating: null, createdAt: "x" },
      { id: "a1", role: "ASSISTANT", text: "A1", status: "COMPLETED", sources: ["Stores"], rating: "UP", createdAt: "x" },
      { id: "u2", role: "USER", text: "Q2", sources: [], rating: null, createdAt: "x" },
    ]);
    expect(turns).toHaveLength(2);
    expect(turns[0]).toMatchObject({ question: "Q1", text: "A1", messageId: "a1", rating: "UP" });
    expect(turns[1]).toMatchObject({ question: "Q2", text: "" });
  });

  it("keeps only relative console links", () => {
    expect(consolePath("/stores/abc")).toBe("/stores/abc");
    expect(consolePath("https://evil.example")).toBeNull();
    expect(consolePath("//evil.example")).toBeNull();
    expect(consolePath("javascript:alert(1)")).toBeNull();
  });

  it("links store names, longest first, whole words only", () => {
    const stores = [
      { id: "s1", name: "Kesar" },
      { id: "s2", name: "Kesar & Kin" },
      { id: "s3", name: "Nahara" },
      { id: "s4", name: "AB" },
    ];
    const segments = splitStoreNames("Kesar & Kin and nahara are late; Naharas is not. AB too.", stores);
    expect(segments.filter((s) => s.kind === "store")).toEqual([
      { kind: "store", text: "Kesar & Kin", storeId: "s2" },
      { kind: "store", text: "nahara", storeId: "s3" },
    ]);
    expect(segments.map((s) => s.text).join("")).toBe("Kesar & Kin and nahara are late; Naharas is not. AB too.");
    expect(splitStoreNames("No stores here", [])).toEqual([{ kind: "text", text: "No stores here" }]);
  });

  it("names the sources", () => {
    expect(formatSources(["Money", "Money", "Stores"])).toBe("Used: Money, Stores");
    expect(formatSources([])).toBe("");
  });

  // Backend docs/reviews/2026-11-03-super-admin-chat-fe-fixes.md
  it("FE-3: sends the question as typed, without wrapping quotes", () => {
    expect(askQuestionText("  Which stores are at risk and why?  ")).toBe("Which stores are at risk and why?");
    expect(askQuestionText('"Show me stores in the Fashion category in Mumbai."')).toBe(
      "Show me stores in the Fashion category in Mumbai.",
    );
    expect(askQuestionText("\u201cWho is late?\u201d")).toBe("Who is late?");
    // Quotes inside the question stay
    expect(askQuestionText('Is "Kesar & Kin" paid up?')).toBe('Is "Kesar & Kin" paid up?');
    expect(askQuestionText('"Kesar" or "Nahara"')).toBe('"Kesar" or "Nahara"');
    expect(askQuestionText('""')).toBe('""');
  });

  it("FE-2: polls only while RUNNING, for 2 minutes and 3 failures at most", () => {
    const at = { failures: 0, startedAt: 0, now: 1000 };
    expect(pollOutcome({ ...at, status: "RUNNING" })).toBe("CONTINUE");
    for (const status of ["COMPLETED", "COMPLETED_PARTIAL", "CANCELLED", "FAILED"]) {
      expect(pollOutcome({ ...at, status })).toBe("ENDED");
    }
    expect(pollOutcome({ ...at, status: null, failures: ASK_MAX_POLL_FAILURES - 1 })).toBe("CONTINUE");
    expect(pollOutcome({ ...at, status: null, failures: ASK_MAX_POLL_FAILURES })).toBe("UNREACHABLE");
    expect(pollOutcome({ ...at, status: "RUNNING", now: ASK_POLL_TIMEOUT_MS + 1 })).toBe("TIMED_OUT");
  });

  it("FE-4: retries with the same id only when the send got no answer", () => {
    expect(canRetrySameId({ networkError: new Error("offline") })).toBe(true);
    expect(canRetrySameId({ networkError: { statusCode: 502 } })).toBe(true);
    expect(
      canRetrySameId({ graphQLErrors: [{ extensions: { code: "CONFLICT", reason: "RUN_IN_PROGRESS" } }] }),
    ).toBe(false);
    expect(canRetrySameId(new Error("boom"))).toBe(false);
  });
});
