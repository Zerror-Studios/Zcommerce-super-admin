/**
 * Support tickets in the console (backend PRD-036 R2-8, board 45): labels, tones and the reply-due (SLA) label.
 */
import type { Tone } from "../ui";

// ─── Types ────────────────────────────────────────────────────────────────

export type SupportStatus = "OPEN" | "IN_PROGRESS" | "WAITING_ON_STORE" | "FIX_READY" | "SOLVED";
export type SupportPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type SupportTab = "OPEN" | "WAITING_ON_STORE" | "SOLVED" | "MINE";

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

export interface SupportTicket {
  id: string;
  ref: string;
  tenantId: string;
  storeName: string;
  storeSlug: string;
  topic: string;
  topicLabel: string;
  title: string;
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
  solvedAt?: string | null;
  quickReplies: string[];
  messageCount: number;
  attachmentCount: number;
  lastMessageAt: string;
  lastMessageBy: string;
  createdAt: string;
  updatedAt: string;
  description?: string;
  linkedOrder?: { id: string; label: string } | null;
  linkedProduct?: { id: string; label: string } | null;
  messages?: SupportMessage[] | null;
}

// ─── Labels ───────────────────────────────────────────────────────────────

export const STATUS_LABEL: Record<SupportStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "Looking into it",
  WAITING_ON_STORE: "Waiting on store",
  FIX_READY: "Fix ready",
  SOLVED: "Solved",
};

export const STATUS_TONE: Record<SupportStatus, Tone> = {
  OPEN: "info",
  IN_PROGRESS: "info",
  WAITING_ON_STORE: "warning",
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

export const TRACKER_STEPS = ["Received", "Looking into it", "Fix ready", "Solved"] as const;

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
 * Board 45 "Reply due": "—" while waiting on the store or solved, "Replied" once support answered and nothing is
 * owed, "In 1 h 10 min" (amber) before the target, "Late by 20 min" (red) after it.
 */
export function replyDue(ticket: Pick<SupportTicket, "status" | "replyDueAt" | "firstReplyAt">, now: number = Date.now()): {
  label: string;
  tone: Tone;
} {
  if (ticket.status === "SOLVED" || ticket.status === "WAITING_ON_STORE") return { label: "—", tone: "neutral" };
  if (!ticket.replyDueAt) return ticket.firstReplyAt ? { label: "Replied", tone: "success" } : { label: "—", tone: "neutral" };
  const left = new Date(ticket.replyDueAt).getTime() - now;
  return left >= 0 ? { label: `In ${durationLabel(left)}`, tone: "warning" } : { label: `Late by ${durationLabel(left)}`, tone: "danger" };
}

export const isImage = (attachment: SupportAttachment) =>
  (attachment.contentType ?? "").startsWith("image/") || /\.(png|jpe?g|webp|gif|avif)$/i.test(attachment.url);
