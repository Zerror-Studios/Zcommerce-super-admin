/**
 * Support tickets in the console (backend PRD-036 R2-8, board 45; PRD-049 step A1): labels, tones, the queue views,
 * the reply-due (SLA) label, what the caller may do, and the contact links.
 */
import type { Tone } from "../ui";
import { PLATFORM_PERMISSIONS, type PlatformPermission } from "../../lib/permissions";

// ─── Types ────────────────────────────────────────────────────────────────

/** FIX_READY / SOLVED are the R2-8 names: deprecated, never returned, read as RESOLVED / CLOSED. */
export type SupportStatus = "OPEN" | "IN_PROGRESS" | "WAITING_ON_STORE" | "RESOLVED" | "CLOSED" | "FIX_READY" | "SOLVED";
export type SupportPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type SupportOutcome = "FIXED" | "ANSWERED" | "CHANGE_DONE" | "NOT_A_BUG" | "DUPLICATE" | "WONT_DO";
export type SupportTab =
  | "OPEN"
  | "UNASSIGNED"
  | "MINE"
  | "URGENT"
  | "DUE_SOON"
  | "WAITING_ON_STORE"
  | "RESOLVED"
  | "CLOSED"
  | "ALL";

export interface SupportCounts {
  open: number;
  unassigned: number;
  mine: number;
  urgent: number;
  dueSoon: number;
  waitingOnStore: number;
  resolved: number;
  closed: number;
  /** PRD-049: every ticket, whatever its status. */
  all: number;
}

export interface SupportAttachment {
  url: string;
  name: string;
  contentType?: string | null;
  size?: number | null;
}

export interface SupportMessage {
  id: string;
  authorType: string;
  authorName: string;
  body: string;
  attachments: SupportAttachment[];
  internal: boolean;
  quickReplies: string[];
  createdAt: string;
}

export interface SupportLink {
  id: string;
  label: string;
}

export interface SupportContact {
  name: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  whatsappOk: boolean;
  bestTime?: string | null;
}

export interface SupportContext {
  pageUrl?: string | null;
  browser?: string | null;
  os?: string | null;
  screen?: string | null;
  appVersion?: string | null;
  plan?: string | null;
  recentErrors: string[];
}

export interface SupportTicket {
  id: string;
  ref: string;
  tenantId: string;
  storeName: string;
  storeSlug: string;
  type: string;
  typeLabel: string;
  topic: string;
  topicLabel: string;
  title: string;
  impact?: SupportPriority | null;
  priority: SupportPriority;
  priorityAuto: boolean;
  status: SupportStatus;
  trackerStep: number;
  expectedResolution: string;
  replyTargetHours: number;
  raisedByName: string;
  raisedByEmail?: string | null;
  raisedViaImpersonation: boolean;
  assignee?: { id: string; name: string } | null;
  replyDueAt?: string | null;
  firstReplyAt?: string | null;
  outcome?: SupportOutcome | null;
  outcomeLabel?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  /** STORE or AUTO */
  closedBy?: string | null;
  reopenedCount: number;
  quickReplies: string[];
  messageCount: number;
  attachmentCount: number;
  lastMessageAt: string;
  lastMessageBy: string;
  createdAt: string;
  updatedAt: string;
  description?: string;
  steps?: string | null;
  neededBy?: string | null;
  linkedOrder?: SupportLink | null;
  linkedProduct?: SupportLink | null;
  linkedCustomer?: SupportLink | null;
  followUpOf?: SupportLink | null;
  contact?: SupportContact | null;
  context?: SupportContext | null;
  outcomeNote?: string | null;
  resolvedByName?: string | null;
  rating?: { score: number; comment?: string | null } | null;
  messages?: SupportMessage[] | null;
}

// ─── Labels ───────────────────────────────────────────────────────────────

export const STATUS_LABEL: Record<SupportStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  WAITING_ON_STORE: "Waiting on store",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  FIX_READY: "Resolved",
  SOLVED: "Closed",
};

export const STATUS_TONE: Record<SupportStatus, Tone> = {
  OPEN: "info",
  IN_PROGRESS: "info",
  WAITING_ON_STORE: "warning",
  RESOLVED: "success",
  CLOSED: "neutral",
  FIX_READY: "success",
  SOLVED: "neutral",
};

