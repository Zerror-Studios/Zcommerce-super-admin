import { describe, expect, it } from "vitest";
import { PLATFORM_ROLE_PERMISSIONS, type PlatformPermission } from "../../lib/permissions";
import type { PlatformRole } from "../../types/platform-api";
import { mainNavItems, visibleNavItems } from "../../config/navigation";
import {
  FEATURE_SETTABLE_STATUSES,
  editInputOf,
  featureAbilities,
  featureBoardParams,
  featureBoardStateOf,
  featureBoardVariables,
  featureFailureCopy,
  featureFieldErrorsFromServer,
  featureTabCount,
  isHttpsUrl,
  mergeCandidates,
  replyError,
  scoreLabel,
  shouldReloadAfter,
  statusDraftChanged,
  statusDraftOf,
  statusInputOf,
  statusNotifiesStores,
  upVoterValueLabel,
  validateEditDraft,
  validateStatusDraft,
  type FeatureRequest,
  type FeatureStatusCount,
} from "./feature-requests.util";

const roleCan = (role: PlatformRole) => (permission: PlatformPermission) => PLATFORM_ROLE_PERMISSIONS[role].includes(permission);

const gqlError = (code: string, reason?: string, field?: string, message = "Server says no") =>
  Object.assign(new Error(message), {
    graphQLErrors: [{ message, extensions: { code, ...(reason ? { reason } : {}), ...(field ? { field } : {}) } }],
  });

const request = (patch: Partial<FeatureRequest> = {}): FeatureRequest => ({
  id: "r1",
  ref: "FR-101",
  title: "Bulk edit product tags",
  type: "FEATURE",
  typeLabel: "New feature",
  area: "PRODUCTS",
  areaLabel: "Products",
  problem: "We tag 200 products by hand every season.",
  status: "OPEN",
  statusLabel: "Open",
  statusNote: "",
  releaseUrl: null,
  upVotes: 3,
  downVotes: 1,
  score: 2,
  commentCount: 0,
  hidden: false,
  createdAt: "2026-11-20T10:00:00.000Z",
  updatedAt: "2026-11-20T10:00:00.000Z",
  ...patch,
});

describe("feature board URL state (PRD-049 A3)", () => {
  it("reads defaults when the URL says nothing or nonsense", () => {
    expect(featureBoardStateOf({})).toEqual({ tab: "ALL", sort: "TOP", area: null, type: null, includeHidden: false });
    expect(featureBoardStateOf({ status: "nope", order: "x", area: "MARS", type: "BUG", hidden: "yes" })).toEqual({
      tab: "ALL",
      sort: "TOP",
      area: null,
      type: null,
      includeHidden: false,
    });
  });

  it("round-trips a full state through the URL, leaving defaults out", () => {
    const state = { tab: "PLANNED", sort: "NEW", area: "ORDERS", type: "IMPROVEMENT", includeHidden: true } as const;
    const params = featureBoardParams(state);
    expect(params).toEqual({ status: "PLANNED", order: "NEW", area: "ORDERS", type: "IMPROVEMENT", hidden: "1" });
    expect(featureBoardStateOf(params as Record<string, string>)).toEqual(state);
    expect(featureBoardParams(featureBoardStateOf({}))).toEqual({
      status: undefined,
      order: undefined,
      area: undefined,
      type: undefined,
      hidden: undefined,
    });
  });

  it("builds the query variables (ALL sends no status, blank search is null)", () => {
    const state = featureBoardStateOf({ area: "orders" });
    expect(featureBoardVariables(state, "  ", 30, 60)).toEqual({
      sort: "TOP",
      status: null,
      area: "ORDERS",
      type: null,
      search: null,
      includeHidden: false,
      limit: 30,
      offset: 60,
    });
    expect(featureBoardVariables(featureBoardStateOf({ status: "MERGED" }), " FR-1 ", 30, 0).status).toBe("MERGED");
    expect(featureBoardVariables(featureBoardStateOf({}), " FR-1 ", 30, 0).search).toBe("FR-1");
  });

  it("counts the All tab without merged requests", () => {
    const counts: FeatureStatusCount[] = [
      { status: "OPEN", label: "Open", count: 4 },
      { status: "PLANNED", label: "Planned", count: 2 },
      { status: "MERGED", label: "Merged", count: 7 },
    ];
    expect(featureTabCount(counts, "ALL")).toBe(6);
    expect(featureTabCount(counts, "MERGED")).toBe(7);
    expect(featureTabCount(counts, "RELEASED")).toBe(0);
    expect(featureTabCount(undefined, "OPEN")).toBeUndefined();
  });
});

