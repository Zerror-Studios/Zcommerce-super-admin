/**
 * Activity in plain sentences (round 2 §6.1, board 02 "Recent activity")
 *
 * The platform audit log (`platformAuditLog`) stores dotted event codes
 * ("tenant.impersonate", "invoice.record_payment"). Home and the store page
 * show them as one sentence each with an icon for the kind of change:
 * "Mehak opened Kesar & Kin as admin", "Mehak issued a credit to Nahara".
 * Repeats by the same person within 10 minutes become one row ("Mehak
 * opened 2 stores as admin"). Every event code the backend writes
 * (services/platform-admin, 2026-11-06) has a sentence; an unknown code
 * falls back to a readable version of the code, never the raw key.
 *
 * Pure: the store names and the viewer's email are passed in.
 */

// ─── Types ────────────────────────────────────────────────────────────────

export interface ActivityEntry {
  id: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string | null;
  /** JSON snapshot the mutation recorded (a string from the API). */
  after?: string | null;
  at: string;
}

/** The icon a sentence gets (the card maps these to kit icons). */
export type ActivityKind =
  | "admin"
  | "view"
  | "store"
  | "live"
  | "pause"
  | "delete"
  | "team"
  | "billing"
  | "credit"
  | "plan"
  | "coupon"
  | "ai"
  | "auth"
  | "settings"
  | "apps"
  | "support"
  | "order"
  | "announce"
  | "other";

/** A piece of a sentence: plain text, or a store (bold, linked by the card). */
export type ActivitySegment = string | { storeId: string; name: string };

export interface ActivityRow {
  /** The first entry's id (the newest of a group). */
  id: string;
  kind: ActivityKind;
  segments: ActivitySegment[];
  /** The newest entry's time. */
  at: string;
  /** Entries merged into this row (1 = not grouped). */
  count: number;
}