export const PRIORITY_LABEL: Record<SupportPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

export const PRIORITY_TONE: Record<SupportPriority, Tone> = {
  LOW: "neutral",
  NORMAL: "neutral",
  HIGH: "danger",
  URGENT: "danger",
};

/** The store's tracker (PRD-049 §3): 0 Received, 1 Being worked on, 2 Resolved, 3 Closed. */
export const TRACKER_STEPS = ["Received", "Being worked on", "Resolved", "Closed"] as const;

/** FR-A13 outcomes, in the Resolve dialog's order (labels as the store sees them). */
export const OUTCOME_OPTIONS: { value: SupportOutcome; label: string; description: string }[] = [
  { value: "FIXED", label: "Fixed", description: "We fixed what was broken." },
  { value: "ANSWERED", label: "Answered", description: "The question is answered." },
  { value: "CHANGE_DONE", label: "Change done", description: "The change the store asked for is live." },
  { value: "NOT_A_BUG", label: "Works as designed", description: "Nothing is broken; explain how it works." },
  { value: "DUPLICATE", label: "Duplicate", description: "Another ticket covers this; name it in the note." },
  { value: "WONT_DO", label: "Won't do", description: "We won't make this change; give the reason." },
];

export const CONTACT_ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  DEVELOPER: "Developer",
  DESIGNER: "Designer",
  OTHER: "Other",
};

/** "Closed by the store" / "Closed automatically" (null while open). */
export function closedByLabel(closedBy: string | null | undefined): string | null {
  if (closedBy === "STORE") return "Closed by the store";
  if (closedBy === "AUTO") return "Closed automatically";
  return null;
}

// ─── Statuses and views ──────────────────────────────────────────────────

/** The statuses the console may set by hand (PRD-049 D3: resolve with an outcome; only the store closes). */
export const SETTABLE_STATUSES: SupportStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_ON_STORE"];

const RESOLVED_STATUSES: SupportStatus[] = ["RESOLVED", "FIX_READY"];
const CLOSED_STATUSES: SupportStatus[] = ["CLOSED", "SOLVED"];

export const isResolved = (status: SupportStatus) => RESOLVED_STATUSES.includes(status);
export const isClosed = (status: SupportStatus) => CLOSED_STATUSES.includes(status);
/** Resolve is offered while the ticket is still being worked on (not resolved, not closed). */
export const canBeResolved = (status: SupportStatus) => !isResolved(status) && !isClosed(status);

/** The queue's views (FR-A32) in toolbar order; ALL has no count. */
export const SUPPORT_TABS: { value: SupportTab; label: string; count?: keyof SupportCounts }[] = [
  { value: "OPEN", label: "Open", count: "open" },
  { value: "UNASSIGNED", label: "Unassigned", count: "unassigned" },
  { value: "MINE", label: "Mine", count: "mine" },
  { value: "URGENT", label: "Urgent", count: "urgent" },
  { value: "DUE_SOON", label: "Due soon", count: "dueSoon" },
  { value: "WAITING_ON_STORE", label: "Waiting on store", count: "waitingOnStore" },
  { value: "RESOLVED", label: "Resolved", count: "resolved" },
  { value: "CLOSED", label: "Closed", count: "closed" },
  { value: "ALL", label: "All", count: "all" },
];

/** A `?view=` value back to a view: the R2-8 "SOLVED" reads CLOSED, anything unknown OPEN. */
export function supportTabOf(value: string | null | undefined): SupportTab {
  const upper = (value ?? "").toUpperCase();
  if (upper === "SOLVED") return "CLOSED";
  return SUPPORT_TABS.some((tab) => tab.value === upper) ? (upper as SupportTab) : "OPEN";
}

export function emptyTabTitle(tab: SupportTab): string {
  switch (tab) {
    case "OPEN":
      return "No open tickets";
    case "UNASSIGNED":
      return "Every open ticket has someone on it";
    case "MINE":
      return "No tickets assigned to you";
    case "URGENT":
      return "No urgent tickets";
    case "DUE_SOON":
      return "No replies due within the hour";
    case "WAITING_ON_STORE":
      return "No tickets waiting on a store";
    case "RESOLVED":
      return "No tickets awaiting a store's confirmation";
    case "CLOSED":
      return "No closed tickets";
    default:
      return "No tickets yet";
  }
}