describe("feature board permissions", () => {
  it("lets support readers in read-only and owners / admins manage", () => {
    expect(featureAbilities(roleCan("SUPPORT_AGENT"))).toEqual({ read: true, manage: false });
    expect(featureAbilities(roleCan("READ_ONLY"))).toEqual({ read: true, manage: false });
    expect(featureAbilities(roleCan("PLATFORM_ADMIN"))).toEqual({ read: true, manage: true });
    expect(featureAbilities(() => false)).toEqual({ read: false, manage: false });
    expect(featureAbilities((permission) => permission === "platform:feedback:manage")).toEqual({ read: true, manage: true });
  });

  it("shows the nav item with either permission", () => {
    const children = (can: (permission: PlatformPermission) => boolean) =>
      visibleNavItems(mainNavItems, can)
        .find((item) => item.key === "support")
        ?.children?.map((child) => child.to) ?? [];
    expect(children(() => false)).not.toContain("/support/features");
    expect(children((permission) => permission === "platform:feedback:manage")).toContain("/support/features");
    expect(children((permission) => permission === "platform:support:read")).toContain("/support/features");
  });
});

describe("change status dialog", () => {
  it("never offers Merged by hand", () => {
    expect(FEATURE_SETTABLE_STATUSES).not.toContain("MERGED");
    expect(validateStatusDraft({ status: "MERGED", note: "", releaseUrl: "" }).status).toBeTruthy();
  });

  it("requires a note for Not planned and caps its length", () => {
    expect(validateStatusDraft({ status: "NOT_PLANNED", note: "  ", releaseUrl: "" }).note).toMatch(/why/i);
    expect(validateStatusDraft({ status: "NOT_PLANNED", note: "Out of scope", releaseUrl: "" })).toEqual({});
    expect(validateStatusDraft({ status: "PLANNED", note: "x".repeat(1001), releaseUrl: "" }).note).toMatch(/1000/);
    expect(validateStatusDraft({ status: "PLANNED", note: "", releaseUrl: "" })).toEqual({});
  });

  it("takes only an https release link, and only for Released", () => {
    expect(validateStatusDraft({ status: "RELEASED", note: "", releaseUrl: "http://a.com" }).releaseUrl).toBeTruthy();
    expect(validateStatusDraft({ status: "RELEASED", note: "", releaseUrl: "javascript:alert(1)" }).releaseUrl).toBeTruthy();
    expect(validateStatusDraft({ status: "RELEASED", note: "", releaseUrl: "https://help.zerrorstudios.com/a" })).toEqual({});
    expect(isHttpsUrl("https://a.com/with space")).toBe(false);
    expect(statusInputOf({ status: "PLANNED", note: " soon ", releaseUrl: "https://a.com" })).toEqual({
      status: "PLANNED",
      note: "soon",
      releaseUrl: null,
    });
    expect(statusInputOf({ status: "RELEASED", note: "", releaseUrl: " https://a.com " }).releaseUrl).toBe("https://a.com");
  });

  it("says when stores are told", () => {
    expect(["PLANNED", "IN_PROGRESS", "RELEASED", "NOT_PLANNED"].every((s) => statusNotifiesStores(s as never))).toBe(true);
    expect(statusNotifiesStores("OPEN")).toBe(false);
    expect(statusNotifiesStores("UNDER_REVIEW")).toBe(false);
  });

  it("starts from the request and spots a no-op", () => {
    const row = request({ status: "PLANNED", statusNote: "Q1", releaseUrl: null });
    const draft = statusDraftOf(row);
    expect(draft).toEqual({ status: "PLANNED", note: "Q1", releaseUrl: "" });
    expect(statusDraftChanged(draft, row)).toBe(false);
    expect(statusDraftChanged({ ...draft, note: "Q2" }, row)).toBe(true);
    expect(statusDraftOf(request({ status: "MERGED" })).status).toBe("OPEN");
  });
});