export interface ActivityContext {
  /** Store name by id (the console's loaded stores). */
  storeName: (id: string) => string | undefined;
  /** The signed-in viewer's email, shown as "You". */
  viewerEmail?: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────

/** Repeats by one person within this window become one row. */
export const ACTIVITY_GROUP_WINDOW_MS = 10 * 60 * 1000;

/** Mailbox names that are a role, not a person ("admin@zerrorstudios.com" → "Zerror admin"). */
const ROLE_MAILBOXES = new Set(["admin", "support", "ops", "billing", "hello", "team", "info", "platform"]);

type Target = ActivitySegment;
type Template = { kind: ActivityKind; say: (actor: string, target: Target, after: Record<string, unknown>) => ActivitySegment[] };

const t = (kind: ActivityKind, say: Template["say"]): Template => ({ kind, say });

/** Every event code the backend writes, as a sentence. */
const TEMPLATES: Record<string, Template> = {
  // Stores
  "tenant.create": t("store", (a, s) => [a, " created ", s]),
  "tenant.update": t("store", (a, s) => [a, " edited ", s]),
  "tenant.profile_updated": t("store", (a, s) => [a, " updated the details of ", s]),
  "tenant.notes": t("store", (a, s) => [a, " added a note to ", s]),
  "tenant.live": t("live", (a, s) => [a, " marked ", s, " as live"]),
  "tenant.impersonate": t("admin", (a, s) => [a, " opened ", s, " as admin"]),
  "tenant.staff_viewed": t("view", (a, s) => [a, " looked at the team of ", s]),
  "tenant.suspend": t("pause", (a, s) => [a, " paused ", s]),
  "tenant.reactivate_billing": t("live", (a, s) => [a, " turned ", s, " back on after payment"]),
  "tenant.reactivate_override": t("live", (a, s) => [a, " turned ", s, " back on"]),
  "tenant.delete": t("delete", (a, s) => [a, " removed ", s]),
  "tenant.restore": t("store", (a, s) => [a, " restored ", s]),
  "tenant.purge_started": t("delete", (_a, s) => ["Deleting the data of ", s]),
  "tenant.purge_completed": t("delete", (_a, s) => ["The data of ", s, " was deleted"]),
  "tenant.provision_retry": t("store", (a, s) => [a, " retried the setup of ", s]),
  "tenant.owner_invite_resent": t("team", (a, s) => [a, " sent the owner invite for ", s, " again"]),
  "tenant.domain_verification_started": t("settings", (a, s) => [a, " started checking the domain of ", s]),
  "tenant.domain_verification_failed": t("settings", (_a, s) => ["The domain check failed for ", s]),
  "tenant.status_history_backfilled": t("store", (_a, s) => ["Status history filled in for ", s]),
  // Billing
  "invoice.record_payment": t("billing", (a, _s, x) => [a, " recorded a payment", money(x.amount, " of ")]),
  "invoice.void": t("billing", (a) => [a, " voided an invoice"]),
  "invoice.apply_coupon": t("coupon", (a) => [a, " applied a coupon to an invoice"]),
  "invoice.pdf_downloaded": t("billing", (a) => [a, " downloaded an invoice"]),
  "credit.issue": t("credit", (a, s, x) => [a, " gave ", s, " a credit", money(x.amount, " of ")]),
  "payment.record_refund": t("billing", (a, _s, x) => [a, " recorded a refund", money(x.amount, " of ")]),
  "payment.resolve_flagged": t("billing", (a) => [a, " resolved a flagged payment"]),
  "subscription.activate_override": t("billing", (a, s) => [a, " started the plan of ", s]),
  "subscription.reactivate_override": t("billing", (a, s) => [a, " restarted the plan of ", s]),
  "reminder.send": t("billing", (a, _s, x) => [a, " sent ", count(x.tenants, "payment reminder", "payment reminders")]),
  // Plans and coupons
  "plan.create": t("plan", (a, _s, x) => [a, " created the ", text(x.displayName ?? x.name, "a new"), " plan"]),
  "plan.archive": t("plan", (a) => [a, " archived a plan"]),
  "plan.migrate": t("plan", (a) => [a, " moved stores to a new plan version"]),
  "coupon.create": t("coupon", (a, _s, x) => [a, " created the coupon ", text(x.code, "")]),
  "coupon.update": t("coupon", (a) => [a, " edited a coupon"]),
  "coupon.deactivate": t("coupon", (a) => [a, " turned off a coupon"]),
  // Team and sign-in
  "user.invite": t("team", (a, _s, x) => [a, " invited ", text(x.email ?? x.name, "a teammate"), x.role ? ` as ${roleWord(x.role)}` : ""]),
  "user.role_changed": t("team", (a, _s, x) => [a, " changed a teammate's role", x.role ? ` to ${roleWord(x.role)}` : ""]),
  "user.disabled": t("team", (a) => [a, " turned off a teammate's access"]),
  "user.mfa_reset": t("auth", (a) => [a, " reset a teammate's two-step sign-in"]),
  "user.store_sessions_revoked": t("auth", (a, s) => [a, " signed everyone out of ", s]),
  "auth.login": t("auth", (a) => [a, " signed in"]),
  "auth.login_failed": t("auth", (a) => ["A sign-in failed for ", a]),
  "auth.password_set": t("auth", (a) => [a, " set a password"]),
  "auth.mfa_enabled": t("auth", (a) => [a, " turned on two-step sign-in"]),
  "auth.mfa_enrolment_started": t("auth", (a) => [a, " started setting up two-step sign-in"]),
  "auth.session_revoked": t("auth", (a) => [a, " signed out a device"]),
  "platform_user.password_changed": t("auth", (a) => [a, " changed their password"]),
  // Zcom AI
  "ai.config_updated": t("ai", (a) => [a, " changed the Zcom AI settings"]),
  "ai.tenant_override_set": t("ai", (a, s) => [a, " changed the Zcom AI limit of ", s]),
  "ai.topup_granted": t("ai", (a, s) => [a, " gave ", s, " more Zcom AI questions"]),
  "ai.topup_request_dismissed": t("ai", (a, s) => [a, " turned down a Zcom AI top-up for ", s]),
  "ai.top_questions_viewed": t("view", (a, s) => [a, " read the top Zcom AI questions of ", s]),
  "ai.usage_exported": t("ai", (a) => [a, " exported Zcom AI usage"]),
  // Settings, apps, jobs
  "settings.update": t("settings", (a) => [a, " changed the platform settings"]),
  "settings.invoice_issuer_updated": t("settings", (a) => [a, " updated the invoice details"]),
  "app.set_status": t("apps", (a) => [a, " changed an app's status"]),
  "app.seed_catalog": t("apps", (a) => [a, " refreshed the app catalogue"]),
  "app.reencrypt": t("apps", (a) => [a, " rotated the app keys"]),
  "analytics.rerun_sync": t("apps", (a, s) => [a, " re-ran the Google Analytics sync for ", s]),
  "job.usage_snapshot": t("settings", (a) => [a, " refreshed the usage numbers"]),
  // Support and announcements
  "support_ticket.status": t("support", (a) => [a, " updated a ticket"]),
  "support_ticket.priority": t("support", (a) => [a, " changed a ticket's priority"]),
  "support_ticket.assign": t("support", (a) => [a, " assigned a ticket"]),
  "release_note.create": t("announce", (a) => [a, " posted an announcement"]),
  "release_note.update": t("announce", (a) => [a, " edited an announcement"]),
  "release_note.delete": t("announce", (a) => [a, " removed an announcement"]),
  // Orders fixed by Zerror staff
  "order.return_override": t("order", (a, s) => [a, " approved a return for ", s]),
  "order.offline_payment_recorded": t("order", (a, s) => [a, " recorded an offline payment for ", s]),
  "order.offline_payment_voided": t("order", (a, s) => [a, " voided an offline payment for ", s]),
  "order.capture_accepted": t("order", (a, s) => [a, " accepted a payment for ", s]),
  "order.attention_resolved": t("order", (a, s) => [a, " resolved an order for ", s]),
};

/** Prefix families the backend builds at run time (`tenant.restricted.<operation>`, `app.<command>`, `job.<name>`). */
const PREFIX_TEMPLATES: [string, Template][] = [
  ["tenant.restricted.", t("admin", (a, s) => [a, " made a change in ", s, " as admin"])],
  ["app.", t("apps", (a) => [a, " ran an app command"])],
  ["job.", t("settings", (a) => [a, " ran a platform job"])],
];

// ─── Helpers ──────────────────────────────────────────────────────────────

function money(value: unknown, lead: string): string {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) && amount > 0 ? `${lead}₹${Math.round(amount).toLocaleString("en-IN")}` : "";
}

