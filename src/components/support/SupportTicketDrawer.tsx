import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@apollo/client";
import {
  Button,
  Chip,
  Drawer,
  Input,
  SegmentedSwitch,
  Select,
  SelectItem,
  Textarea,
  cx,
  formatDate,
  formatDateTime,
  toastError,
} from "../ui";
import { IconChat, IconCheck, IconFile, IconMessages, IconPhone, IconSend } from "../ui/icons";
import {
  ADD_PLATFORM_SUPPORT_NOTE,
  ASSIGN_PLATFORM_SUPPORT_TICKET,
  PLATFORM_SUPPORT_ASSIGNEES,
  PLATFORM_SUPPORT_TICKET,
  REPLY_PLATFORM_SUPPORT_TICKET,
  SET_PLATFORM_SUPPORT_TICKET_PRIORITY,
  SET_PLATFORM_SUPPORT_TICKET_STATUS,
} from "../../graphql/support";
import { errorReasonOf } from "../../lib/apollo-client";
import { mutationFailureCopy } from "../../lib/mutation-errors";
import { useAuth } from "../../providers/AuthProvider";
import {
  CONTACT_ROLE_LABEL,
  PRIORITIES,
  PRIORITY_LABEL,
  SETTABLE_STATUSES,
  STATUS_LABEL,
  STATUS_TONE,
  TRACKER_STEPS,
  canAssignTo,
  canBeResolved,
  closedByLabel,
  isClosed,
  isImage,
  isResolved,
  priorityNeedsNote,
  safeHttpUrl,
  supportAbilities,
  telLink,
  whatsappLink,
  type SupportAttachment,
  type SupportPriority,
  type SupportStatus,
  type SupportTicket,
} from "./support.util";
import { PriorityNoteDialog, ResolveTicketDialog } from "./SupportTicketDialogs";
import { SkelChip, SkelLine } from "../common/SkeletonBits";

type ComposerMode = "reply" | "note";
/** "Then:" after a reply; KEEP sends no status (a RESOLVED ticket stays RESOLVED). */
type NextStatus = SupportStatus | "KEEP";

const UNASSIGNED = "__none";
const QUICK_REPLIES_MAX = 3;
const THREAD_POLL_MS = 30_000;
const REFETCH = ["PlatformSupportTickets", "PlatformSupportSummary"];
const LINK_CLASS = "inline-flex items-center gap-1.5 text-label text-brand-text hover:underline";

function Tracker({ step }: { step: number }) {
  return (
    <ol className="grid grid-cols-4" aria-label="Ticket progress">
      {TRACKER_STEPS.map((label, index) => (
        <li key={label} aria-current={index === step ? "step" : undefined}>
          <div className="flex items-center">
            <span className={cx("size-3 shrink-0 rounded-full", index <= step ? "bg-brand" : "bg-surface-muted ring-1 ring-line")} />
            {index < TRACKER_STEPS.length - 1 ? (
              <span className={cx("mx-1 h-0.5 flex-1 rounded-full", index < step ? "bg-brand" : "bg-line")} />
            ) : null}
          </div>
          <p className={cx("mt-2 text-label", index <= step ? "text-fg" : "text-fg-muted")}>{label}</p>
        </li>
      ))}
    </ol>
  );
}