describe("edit and reply checks", () => {
  it("mirrors the server's lengths and choices", () => {
    expect(validateEditDraft({ title: "Bulk", type: "FEATURE", area: "ORDERS", problem: "x".repeat(10) }).title).toBeTruthy();
    expect(validateEditDraft({ title: "Bulk tags", type: "FEATURE", area: "ORDERS", problem: "short" }).problem).toBeTruthy();
    expect(validateEditDraft({ title: "Bulk tags", type: "BUG" as never, area: "MARS", problem: "x".repeat(10) })).toMatchObject({
      type: expect.any(String),
      area: expect.any(String),
    });
    expect(validateEditDraft({ title: "Bulk tags", type: "IMPROVEMENT", area: "ORDERS", problem: "x".repeat(10) })).toEqual({});
  });

  it("sends only the changed fields", () => {
    const row = request();
    expect(editInputOf({ title: row.title, type: row.type, area: row.area, problem: row.problem }, row)).toBeNull();
    expect(editInputOf({ title: " New title ", type: row.type, area: "ORDERS", problem: row.problem }, row)).toEqual({
      title: "New title",
      area: "ORDERS",
    });
  });

  it("checks a reply", () => {
    expect(replyError("  ")).toBeTruthy();
    expect(replyError("x".repeat(2001))).toMatch(/2000/);
    expect(replyError("Thanks, planned for January")).toBeNull();
  });
});

describe("merge candidates", () => {
  it("leaves out the source and merged requests", () => {
    const items = [request({ id: "r1" }), request({ id: "r2", status: "MERGED" }), request({ id: "r3" })];
    expect(mergeCandidates(items, "r1").map((item) => item.id)).toEqual(["r3"]);
  });
});

describe("numbers", () => {
  it("formats the score with a typographic minus", () => {
    expect(scoreLabel(3)).toBe("+3");
    expect(scoreLabel(-2)).toBe("−2");
    expect(scoreLabel(0)).toBe("0");
  });

  it("formats the up-voters' monthly plan value in its currency", () => {
    expect(upVoterValueLabel(12500, "INR")).toBe("₹12,500 a month");
    expect(upVoterValueLabel(1999.5, "")).toBe("₹2,000 a month");
    expect(upVoterValueLabel(0, "INR")).toBe("No paid plans");
    expect(upVoterValueLabel(null, null)).toBe("No paid plans");
    expect(upVoterValueLabel(40, "USD")).toMatch(/40 a month$/);
  });
});

describe("server errors", () => {
  it("puts field errors on their field", () => {
    expect(featureFieldErrorsFromServer(gqlError("BAD_USER_INPUT", "NOTE_REQUIRED", "note", "Say why"))).toEqual({ note: "Say why" });
    expect(featureFieldErrorsFromServer(gqlError("BAD_USER_INPUT", "INVALID_URL", "releaseUrl"))).toEqual({ releaseUrl: "Server says no" });
    expect(featureFieldErrorsFromServer(gqlError("BAD_USER_INPUT", "INVALID_FEATURE_REQUEST"))).toEqual({ form: "Server says no" });
    expect(featureFieldErrorsFromServer(gqlError("BAD_USER_INPUT", "SAME_REQUEST", "targetId"))).toBeNull();
    expect(featureFieldErrorsFromServer(gqlError("CONFLICT", "FEATURE_REQUEST_CHANGED"))).toBeNull();
  });

  it("uses the console's copy for known reasons and reloads after a conflict", () => {
    expect(featureFailureCopy(gqlError("CONFLICT", "FEATURE_REQUEST_CHANGED"))).toMatch(/reloaded/);
    expect(featureFailureCopy(gqlError("BAD_USER_INPUT", "NOT_ZERROR_REPLY"))).toMatch(/pinned/);
    expect(featureFailureCopy(gqlError("FORBIDDEN"))).toBeNull();
    expect(shouldReloadAfter(gqlError("CONFLICT", "FEATURE_REQUEST_MERGED"))).toBe(true);
    expect(shouldReloadAfter(gqlError("BAD_USER_INPUT", "SAME_REQUEST"))).toBe(false);
  });
});
