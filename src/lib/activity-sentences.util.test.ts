import { describe, expect, it } from "vitest";

import { activityKind, activityText, actorName, describeActivity, groupActivity, type ActivityEntry } from "./activity-sentences.util";

const names: Record<string, string> = { kk: "Kesar & Kin", na: "Nahara" };
const context = { storeName: (id: string) => names[id], viewerEmail: "owner@zerrorstudios.com" };

const entry = (over: Partial<ActivityEntry>): ActivityEntry => ({
  id: over.id ?? "1",
  actorEmail: "mehak@zerrorstudios.com",
  action: "tenant.impersonate",
  targetType: "tenant",
  targetId: "kk",
  at: "2026-11-06T10:42:00.000Z",
  ...over,
});

describe("activity sentences (round 2 §6.1)", () => {
  it("writes a sentence, never the event code", () => {
    expect(activityText(describeActivity(entry({}), context))).toBe("Mehak opened Kesar & Kin as admin");
    expect(activityText(describeActivity(entry({ action: "tenant.staff_viewed" }), context))).toBe("Mehak looked at the team of Kesar & Kin");
    expect(activityText(describeActivity(entry({ action: "credit.issue", targetId: "na", after: '{"amount":499}' }), context))).toBe(
      "Mehak gave Nahara a credit of ₹499",
    );
  });

  it("names people from their email; role mailboxes and the viewer read naturally", () => {
    expect(actorName("admin@zerrorstudios.com")).toBe("Zerror admin");
    expect(actorName("owner@zerrorstudios.com", "OWNER@zerrorstudios.com")).toBe("You");
    expect(actorName("dev.agarwal@x.in")).toBe("Dev");
  });

  it("keeps an unknown code readable", () => {
    const text = activityText(describeActivity(entry({ action: "tenant.something_new" }), context));
    expect(text).not.toContain("tenant.");
    expect(text).toContain("something new");
    expect(activityKind("tenant.restricted.payment:Mutation.refundPayment")).toBe("admin");
  });

  it("groups repeats by one person within 10 minutes", () => {
    const rows = groupActivity(
      [
        entry({ id: "a", targetId: "kk", at: "2026-11-06T10:42:00.000Z" }),
        entry({ id: "b", targetId: "na", at: "2026-11-06T10:36:00.000Z" }),
        entry({ id: "c", targetId: "na", at: "2026-11-06T09:00:00.000Z" }),
      ],
      context,
    );
    expect(rows).toHaveLength(2);
    expect(activityText(rows[0].segments)).toBe("Mehak opened 2 stores as admin");
    expect(rows[0].count).toBe(2);
    expect(activityText(rows[1].segments)).toBe("Mehak opened Nahara as admin");
  });

  it("counts the same thing done again", () => {
    const rows = groupActivity([entry({ id: "a" }), entry({ id: "b", at: "2026-11-06T10:40:00.000Z" })], context);
    expect(activityText(rows[0].segments)).toBe("Mehak opened Kesar & Kin as admin · 2 times");
  });
});
