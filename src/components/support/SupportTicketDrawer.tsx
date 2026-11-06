import { useState } from "react";
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
  Skeleton,
  Textarea,
  cx,
  formatDateTime,
  toastError,
} from "../ui";
import { IconFile, IconSend } from "../ui/icons";
import {
  ADD_PLATFORM_SUPPORT_NOTE,
  ASSIGN_PLATFORM_SUPPORT_TICKET,
  PLATFORM_SUPPORT_ASSIGNEES,
  PLATFORM_SUPPORT_TICKET,
  REPLY_PLATFORM_SUPPORT_TICKET,
  SET_PLATFORM_SUPPORT_TICKET_PRIORITY,
  SET_PLATFORM_SUPPORT_TICKET_STATUS,
} from "../../graphql/support";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { mutationFailureCopy } from "../../lib/mutation-errors";
import { useAuth } from "../../providers/AuthProvider";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  TRACKER_STEPS,
  isImage,
  type SupportAttachment,
  type SupportPriority,
  type SupportStatus,
  type SupportTicket,
} from "./support.util";

type ComposerMode = "reply" | "note";

const STATUSES: SupportStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_ON_STORE", "FIX_READY", "SOLVED"];
const PRIORITIES: SupportPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];
const UNASSIGNED = "__none";
const QUICK_REPLIES_MAX = 3;
const THREAD_POLL_MS = 30_000;
const REFETCH = ["PlatformSupportTickets", "PlatformSupportSummary"];

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

interface SupportTicketDrawerProps {
  ticketId: string | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
}

/**
 * Super Admin › Support drawer (board 45, round 2 §6.4: "the same drawer as the merchant side, plus internal notes
 * and assign-to"). The store's tracker and thread, with internal notes tinted amber and marked "Only Zcom sees
 * this"; status, priority and assignee pickers; a composer that sends a reply (with up to three quick-reply
 * buttons for the store and the status to move to) or an internal note. Writes need platform:notes:write.
 */