// ─── Priority ─────────────────────────────────────────────────────────────

export const PRIORITIES: SupportPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

const PRIORITY_RANK: Record<SupportPriority, number> = { LOW: 0, NORMAL: 1, HIGH: 2, URGENT: 3 };

/** FR-A10: lowering the priority below the store's own impact needs a note the store sees. */
export function priorityNeedsNote(impact: SupportPriority | null | undefined, next: SupportPriority): boolean {
  return !!impact && PRIORITY_RANK[next] < PRIORITY_RANK[impact];
}

// ─── Permissions ─────────────────────────────────────────────────────────

export interface SupportAbilities {
  /** Open the queue and tickets. */
  read: boolean;
  /** Reply, note, status, resolve, assign yourself. */
  reply: boolean;
  /** Priority, assign anyone else or nobody, Support › Settings. */
  manage: boolean;
}

/** PRD-049 FR-A34; the backend still decides. */
export function supportAbilities(can: (permission: PlatformPermission) => boolean): SupportAbilities {
  return {
    read: can(PLATFORM_PERMISSIONS.SUPPORT_READ),
    reply: can(PLATFORM_PERMISSIONS.SUPPORT_REPLY),
    manage: can(PLATFORM_PERMISSIONS.SUPPORT_MANAGE),
  };
}

/** Assigning yourself needs reply; anyone else, or nobody, needs manage. */
export function canAssignTo(abilities: SupportAbilities, assigneeId: string | null, myId: string | null | undefined): boolean {
  if (abilities.manage) return true;
  return abilities.reply && !!assigneeId && assigneeId === myId;
}

// ─── Contact ─────────────────────────────────────────────────────────────

const MIN_PHONE_DIGITS = 8;

/** A WhatsApp chat link, only when the contact said WhatsApp is OK and the number has enough digits. */
export function whatsappLink(contact: Pick<SupportContact, "phone" | "whatsappOk"> | null | undefined): string | null {
  if (!contact?.whatsappOk) return null;
  const digits = (contact.phone ?? "").replace(/\D/g, "");
  return digits.length >= MIN_PHONE_DIGITS ? `https://wa.me/${digits}` : null;
}

/** `tel:` keeping a leading plus. */
export function telLink(phone: string | null | undefined): string | null {
  const trimmed = (phone ?? "").trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  return `tel:${trimmed.startsWith("+") ? "+" : ""}${digits}`;
}

/** A link from the captured context, only http(s) (never a `javascript:` URL a client sent). */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

// ─── Reply due ────────────────────────────────────────────────────────────

const MS_PER_MINUTE = 60_000;

/** "1 h 10 min", "20 min", "2 d 3 h". */
export function durationLabel(ms: number): string {
  const minutes = Math.max(1, Math.round(Math.abs(ms) / MS_PER_MINUTE));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  return hours % 24 ? `${days} d ${hours % 24} h` : `${days} d`;
}

/**
 * Board 45 "Reply due": "—" while waiting on the store, resolved or closed, "Replied" once support answered and
 * nothing is owed, "In 1 h 10 min" (amber) before the target, "Late by 20 min" (red) after it.
 */
export function replyDue(ticket: Pick<SupportTicket, "status" | "replyDueAt" | "firstReplyAt">, now: number = Date.now()): {
  label: string;
  tone: Tone;
} {
  if (ticket.status === "WAITING_ON_STORE" || isResolved(ticket.status) || isClosed(ticket.status)) {
    return { label: "—", tone: "neutral" };
  }
  if (!ticket.replyDueAt) return ticket.firstReplyAt ? { label: "Replied", tone: "success" } : { label: "—", tone: "neutral" };
  const left = new Date(ticket.replyDueAt).getTime() - now;
  return left >= 0 ? { label: `In ${durationLabel(left)}`, tone: "warning" } : { label: `Late by ${durationLabel(left)}`, tone: "danger" };
}

export const isImage = (attachment: SupportAttachment) =>
  (attachment.contentType ?? "").startsWith("image/") || /\.(png|jpe?g|webp|gif|avif)$/i.test(attachment.url);