function count(value: unknown, one: string, many: string): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return many;
  return `${n} ${n === 1 ? one : many}`;
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function roleWord(value: unknown): string {
  const role = String(value).replace(/^PLATFORM_|^SUPER_/, "").replace(/_/g, " ").toLowerCase();
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function parseAfter(after: string | null | undefined): Record<string, unknown> {
  if (!after) return {};
  try {
    const value = JSON.parse(after);
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** "mehak@zerrorstudios.com" → "Mehak"; role mailboxes → "Zerror admin"; the viewer → "You". */
export function actorName(email: string, viewerEmail?: string | null): string {
  const clean = email.trim().toLowerCase();
  if (viewerEmail && clean === viewerEmail.trim().toLowerCase()) return "You";
  const local = clean.split("@")[0] ?? "";
  if (!local || ROLE_MAILBOXES.has(local)) return "Zerror admin";
  const first = local.split(/[._+-]/)[0] ?? local;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/** A readable sentence for a code nobody mapped yet ("tenant.something_new" → "changed something new"). */
function fallbackTemplate(action: string): Template {
  const words = action.split(".").slice(1).join(" ").replace(/_/g, " ").trim() || "made a change";
  return t("other", (a, s) => (typeof s === "string" ? [a, ` ${words}`] : [a, ` ${words} · `, s]));
}

function templateOf(action: string): Template {
  return TEMPLATES[action] ?? PREFIX_TEMPLATES.find(([prefix]) => action.startsWith(prefix))?.[1] ?? fallbackTemplate(action);
}

/** The icon kind for an event code. */
export function activityKind(action: string): ActivityKind {
  return templateOf(action).kind;
}

function targetOf(entry: ActivityEntry, context: ActivityContext): Target {
  if (entry.targetType === "tenant" && entry.targetId) {
    return { storeId: entry.targetId, name: context.storeName(entry.targetId) ?? "a store" };
  }
  // Sentences that name a store read "a store" when the row's target is something else (an order, an invoice).
  return "a store";
}

/** One entry as a sentence. */
export function describeActivity(entry: ActivityEntry, context: ActivityContext): ActivitySegment[] {
  const template = templateOf(entry.action);
  return template.say(actorName(entry.actorEmail, context.viewerEmail), targetOf(entry, context), parseAfter(entry.after));
}

// ─── Grouping ─────────────────────────────────────────────────────────────

/**
 * Rows for a feed, newest first: one per entry, except that entries with the
 * same action by the same person within 10 minutes of the group's newest
 * become one row. Several stores read "2 stores"; the same thing done again
 * reads "… · 3 times".
 */
export function groupActivity(entries: readonly ActivityEntry[], context: ActivityContext): ActivityRow[] {
  const sorted = [...entries].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const groups: ActivityEntry[][] = [];
  for (const entry of sorted) {
    const last = groups[groups.length - 1];
    const head = last?.[0];
    if (
      head &&
      head.action === entry.action &&
      head.actorEmail === entry.actorEmail &&
      new Date(head.at).getTime() - new Date(entry.at).getTime() <= ACTIVITY_GROUP_WINDOW_MS
    ) {
      last.push(entry);
    } else {
      groups.push([entry]);
    }
  }

  return groups.map((group) => {
    const head = group[0];
    const template = templateOf(head.action);
    const actor = actorName(head.actorEmail, context.viewerEmail);
    const after = parseAfter(head.after);
    if (group.length === 1) {
      return { id: head.id, kind: template.kind, segments: template.say(actor, targetOf(head, context), after), at: head.at, count: 1 };
    }
    const stores = Array.from(new Set(group.filter((entry) => entry.targetType === "tenant" && entry.targetId).map((entry) => entry.targetId!)));
    let segments: ActivitySegment[];
    if (stores.length > 1) {
      segments = template.say(actor, `${stores.length} stores`, after);
    } else {
      segments = [...template.say(actor, targetOf(head, context), after), ` · ${group.length} times`];
    }
    return { id: head.id, kind: template.kind, segments, at: head.at, count: group.length };
  });
}

/** The sentence as plain text (tests, titles, screen readers). */
export function activityText(segments: readonly ActivitySegment[]): string {
  return segments.map((segment) => (typeof segment === "string" ? segment : segment.name)).join("");
}
