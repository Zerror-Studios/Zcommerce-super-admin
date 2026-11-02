import { describe, expect, it } from "vitest";
import type { PlatformAssistantRun } from "../types/platform-insights";
import {
  applyRun,
  consolePath,
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
});
