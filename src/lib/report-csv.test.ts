import { afterEach, describe, expect, it, vi } from "vitest";
import { CSV_REVOKE_DELAY_MS, downloadCsv, escapeCsvCell, rowsToCsv } from "./report-csv";

// PRD-002 SA-6
describe("CSV export", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each(["=SUM(A1)", "+1", "-1+2", "@cmd", "\tx", "\rx"])(
    "neutralises formula-like cell %j",
    (value) => {
      expect(escapeCsvCell(value).replace(/^"/, "")).toMatch(/^'/);
    },
  );

  it("leaves numbers and plain text alone", () => {
    expect(escapeCsvCell(-5)).toBe("-5");
    expect(escapeCsvCell("Aura Apparel")).toBe("Aura Apparel");
    expect(escapeCsvCell(null)).toBe("");
  });

  it("still quotes commas, quotes and newlines", () => {
    expect(escapeCsvCell('a,"b"')).toBe('"a,""b"""');
    expect(escapeCsvCell("=1,2")).toBe(`"'=1,2"`);
  });

  it("rowsToCsv applies the escaping to every cell", () => {
    const csv = rowsToCsv(
      [{ name: "=HYPERLINK(\"x\")", amount: 10 }],
      [
        { key: "name", label: "Name" },
        { key: "amount", label: "Amount" },
      ],
    );
    expect(csv).toBe(`Name,Amount\n"'=HYPERLINK(""x"")",10`);
  });

  it("revokes the object URL only after a delay", () => {
    vi.useFakeTimers();
    const click = vi.fn();
    vi.stubGlobal("document", {
      createElement: () => ({ click, href: "", download: "" }),
    });
    const revoke = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");

    downloadCsv("x.csv", "a,b");

    expect(click).toHaveBeenCalledTimes(1);
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(CSV_REVOKE_DELAY_MS);
    expect(revoke).toHaveBeenCalledWith("blob:test");
  });
});