function Attachments({ items }: { items: SupportAttachment[] }) {
  if (!items.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item.url}>
          <a href={item.url} target="_blank" rel="noreferrer noopener" title={item.name} className="block overflow-hidden rounded-xl border border-line bg-surface">
            {isImage(item) ? (
              <img src={item.url} alt={item.name} className="size-16 object-cover" loading="lazy" />
            ) : (
              <span className="flex h-16 max-w-48 items-center gap-2 px-3 text-label text-fg">
                <IconFile aria-hidden className="size-4 shrink-0 text-fg-muted" />
                <span className="truncate">{item.name}</span>
              </span>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** One "label / value" fact of the ticket. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption text-fg-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-body text-fg">{children}</dd>
    </div>
  );
}

/** PRD-049 FR-A8: what the dashboard captured when the store raised the ticket (collapsed until opened). */
function CapturedContext({ ticket }: { ticket: SupportTicket }) {
  const context = ticket.context;
  if (!context) return null;
  const pageUrl = safeHttpUrl(context.pageUrl);
  const rows: [string, ReactNode][] = [
    [
      "Page",
      pageUrl ? (
        <a key="page" href={pageUrl} target="_blank" rel="noreferrer noopener" className="text-brand-text hover:underline">
          {context.pageUrl}
        </a>
      ) : (
        context.pageUrl
      ),
    ],
    ["Browser", context.browser],
    ["Device", context.os],
    ["Screen", context.screen],
    ["Dashboard build", context.appVersion],
    ["Plan", context.plan],
  ];
  const shown = rows.filter(([, value]) => value != null && value !== "");
  const errors = context.recentErrors ?? [];
  if (!shown.length && !errors.length) return null;
  return (
    <details className="rounded-xl border border-line bg-surface">
      <summary className="cursor-pointer select-none px-3 py-2 text-label font-medium text-fg">
        Captured with the ticket
        {errors.length ? (
          <span className="ml-2 font-normal text-tone-danger-text">
            {errors.length} recent {errors.length === 1 ? "error" : "errors"}
          </span>
        ) : null}
      </summary>
      <div className="space-y-3 border-t border-line-subtle px-3 py-3">
        {shown.length ? (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {shown.map(([label, value]) => (
              <Fact key={label} label={label}>
                {value}
              </Fact>
            ))}
          </dl>
        ) : null}
        {errors.length ? (
          <div>
            <p className="text-caption text-fg-muted">Recent errors in the dashboard</p>
            <ul className="mt-1 max-h-48 space-y-1 overflow-auto rounded-lg bg-surface-sunken p-2 font-mono text-caption text-fg">
              {errors.map((line, index) => (
                <li key={`${index}:${line}`} className="break-words">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </details>
  );
}

/** The person the store named (PRD-049 FR-A7): email, call and, only when they said yes, WhatsApp. */
function ContactCard({ ticket }: { ticket: SupportTicket }) {
  const contact = ticket.contact;
  if (!contact) return null;
  const tel = telLink(contact.phone);
  const whatsapp = whatsappLink(contact);
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-3">
      <p className="text-caption text-fg-muted">Contact</p>
      <p className="mt-0.5 text-body font-medium text-fg">
        {contact.name}
        <span className="font-normal text-fg-muted"> · {CONTACT_ROLE_LABEL[contact.role] ?? contact.role}</span>
      </p>
      {contact.bestTime ? <p className="text-label text-fg-muted">Best time: {contact.bestTime}</p> : null}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
        {contact.email ? (
          <a className={LINK_CLASS} href={`mailto:${contact.email}`}>
            <IconMessages aria-hidden className="size-4" />
            {contact.email}
          </a>
        ) : null}
        {tel ? (
          <a className={LINK_CLASS} href={tel}>
            <IconPhone aria-hidden className="size-4" />
            {contact.phone}
          </a>
        ) : null}
        {whatsapp ? (
          <a className={LINK_CLASS} href={whatsapp} target="_blank" rel="noreferrer noopener">
            <IconChat aria-hidden className="size-4" />
            WhatsApp
          </a>
        ) : null}
      </div>
    </div>
  );
}

/** The outcome and its note, how it closed and the store's rating (PRD-049 FR-A13, FR-A14). */
function ResolutionCard({ ticket }: { ticket: SupportTicket }) {
  if (!ticket.outcome && !ticket.closedBy && !ticket.rating) return null;
  const closedLabel = closedByLabel(ticket.closedBy);
  const resolvedBy = [ticket.resolvedByName, ticket.resolvedAt ? formatDateTime(ticket.resolvedAt) : null].filter(Boolean).join(" · ");
  return (
    <div className="rounded-xl border border-line bg-surface-muted px-3 py-3">
      {ticket.outcome ? (
        <p className="flex flex-wrap items-center gap-1.5 text-body font-medium text-fg">
          <IconCheck aria-hidden className="size-4" />
          {ticket.outcomeLabel ?? ticket.outcome}
          {resolvedBy ? <span className="font-normal text-fg-muted">· {resolvedBy}</span> : null}
        </p>
      ) : null}
      {ticket.outcomeNote ? <p className="mt-1 whitespace-pre-wrap text-label text-fg">{ticket.outcomeNote}</p> : null}
      {closedLabel ? (
        <p className="mt-1 text-label text-fg-muted">
          {closedLabel}
          {ticket.closedAt ? ` · ${formatDateTime(ticket.closedAt)}` : ""}
        </p>
      ) : null}
      {ticket.rating ? (
        <p className="mt-1 text-label text-fg">
          Rated {ticket.rating.score} of 5{ticket.rating.comment ? `: "${ticket.rating.comment}"` : ""}
        </p>
      ) : null}
    </div>
  );
}

interface SupportTicketDrawerProps {
  ticketId: string | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
}

/**
 * Super Admin › Support drawer (board 45, round 2 §6.4; PRD-049 step A1): the store's tracker, the ticket's type,
 * the store's impact, contact and captured context, the outcome and rating once resolved, and the thread with
 * internal notes tinted amber ("Only Zcom sees this"). Status (Open, In progress, Waiting on store only), Resolve
 * (outcome + note, FR-A13), priority (a note the store sees when lowered below its impact, FR-A10) and assignee.
 * The composer sends a reply (up to three quick-reply buttons, then the status to move to) or an internal note; a
 * ticket the store closed takes notes only (only the store reopens it). Reads need platform:support:read; reply,
 * note, status, resolve and assigning yourself platform:support:reply; priority and assigning others
 * platform:support:manage.
 */
export function SupportTicketDrawer({ ticketId, onClose, onPrev, onNext, prevDisabled, nextDisabled }: SupportTicketDrawerProps) {
  const { can, user } = useAuth();
  const abilities = supportAbilities(can);
  const { data, loading } = useQuery(PLATFORM_SUPPORT_TICKET, {
    variables: { id: ticketId },
    skip: !ticketId || !abilities.read,
    fetchPolicy: "cache-and-network",
    pollInterval: ticketId ? THREAD_POLL_MS : 0,
  });
  const { data: assigneeData } = useQuery(PLATFORM_SUPPORT_ASSIGNEES, { skip: !ticketId || !abilities.manage });
  const ticket: SupportTicket | undefined = data?.platformSupportTicket;
  const [replyMutation, { loading: replying }] = useMutation(REPLY_PLATFORM_SUPPORT_TICKET, { refetchQueries: REFETCH });
  const [noteMutation, { loading: noting }] = useMutation(ADD_PLATFORM_SUPPORT_NOTE);
  const [assign] = useMutation(ASSIGN_PLATFORM_SUPPORT_TICKET, { refetchQueries: REFETCH });
  const [setStatus] = useMutation(SET_PLATFORM_SUPPORT_TICKET_STATUS, { refetchQueries: REFETCH });
  const [setPriority, { loading: savingPriority }] = useMutation(SET_PLATFORM_SUPPORT_TICKET_PRIORITY, { refetchQueries: REFETCH });

  const [mode, setMode] = useState<ComposerMode>("reply");
  const [body, setBody] = useState("");
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [quickDraft, setQuickDraft] = useState("");
  const [nextStatus, setNextStatus] = useState<NextStatus | null>(null);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [priorityDraft, setPriorityDraft] = useState<SupportPriority | null>(null);
  const [priorityError, setPriorityError] = useState<string | null>(null);
  // Another ticket opened (prev / next): its own "Then:" default and no dialog left open.
  const [shownId, setShownId] = useState(ticketId);
  if (shownId !== ticketId) {
    setShownId(ticketId);
    setNextStatus(null);
    setResolveOpen(false);
    setPriorityDraft(null);
    setPriorityError(null);
  }

  const fail = (error: unknown) => {
    const message = mutationFailureCopy(error);
    if (message) toastError(message);
  };

  const closed = ticket ? isClosed(ticket.status) : false;
  const resolved = ticket ? isResolved(ticket.status) : false;
  // A closed ticket is the store's to reopen (CONFLICT TICKET_CLOSED on a reply): notes only.
  const composerMode: ComposerMode = closed ? "note" : mode;
  const thenStatus: NextStatus = nextStatus ?? (resolved ? "KEEP" : "WAITING_ON_STORE");

  const send = async () => {
    if (!ticketId || !body.trim()) return;
    try {
      if (composerMode === "note") {
        await noteMutation({ variables: { id: ticketId, input: { body: body.trim() } } });
      } else {
        const input: Record<string, unknown> = { body: body.trim(), quickReplies };
        if (thenStatus !== "KEEP") input.status = thenStatus;
        await replyMutation({ variables: { id: ticketId, input } });
        setQuickReplies([]);
        setNextStatus(null);
      }
      setBody("");
    } catch (error) {
      fail(error);
    }
  };

  const addQuickReply = () => {
    const text = quickDraft.trim();
    if (!text || quickReplies.length >= QUICK_REPLIES_MAX || quickReplies.includes(text)) return;
    setQuickReplies((previous) => [...previous, text]);
    setQuickDraft("");
  };

  const changePriority = async (next: SupportPriority, note: string | null) => {
    if (!ticket) return;
    try {
      await setPriority({ variables: { id: ticket.id, priority: next, note } });
      setPriorityDraft(null);
      setPriorityError(null);
    } catch (error) {
      if (errorReasonOf(error) === "NOTE_REQUIRED") {
        // The store's impact is higher than this screen knew: ask for the note.
        setPriorityDraft(next);
        setPriorityError("Tell the store why the priority is lower.");
      } else fail(error);
    }
  };

  const pickPriority = (next: SupportPriority) => {
    if (!ticket || next === ticket.priority) return;
    if (priorityNeedsNote(ticket.impact, next)) {
      setPriorityError(null);
      setPriorityDraft(next);
      return;
    }
    void changePriority(next, null);
  };

  // Manage: every support user. Reply only: yourself; whoever holds it now is shown but not pickable.
  const people: { id: string; name: string }[] = abilities.manage
    ? (assigneeData?.platformSupportAssignees ?? [])
    : user
      ? [{ id: user.id, name: user.name }]
      : [];
  const assigneeItems = [{ id: UNASSIGNED, name: "Not assigned" }, ...people];
  if (ticket?.assignee && !assigneeItems.some((person) => person.id === ticket.assignee?.id)) {
    assigneeItems.push({ id: ticket.assignee.id, name: ticket.assignee.name });
  }
  const assigneeDisabled = assigneeItems
    .filter((person) => person.id !== (ticket?.assignee?.id ?? UNASSIGNED))
    .filter((person) => !canAssignTo(abilities, person.id === UNASSIGNED ? null : person.id, user?.id))
    .map((person) => person.id);

  // The three settable statuses, plus the current one when it isn't settable (shown, not pickable).
  const statusItems: SupportStatus[] =
    ticket && !SETTABLE_STATUSES.includes(ticket.status) ? [...SETTABLE_STATUSES, ticket.status] : SETTABLE_STATUSES;
  const thenItems: NextStatus[] = resolved ? ["KEEP", ...SETTABLE_STATUSES] : SETTABLE_STATUSES;

  const about = ticket ? [ticket.linkedOrder?.label, ticket.linkedProduct?.label, ticket.linkedCustomer?.label].filter(Boolean) : [];

  return (
    <Drawer
      isOpen={Boolean(ticketId)}
      onOpenChange={(open) => !open && onClose()}
      size="md"
      title={
        <span className="block min-w-0">
          <span className="block font-mono text-label uppercase tracking-wide text-fg-muted">
            {ticket ? `${ticket.ref} · ${ticket.typeLabel} · ${ticket.topicLabel}` : " "}
          </span>
          <span className="block truncate">{ticket?.title ?? "Ticket"}</span>
        </span>
      }
      onPrev={onPrev}
      onNext={onNext}
      prevDisabled={prevDisabled}
      nextDisabled={nextDisabled}
      footer={
        ticket && abilities.reply ? (
          <div className="w-full space-y-2">
            {closed ? (
              <p className="text-label text-fg-muted">The store closed this ticket. They can reopen it. You can still add an internal note.</p>
            ) : (
              <SegmentedSwitch<ComposerMode>
                ariaLabel="Message type"
                size="sm"
                items={[
                  { value: "reply", label: "Reply to store" },
                  { value: "note", label: "Internal note" },
                ]}
                value={composerMode}
                onChange={setMode}
              />
            )}
            {composerMode === "reply" ? (
              <div className="space-y-2">
                {quickReplies.length ? (
                  <div className="flex flex-wrap gap-2">
                    {quickReplies.map((text) => (
                      <Chip key={text} tone="info" dot={false}>
                        <button type="button" onClick={() => setQuickReplies((previous) => previous.filter((item) => item !== text))} aria-label={`Remove quick reply ${text}`}>
                          {text} ×
                        </button>
                      </Chip>
                    ))}
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <Input
                    aria-label="Quick reply button for the store"
                    placeholder="Add a quick-reply button (optional)"
                    size="sm"
                    maxLength={60}
                    value={quickDraft}
                    onValueChange={setQuickDraft}
                    isDisabled={quickReplies.length >= QUICK_REPLIES_MAX}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addQuickReply();
                      }
                    }}
                  />
                  <Select
                    aria-label="Status after the reply"
                    size="sm"
                    className="max-w-52"
                    selectedKeys={new Set([thenStatus])}
                    disallowEmptySelection
                    onSelectionChange={(keys) => setNextStatus(String(Array.from(keys)[0]) as NextStatus)}
                  >
                    {thenItems.map((status) => (
                      <SelectItem key={status}>{status === "KEEP" ? "Then: keep Resolved" : `Then: ${STATUS_LABEL[status]}`}</SelectItem>
                    ))}
                  </Select>
                </div>
              </div>
            ) : null}
            <div
              className={cx(
                "flex items-end gap-2 rounded-2xl border p-2",
                composerMode === "note" ? "border-tone-warning bg-tone-warning-soft" : "border-line bg-surface",
              )}
            >
              <Textarea
                aria-label={composerMode === "note" ? "Internal note" : "Reply to the store"}
                placeholder={composerMode === "note" ? "Only Zcom sees this note" : "Write a reply the store sees"}
                labelPlacement="inside"
                minRows={1}
                maxRows={6}
                value={body}
                onValueChange={setBody}
                classNames={{ inputWrapper: "border-0 shadow-none bg-transparent" }}
              />
              <Button
                variant={composerMode === "note" ? "secondary" : "primary"}
                size="sm"
                startIcon={<IconSend aria-hidden className="size-4" />}
                isLoading={replying || noting}
                isDisabled={!body.trim()}
                onPress={() => void send()}
              >
                {composerMode === "note" ? "Add note" : "Send"}
              </Button>
            </div>
          </div>
        ) : null
      }
    >
      {!ticket && loading ? (
        // Loading pass: the ticket's layout. The tracker's steps are static, so they show (none reached yet);
        // the lines, controls and messages are placeholders.
        <div className="space-y-5" aria-busy>
          <section className="space-y-3 border-b border-line pb-5">
            <Tracker step={-1} />
            <SkelLine text="text-label" className="w-3/4" />
            <SkelLine text="text-label" className="w-1/2" />
            {abilities.reply ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {[0, 1, 2].map((index) => (
                  <span key={index} aria-hidden className="zc-skel block h-12 rounded-field" />
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <SkelChip />
                <SkelChip className="w-24" />
              </div>
            )}
          </section>
          <ol className="space-y-5">
            {[0, 1].map((index) => (
              <li key={index} className="flex gap-3">
                <span aria-hidden className="zc-skel size-7 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <SkelLine text="text-label" className="w-40" />
                  <SkelLine className="w-full" />
                  <SkelLine className={index ? "w-1/3" : "w-2/3"} />
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : ticket ? (
        <div className="space-y-5">
          <section className="space-y-3 border-b border-line pb-5">
            <Tracker step={ticket.trackerStep} />
            <p className="text-label text-fg-muted">
              {ticket.expectedResolution} · priority {PRIORITY_LABEL[ticket.priority]} · first reply target {ticket.replyTargetHours} h
            </p>
            <p className="text-label text-fg-muted">
              <Link to={`/stores/${ticket.tenantId}/overview`} className="font-medium text-brand-text hover:underline">
                {ticket.storeName || ticket.storeSlug}
              </Link>
              {" · "}
              {ticket.raisedByEmail ?? ticket.raisedByName}
              {ticket.raisedViaImpersonation ? " · raised while logged in as the store" : ""}
            </p>

            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Fact label="Type">{ticket.typeLabel}</Fact>
              <Fact label="Area">{ticket.topicLabel}</Fact>
              <Fact label="Store's impact">
                {ticket.impact ? PRIORITY_LABEL[ticket.impact] : "Not given"}
                {ticket.impact && ticket.impact !== ticket.priority ? (
                  <span className="text-fg-muted"> (now {PRIORITY_LABEL[ticket.priority].toLowerCase()})</span>
                ) : null}
              </Fact>
              {ticket.neededBy ? <Fact label="Needed by">{formatDate(ticket.neededBy)}</Fact> : null}
              {about.length ? <Fact label="About">{about.join(" · ")}</Fact> : null}
              {ticket.followUpOf ? (
                <Fact label="Follows up">
                  <Link to={`/support/tickets?ticket=${ticket.followUpOf.id}`} className="font-mono text-brand-text hover:underline">
                    {ticket.followUpOf.label}
                  </Link>
                </Fact>
              ) : null}
              {ticket.reopenedCount ? (
                <Fact label="Reopened">{ticket.reopenedCount === 1 ? "Once" : `${ticket.reopenedCount} times`}</Fact>
              ) : null}
            </dl>

            {ticket.steps ? (
              <div>
                <p className="text-caption text-fg-muted">Steps to see it</p>
                <p className="mt-0.5 whitespace-pre-wrap rounded-xl bg-surface-muted px-3 py-2 text-body text-fg">{ticket.steps}</p>
              </div>
            ) : null}

            <ContactCard ticket={ticket} />
            <CapturedContext ticket={ticket} />
            <ResolutionCard ticket={ticket} />

            {abilities.reply ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Select
                  label="Status"
                  size="sm"
                  selectedKeys={new Set([ticket.status])}
                  disabledKeys={statusItems.filter((status) => !SETTABLE_STATUSES.includes(status))}
                  isDisabled={closed}
                  disallowEmptySelection
                  onSelectionChange={(keys) => {
                    const value = String(Array.from(keys)[0]);
                    if (value !== ticket.status) void setStatus({ variables: { id: ticket.id, status: value } }).catch(fail);
                  }}
                >
                  {statusItems.map((status) => (
                    <SelectItem key={status}>{STATUS_LABEL[status]}</SelectItem>
                  ))}
                </Select>
                {abilities.manage ? (
                  <Select
                    label="Priority"
                    size="sm"
                    selectedKeys={new Set([ticket.priority])}
                    isDisabled={savingPriority}
                    disallowEmptySelection
                    onSelectionChange={(keys) => pickPriority(String(Array.from(keys)[0]) as SupportPriority)}
                  >
                    {PRIORITIES.map((priority) => (
                      <SelectItem key={priority}>{PRIORITY_LABEL[priority]}</SelectItem>
                    ))}
                  </Select>
                ) : (
                  <dl>
                    <Fact label="Priority">{PRIORITY_LABEL[ticket.priority]}</Fact>
                  </dl>
                )}
                <Select
                  label="Assigned to"
                  size="sm"
                  selectedKeys={new Set([ticket.assignee?.id ?? UNASSIGNED])}
                  disabledKeys={assigneeDisabled}
                  disallowEmptySelection
                  onSelectionChange={(keys) => {
                    const value = String(Array.from(keys)[0]);
                    if (value === (ticket.assignee?.id ?? UNASSIGNED)) return;
                    void assign({ variables: { id: ticket.id, assigneeId: value === UNASSIGNED ? null : value } }).catch(fail);
                  }}
                  items={assigneeItems}
                >
                  {(person: { id: string; name: string }) => <SelectItem key={person.id}>{person.name}</SelectItem>}
                </Select>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Chip tone={STATUS_TONE[ticket.status]}>{STATUS_LABEL[ticket.status]}</Chip>
                <Chip tone="neutral">{ticket.assignee?.name ?? "Not assigned"}</Chip>
              </div>
            )}
            {abilities.reply && canBeResolved(ticket.status) ? (
              <Button variant="secondary" size="sm" startIcon={<IconCheck aria-hidden className="size-4" />} onPress={() => setResolveOpen(true)}>
                Resolve
              </Button>
            ) : null}
            {resolved ? <p className="text-label text-fg-muted">Waiting for the store to confirm. It closes by itself if they don't.</p> : null}
          </section>

          <ol className="space-y-5" aria-label="Messages">
            {(ticket.messages ?? []).map((message) => {
              const fromStore = message.authorType === "STORE";
              return (
                <li key={message.id} className="flex gap-3">
                  <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-caption-strong text-fg">
                    {fromStore ? (ticket.storeName || "S").slice(0, 2).toUpperCase() : "Z"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-label text-fg-muted">
                      {message.authorName} · {formatDateTime(message.createdAt)}
                      {message.internal ? " · Internal note, only Zcom sees this" : ""}
                    </p>
                    {message.body ? (
                      <p
                        className={cx(
                          "mt-1 whitespace-pre-wrap rounded-2xl px-3 py-2 text-body text-fg",
                          message.internal ? "border border-dashed border-tone-warning bg-tone-warning-soft" : fromStore ? "bg-surface-muted" : "bg-brand-soft",
                        )}
                      >
                        {message.body}
                      </p>
                    ) : null}
                    <Attachments items={message.attachments} />
                    {message.quickReplies.length ? (
                      <p className="mt-1 text-label text-fg-muted">Buttons offered: {message.quickReplies.join(" · ")}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      {ticket ? (
        <>
          <ResolveTicketDialog ticketId={ticket.id} isOpen={resolveOpen} onClose={() => setResolveOpen(false)} refetchQueries={REFETCH} />
          <PriorityNoteDialog
            isOpen={priorityDraft != null}
            priority={priorityDraft}
            impact={ticket.impact ?? null}
            error={priorityError}
            isSaving={savingPriority}
            onClose={() => {
              setPriorityDraft(null);
              setPriorityError(null);
            }}
            onSave={(note) => {
              if (priorityDraft) void changePriority(priorityDraft, note);
            }}
          />
        </>
      ) : null}
    </Drawer>
  );
}