export function SupportTicketDrawer({ ticketId, onClose, onPrev, onNext, prevDisabled, nextDisabled }: SupportTicketDrawerProps) {
  const { can } = useAuth();
  const canWrite = can(PLATFORM_PERMISSIONS.NOTES_WRITE);
  const { data, loading } = useQuery(PLATFORM_SUPPORT_TICKET, {
    variables: { id: ticketId },
    skip: !ticketId,
    fetchPolicy: "cache-and-network",
    pollInterval: ticketId ? THREAD_POLL_MS : 0,
  });
  const { data: assigneeData } = useQuery(PLATFORM_SUPPORT_ASSIGNEES, { skip: !ticketId || !canWrite });
  const ticket: SupportTicket | undefined = data?.platformSupportTicket;
  const [replyMutation, { loading: replying }] = useMutation(REPLY_PLATFORM_SUPPORT_TICKET, { refetchQueries: REFETCH });
  const [noteMutation, { loading: noting }] = useMutation(ADD_PLATFORM_SUPPORT_NOTE);
  const [assign] = useMutation(ASSIGN_PLATFORM_SUPPORT_TICKET, { refetchQueries: REFETCH });
  const [setStatus] = useMutation(SET_PLATFORM_SUPPORT_TICKET_STATUS, { refetchQueries: REFETCH });
  const [setPriority] = useMutation(SET_PLATFORM_SUPPORT_TICKET_PRIORITY, { refetchQueries: REFETCH });

  const [mode, setMode] = useState<ComposerMode>("reply");
  const [body, setBody] = useState("");
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [quickDraft, setQuickDraft] = useState("");
  const [nextStatus, setNextStatus] = useState<SupportStatus>("WAITING_ON_STORE");

  const fail = (error: unknown) => {
    const message = mutationFailureCopy(error);
    if (message) toastError(message);
  };

  const send = async () => {
    if (!ticketId || !body.trim()) return;
    try {
      if (mode === "note") {
        await noteMutation({ variables: { id: ticketId, input: { body: body.trim() } } });
      } else {
        await replyMutation({ variables: { id: ticketId, input: { body: body.trim(), quickReplies, status: nextStatus } } });
        setQuickReplies([]);
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

  const assignees: { id: string; name: string }[] = assigneeData?.platformSupportAssignees ?? [];

  return (
    <Drawer
      isOpen={Boolean(ticketId)}
      onOpenChange={(open) => !open && onClose()}
      size="md"
      title={
        <span className="block min-w-0">
          <span className="block font-mono text-label uppercase tracking-wide text-fg-muted">
            {ticket ? `${ticket.ref} · ${ticket.topicLabel}` : " "}
          </span>
          <span className="block truncate">{ticket?.title ?? "Ticket"}</span>
        </span>
      }
      onPrev={onPrev}
      onNext={onNext}
      prevDisabled={prevDisabled}
      nextDisabled={nextDisabled}
      footer={
        ticket && canWrite ? (
          <div className="w-full space-y-2">
            <SegmentedSwitch<ComposerMode>
              ariaLabel="Message type"
              size="sm"
              items={[
                { value: "reply", label: "Reply to store" },
                { value: "note", label: "Internal note" },
              ]}
              value={mode}
              onChange={setMode}
            />
            {mode === "reply" ? (
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
                    className="max-w-48"
                    selectedKeys={new Set([nextStatus])}
                    disallowEmptySelection
                    onSelectionChange={(keys) => setNextStatus(String(Array.from(keys)[0]) as SupportStatus)}
                  >
                    {STATUSES.map((status) => (
                      <SelectItem key={status}>{`Then: ${STATUS_LABEL[status]}`}</SelectItem>
                    ))}
                  </Select>
                </div>
              </div>
            ) : null}
            <div className={cx("flex items-end gap-2 rounded-2xl border p-2", mode === "note" ? "border-tone-warning bg-tone-warning-soft" : "border-line bg-surface")}>
              <Textarea
                aria-label={mode === "note" ? "Internal note" : "Reply to the store"}
                placeholder={mode === "note" ? "Only Zcom sees this note" : "Write a reply the store sees"}
                labelPlacement="inside"
                minRows={1}
                maxRows={6}
                value={body}
                onValueChange={setBody}
                classNames={{ inputWrapper: "border-0 shadow-none bg-transparent" }}
              />
              <Button
                variant={mode === "note" ? "secondary" : "primary"}
                size="sm"
                startIcon={<IconSend aria-hidden className="size-4" />}
                isLoading={replying || noting}
                isDisabled={!body.trim()}
                onPress={() => void send()}
              >
                {mode === "note" ? "Add note" : "Send"}
              </Button>
            </div>
          </div>
        ) : null
      }
    >
      {!ticket && loading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
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
            {ticket.linkedOrder || ticket.linkedProduct ? (
              <p className="text-label text-fg-muted">About {[ticket.linkedOrder?.label, ticket.linkedProduct?.label].filter(Boolean).join(" · ")}</p>
            ) : null}
            {canWrite ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Select
                  label="Status"
                  size="sm"
                  selectedKeys={new Set([ticket.status])}
                  disallowEmptySelection
                  onSelectionChange={(keys) =>
                    void setStatus({ variables: { id: ticket.id, status: String(Array.from(keys)[0]) } }).catch(fail)
                  }
                >
                  {STATUSES.map((status) => (
                    <SelectItem key={status}>{STATUS_LABEL[status]}</SelectItem>
                  ))}
                </Select>
                <Select
                  label="Priority"
                  size="sm"
                  selectedKeys={new Set([ticket.priority])}
                  disallowEmptySelection
                  onSelectionChange={(keys) =>
                    void setPriority({ variables: { id: ticket.id, priority: String(Array.from(keys)[0]) } }).catch(fail)
                  }
                >
                  {PRIORITIES.map((priority) => (
                    <SelectItem key={priority}>{PRIORITY_LABEL[priority]}</SelectItem>
                  ))}
                </Select>
                <Select
                  label="Assigned to"
                  size="sm"
                  selectedKeys={new Set([ticket.assignee?.id ?? UNASSIGNED])}
                  disallowEmptySelection
                  onSelectionChange={(keys) => {
                    const value = String(Array.from(keys)[0]);
                    void assign({ variables: { id: ticket.id, assigneeId: value === UNASSIGNED ? null : value } }).catch(fail);
                  }}
                  items={[{ id: UNASSIGNED, name: "Not assigned" }, ...assignees]}
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
    </Drawer>
  );
}
