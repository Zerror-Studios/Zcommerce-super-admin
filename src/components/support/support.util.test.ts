import { describe, expect, it } from "vitest";
import { PLATFORM_ROLE_PERMISSIONS, type PlatformPermission } from "../../lib/permissions";
import type { PlatformRole } from "../../types/platform-api";
import {
  SETTABLE_STATUSES,
  STATUS_LABEL,
  SUPPORT_TABS,
  canAssignTo,
  canBeResolved,
  closedByLabel,
  priorityNeedsNote,
  replyDue,
  safeHttpUrl,
  supportAbilities,
  supportTabOf,
  telLink,
  whatsappLink,
} from "./support.util";

const roleCan = (role: PlatformRole) => (permission: PlatformPermission) => PLATFORM_ROLE_PERMISSIONS[role].includes(permission);

describe("support statuses (PRD-049 §3)", () => {
  it("labels the new statuses and reads the R2-8 names as their successors", () => {
    expect(STATUS_LABEL.RESOLVED).toBe("Resolved");
    expect(STATUS_LABEL.CLOSED).toBe("Closed");
    expect(STATUS_LABEL.FIX_READY).toBe(STATUS_LABEL.RESOLVED);
    expect(STATUS_LABEL.SOLVED).toBe(STATUS_LABEL.CLOSED);
  });

  it("never lets the console set Resolved or Closed by hand", () => {
    expect(SETTABLE_STATUSES).toEqual(["OPEN", "IN_PROGRESS", "WAITING_ON_STORE"]);
  });

  it("offers Resolve only while the ticket is being worked on", () => {
    expect(canBeResolved("OPEN")).toBe(true);
    expect(canBeResolved("WAITING_ON_STORE")).toBe(true);
    expect(canBeResolved("RESOLVED")).toBe(false);
    expect(canBeResolved("CLOSED")).toBe(false);
  });

  it("says who closed it", () => {
    expect(closedByLabel("STORE")).toBe("Closed by the store");
    expect(closedByLabel("AUTO")).toBe("Closed automatically");
    expect(closedByLabel(null)).toBeNull();
  });

  it("owes no reply on resolved, closed or waiting tickets", () => {
    const due = "2026-11-19T10:00:00.000Z";
    expect(replyDue({ status: "RESOLVED", replyDueAt: due }).label).toBe("—");
    expect(replyDue({ status: "CLOSED", replyDueAt: due }).label).toBe("—");
    expect(replyDue({ status: "OPEN", replyDueAt: due }, Date.parse(due) - 20 * 60_000)).toEqual({ label: "In 20 min", tone: "warning" });
    expect(replyDue({ status: "OPEN", replyDueAt: due }, Date.parse(due) + 60 * 60_000)).toEqual({ label: "Late by 1 h", tone: "danger" });
  });
});

describe("support views (FR-A32)", () => {
  it("lists every view in order, each with its count", () => {
    expect(SUPPORT_TABS.map((tab) => tab.value)).toEqual([
      "OPEN",
      "UNASSIGNED",
      "MINE",
      "URGENT",
      "DUE_SOON",
      "WAITING_ON_STORE",
      "RESOLVED",
      "CLOSED",
      "ALL",
    ]);
    expect(SUPPORT_TABS.find((tab) => tab.value === "ALL")?.count).toBe("all");
    expect(SUPPORT_TABS.find((tab) => tab.value === "DUE_SOON")?.count).toBe("dueSoon");
  });

  it("reads an old or unknown view", () => {
    expect(supportTabOf("solved")).toBe("CLOSED");
    expect(supportTabOf("due_soon")).toBe("DUE_SOON");
    expect(supportTabOf("nope")).toBe("OPEN");
    expect(supportTabOf(null)).toBe("OPEN");
  });
});

describe("support permissions (FR-A34)", () => {
  it("maps roles onto read, reply and manage", () => {
    expect(supportAbilities(roleCan("PLATFORM_OWNER"))).toEqual({ read: true, reply: true, manage: true });
    expect(supportAbilities(roleCan("PLATFORM_ADMIN"))).toEqual({ read: true, reply: true, manage: true });
    expect(supportAbilities(roleCan("SUPPORT_AGENT"))).toEqual({ read: true, reply: true, manage: false });
    expect(supportAbilities(roleCan("BILLING_MANAGER"))).toEqual({ read: true, reply: false, manage: false });
    expect(supportAbilities(roleCan("READ_ONLY"))).toEqual({ read: true, reply: false, manage: false });
  });

  it("lets a replier assign only themselves; a manager anyone or nobody", () => {
    const agent = { read: true, reply: true, manage: false };
    const manager = { read: true, reply: true, manage: true };
    const reader = { read: true, reply: false, manage: false };
    expect(canAssignTo(agent, "me", "me")).toBe(true);
    expect(canAssignTo(agent, "someone", "me")).toBe(false);
    expect(canAssignTo(agent, null, "me")).toBe(false);
    expect(canAssignTo(manager, null, "me")).toBe(true);
    expect(canAssignTo(manager, "someone", "me")).toBe(true);
    expect(canAssignTo(reader, "me", "me")).toBe(false);
  });

  it("asks for a note only when the priority drops below the store's impact (FR-A10)", () => {
    expect(priorityNeedsNote("HIGH", "NORMAL")).toBe(true);
    expect(priorityNeedsNote("HIGH", "HIGH")).toBe(false);
    expect(priorityNeedsNote("NORMAL", "URGENT")).toBe(false);
    expect(priorityNeedsNote(null, "LOW")).toBe(false);
  });
});

describe("support contact links", () => {
  it("builds a WhatsApp link only when the contact said yes", () => {
    expect(whatsappLink({ phone: "+91 98765 43210", whatsappOk: true })).toBe("https://wa.me/919876543210");
    expect(whatsappLink({ phone: "+91 98765 43210", whatsappOk: false })).toBeNull();
    expect(whatsappLink({ phone: "123", whatsappOk: true })).toBeNull();
    expect(whatsappLink(null)).toBeNull();
  });

  it("keeps the plus on tel: links", () => {
    expect(telLink("+91 98765-43210")).toBe("tel:+919876543210");
    expect(telLink("98765 43210")).toBe("tel:9876543210");
    expect(telLink("")).toBeNull();
  });

  it("links only http(s) context URLs", () => {
    expect(safeHttpUrl("https://store.zerrorstudios.com/store/x/orders")).toBe("https://store.zerrorstudios.com/store/x/orders");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("not a url")).toBeNull();
  });
});
