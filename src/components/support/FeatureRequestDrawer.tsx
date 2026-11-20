import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@apollo/client";
import {
  Button,
  Checkbox,
  Chip,
  ConfirmDialog,
  Drawer,
  ErrorState,
  RowMenu,
  Textarea,
  cx,
  formatCount,
  formatDate,
  formatDateTime,
  toastError,
  toneTextClasses,
  type RowMenuItem,
} from "../ui";
import { IconEdit, IconExternalLink, IconFlag, IconHide, IconLayers, IconSend, IconView } from "../ui/icons";
import {
  HIDE_FEATURE_REQUEST,
  PLATFORM_FEATURE_REQUEST,
  REPLY_FEATURE_REQUEST,
  UPDATE_FEATURE_COMMENT,
} from "../../graphql/feature-requests";
import { errorCodeOf } from "../../lib/apollo-client";
import { useAuth } from "../../providers/AuthProvider";
import { SkelChip, SkelLine } from "../common/SkeletonBits";
import { safeHttpUrl } from "./support.util";
import {
  FEATURE_COMMENT_MAX_CHARS,
  FEATURE_STATUS_LABEL,
  FEATURE_STATUS_TONE,
  featureAbilities,
  featureFailureCopy,
  lastActivityOf,
  replyError,
  scoreLabel,
  scoreTone,
  shouldReloadAfter,
  upVoterValueLabel,
  type FeatureComment,
  type FeatureRequestDetail,
} from "./feature-requests.util";
import { FeatureEditDialog, FeatureMergeDialog, FeatureStatusDialog } from "./FeatureRequestDialogs";

const REFETCH = ["PlatformFeatureRequests", "PlatformFeatureRequest"];

type OpenDialog = "status" | "merge" | "edit" | "hide" | null;

/** One "label / value" fact of the request. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption text-fg-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-body text-fg">{children}</dd>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-label font-medium text-fg">{children}</h3>;
}

/** Ups, downs and the score, side by side. */
function VoteTotals({ request }: { request: FeatureRequestDetail }) {
  const cells: { label: string; value: string; className?: string }[] = [
    { label: "Up votes", value: formatCount(request.upVotes) },
    { label: "Down votes", value: formatCount(request.downVotes) },
    { label: "Score", value: scoreLabel(request.score), className: toneTextClasses[scoreTone(request.score)] },
    { label: "Up-voters' plans", value: upVoterValueLabel(request.upVoterMonthlyValue, request.currency) },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface px-3 py-3 sm:grid-cols-4">
      {cells.map((cell) => (
        <div key={cell.label} className="min-w-0">
          <dt className="text-caption text-fg-muted">{cell.label}</dt>
          <dd className={cx("mt-0.5 text-body font-medium text-fg num", cell.className)}>{cell.value}</dd>
        </div>
      ))}
    </dl>
  );
}

interface FeatureRequestDrawerProps {
  requestId: string | null;
  onClose: () => void;
  /** Open another request in the drawer (a merge target, "merged into"). */
  onOpen: (id: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
}

/**
 * Support › Feature requests drawer (backend PRD-049 step A3, FR-A29, D13): the problem, the posting store, the
 * status with its note and release link, ups / downs / score, the up-voting stores' monthly plan value, votes by
 * plan, every vote (store, plan, up or down, the down-vote reason only Zerror sees, who, when) and every comment
 * (ZCommerce replies badged, pinned and hidden ones marked). With platform:feedback:manage: Change status, Merge
 * into…, Edit, Hide / Unhide, a reply box (optionally pinned), Pin / Unpin a ZCommerce reply and Hide / Unhide any
 * comment. Read-only otherwise. `?request=<id>` opens it (the console feed links there).
 */
export function FeatureRequestDrawer({ requestId, onClose, onOpen, onPrev, onNext, prevDisabled, nextDisabled }: FeatureRequestDrawerProps) {
  const { can } = useAuth();
  const abilities = featureAbilities(can);
  const { data, loading, error, refetch } = useQuery(PLATFORM_FEATURE_REQUEST, {
    variables: { id: requestId },
    skip: !requestId || !abilities.read,
    fetchPolicy: "cache-and-network",
  });
  const request: FeatureRequestDetail | undefined = data?.platformFeatureRequest;
  const [reply, { loading: replying }] = useMutation(REPLY_FEATURE_REQUEST, { refetchQueries: REFETCH });
  const [updateComment] = useMutation(UPDATE_FEATURE_COMMENT, { refetchQueries: REFETCH });
  const [hide, { loading: hiding }] = useMutation(HIDE_FEATURE_REQUEST, { refetchQueries: REFETCH });

  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [body, setBody] = useState("");
  const [pinReply, setPinReply] = useState(false);
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [busyComment, setBusyComment] = useState<string | null>(null);
  // Another request opened (prev / next, a merge): no dialog or draft left over.
  const [shownId, setShownId] = useState(requestId);
  if (shownId !== requestId) {
    setShownId(requestId);
    setDialog(null);
    setBody("");
    setPinReply(false);
    setBodyError(null);
  }

  const fail = (failure: unknown) => {
    const message = featureFailureCopy(failure);
    if (message) toastError(message);
    if (shouldReloadAfter(failure)) void refetch();
  };

  const merged = request?.status === "MERGED";
  const canAct = abilities.manage && !!request;

  const send = async () => {
    if (!request) return;
    const problem = replyError(body);
    if (problem) {
      setBodyError(problem);
      return;
    }
    try {
      await reply({ variables: { id: request.id, input: { body: body.trim(), pinned: pinReply } } });
      setBody("");
      setPinReply(false);
    } catch (failure) {
      if (errorCodeOf(failure) === "BAD_USER_INPUT") setBodyError((failure as Error).message || "Check the reply.");
      else fail(failure);
    }
  };

  const changeComment = async (comment: FeatureComment, input: { pinned?: boolean; hidden?: boolean }) => {
    setBusyComment(comment.id);
    try {
      await updateComment({ variables: { id: comment.id, input } });
    } catch (failure) {
      fail(failure);
    } finally {
      setBusyComment(null);
    }
  };

  const toggleHidden = async () => {
    if (!request) return;
    try {
      await hide({ variables: { id: request.id, hidden: !request.hidden } });
      setDialog(null);
    } catch (failure) {
      fail(failure);
      setDialog(null);
    }
  };

  const menuItems: RowMenuItem[] = request
    ? [
        ...(merged ? [] : [{ key: "status", label: "Change status", icon: IconFlag, onSelect: () => setDialog("status") }]),
        ...(merged ? [] : [{ key: "merge", label: "Merge into…", icon: IconLayers, onSelect: () => setDialog("merge") }]),
        { key: "edit", label: "Edit", icon: IconEdit, onSelect: () => setDialog("edit") },
        request.hidden
          ? { key: "unhide", label: "Show to stores", icon: IconView, onSelect: () => void toggleHidden() }
          : { key: "hide", label: "Hide from stores", icon: IconHide, onSelect: () => setDialog("hide"), destructive: true },
      ]
    : [];

  const notFound = !request && error && errorCodeOf(error) === "NOT_FOUND";
  const releaseUrl = safeHttpUrl(request?.releaseUrl);

  return (
    <Drawer
      isOpen={Boolean(requestId)}
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      title={
        <span className="block min-w-0">
          <span className="block font-mono text-label uppercase tracking-wide text-fg-muted">
            {request ? `${request.ref} · ${request.typeLabel} · ${request.areaLabel}` : " "}
          </span>
          <span className="block truncate">{request?.title ?? "Feature request"}</span>
        </span>
      }
      headerActions={
        request ? (
          <span className="flex items-center gap-2">
            <Chip tone={FEATURE_STATUS_TONE[request.status]}>{FEATURE_STATUS_LABEL[request.status]}</Chip>
            {canAct ? <RowMenu items={menuItems} label={`Actions for ${request.ref}`} /> : null}
          </span>
        ) : null
      }
      onPrev={onPrev}
      onNext={onNext}
      prevDisabled={prevDisabled}
      nextDisabled={nextDisabled}
      footer={
        canAct && !merged ? (
          <div className="w-full space-y-2">
            <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-2">
              <Textarea
                aria-label="Reply as the ZCommerce team"
                placeholder="Reply as the ZCommerce team. Every store sees it."
                labelPlacement="inside"
                minRows={1}
                maxRows={6}
                maxLength={FEATURE_COMMENT_MAX_CHARS}
                value={body}
                onValueChange={(value) => {
                  setBody(value);
                  setBodyError(null);
                }}
                isInvalid={!!bodyError}
                errorMessage={bodyError ?? undefined}
                classNames={{ inputWrapper: "border-0 shadow-none bg-transparent" }}
              />
              <Button
                variant="primary"
                size="sm"
                startIcon={<IconSend aria-hidden className="size-4" />}
                isLoading={replying}
                isDisabled={!body.trim()}
                onPress={() => void send()}
              >
                Reply
              </Button>
            </div>
            <Checkbox isSelected={pinReply} onValueChange={setPinReply}>
              Pin this reply to the top
            </Checkbox>
          </div>
        ) : null
      }
    >
      {!request && loading ? (
        <div className="space-y-5" aria-busy>
          <section className="space-y-3 border-b border-line pb-5">
            <SkelLine text="text-label" className="w-1/2" />
            <SkelLine className="w-full" />
            <SkelLine className="w-3/4" />
            <div className="flex flex-wrap gap-2">
              <SkelChip />
              <SkelChip className="w-24" />
            </div>
          </section>
          <SkelLine className="w-2/3" />
          <SkelLine className="w-1/2" />
        </div>
      ) : !request && notFound ? (
        <p className="text-body text-fg-muted">This request no longer exists.</p>
      ) : !request && error ? (
        <ErrorState title="Couldn't load this request." onRetry={() => void refetch()} />
      ) : request ? (
        <div className="space-y-6">
          {merged ? (
            <p className="rounded-xl bg-surface-muted px-3 py-2 text-label text-fg">
              Merged into another request; its votes moved there.{" "}
              {request.mergedIntoId ? (
                <button type="button" className="font-medium text-brand-text hover:underline" onClick={() => onOpen(request.mergedIntoId!)}>
                  Open it
                </button>
              ) : null}
            </p>
          ) : null}
          {request.hidden ? (
            <p className="rounded-xl border border-dashed border-tone-warning bg-tone-warning-soft px-3 py-2 text-label text-fg">
              Hidden: stores don't see this request on their board.
            </p>
          ) : null}

          <section className="space-y-3">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Fact label="Posted by">
                {request.storeId ? (
                  <Link to={`/stores/${request.storeId}/overview`} className="font-medium text-brand-text hover:underline">
                    {request.storeName || request.storeSlug || "A store"}
                  </Link>
                ) : (
                  "ZCommerce team"
                )}
                {request.createdByName ? <span className="block text-label text-fg-muted">{request.createdByName}</span> : null}
              </Fact>
              <Fact label="Posted">{formatDate(request.createdAt)}</Fact>
              <Fact label="Last activity">{formatDateTime(lastActivityOf(request))}</Fact>
              <Fact label="Comments">{formatCount(request.commentCount)}</Fact>
            </dl>
            <div>
              <SectionTitle>What problem would this solve?</SectionTitle>
              <p className="mt-1 whitespace-pre-wrap rounded-xl bg-surface-muted px-3 py-2 text-body text-fg">{request.problem}</p>
            </div>
          </section>

          <section className="space-y-2">
            <SectionTitle>Status</SectionTitle>
            <div className="rounded-xl border border-line bg-surface px-3 py-3">
              <p className="flex flex-wrap items-center gap-2 text-label text-fg-muted">
                <Chip tone={FEATURE_STATUS_TONE[request.status]}>{FEATURE_STATUS_LABEL[request.status]}</Chip>
                {request.statusChangedAt ? `since ${formatDate(request.statusChangedAt)}` : null}
              </p>
              {request.statusNote ? (
                <p className="mt-2 whitespace-pre-wrap text-body text-fg">{request.statusNote}</p>
              ) : (
                <p className="mt-2 text-label text-fg-muted">No note for the stores.</p>
              )}
              {releaseUrl ? (
                <a
                  href={releaseUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-2 inline-flex items-center gap-1.5 text-label text-brand-text hover:underline"
                >
                  <IconExternalLink aria-hidden className="size-4" />
                  Release note
                </a>
              ) : null}
              {canAct && !merged ? (
                <div className="mt-3">
                  <Button variant="secondary" size="sm" startIcon={<IconFlag aria-hidden className="size-4" />} onPress={() => setDialog("status")}>
                    Change status
                  </Button>
                </div>
              ) : null}
            </div>
          </section>

          <section className="space-y-2">
            <SectionTitle>Votes</SectionTitle>
            <VoteTotals request={request} />
            {request.votesByPlan.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-label">
                  <caption className="sr-only">Votes by plan</caption>
                  <thead className="text-caption text-fg-muted">
                    <tr>
                      <th scope="col" className="py-1 pr-3 font-normal">Plan</th>
                      <th scope="col" className="py-1 pr-3 font-normal">Up</th>
                      <th scope="col" className="py-1 font-normal">Down</th>
                    </tr>
                  </thead>
                  <tbody>
                    {request.votesByPlan.map((row) => (
                      <tr key={row.plan} className="border-t border-line-subtle">
                        <td className="py-1.5 pr-3 text-fg">{row.plan}</td>
                        <td className="py-1.5 pr-3 text-fg num">{formatCount(row.up)}</td>
                        <td className="py-1.5 text-fg num">{formatCount(row.down)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {request.votes.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left text-label">
                  <caption className="sr-only">Every store's vote</caption>
                  <thead className="text-caption text-fg-muted">
                    <tr>
                      <th scope="col" className="py-1 pr-3 font-normal">Store</th>
                      <th scope="col" className="py-1 pr-3 font-normal">Plan</th>
                      <th scope="col" className="py-1 pr-3 font-normal">Vote</th>
                      <th scope="col" className="py-1 pr-3 font-normal">Reason</th>
                      <th scope="col" className="py-1 font-normal">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {request.votes.map((vote) => (
                      <tr key={vote.storeId} className="border-t border-line-subtle align-top">
                        <td className="py-1.5 pr-3">
                          <Link to={`/stores/${vote.storeId}/overview`} className="text-brand-text hover:underline">
                            {vote.storeName}
                          </Link>
                        </td>
                        <td className="py-1.5 pr-3 text-fg">{vote.planName ?? "No plan"}</td>
                        <td className="py-1.5 pr-3">
                          <Chip tone={vote.vote === "UP" ? "success" : "danger"}>{vote.vote === "UP" ? "Up" : "Down"}</Chip>
                        </td>
                        <td className="py-1.5 pr-3 text-fg">{vote.reason ? vote.reason : <span className="text-fg-muted">—</span>}</td>
                        <td className="py-1.5 text-fg-muted">
                          {vote.votedByName ? <span className="block text-fg">{vote.votedByName}</span> : null}
                          {formatDateTime(vote.votedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-1 text-caption text-fg-muted">Down-vote reasons are only shown to ZCommerce, never to stores.</p>
              </div>
            ) : (
              <p className="text-label text-fg-muted">No store has voted yet.</p>
            )}
          </section>

          <section className="space-y-2">
            <SectionTitle>Comments</SectionTitle>
            {request.comments.length ? (
              <ol className="space-y-4" aria-label="Comments">
                {request.comments.map((comment) => (
                  <li key={comment.id} className={cx("flex gap-3", comment.hidden && "opacity-70")}>
                    <span
                      aria-hidden
                      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-caption-strong text-fg"
                    >
                      {comment.fromZerror ? "Z" : (comment.storeName || "S").slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 text-label text-fg-muted">
                        <span className="text-fg">{comment.authorName}</span>
                        {comment.fromZerror ? (
                          <Chip tone="info" dot={false}>
                            ZCommerce team
                          </Chip>
                        ) : comment.storeName ? (
                          <span>· {comment.storeName}</span>
                        ) : null}
                        {comment.pinned ? <Chip tone="neutral" dot={false}>Pinned</Chip> : null}
                        {comment.hidden ? <Chip tone="warning">Hidden from stores</Chip> : null}
                        <span>· {formatDateTime(comment.createdAt)}</span>
                      </p>
                      <p
                        className={cx(
                          "mt-1 whitespace-pre-wrap rounded-2xl px-3 py-2 text-body text-fg",
                          comment.hidden ? "border border-dashed border-line bg-surface" : comment.fromZerror ? "bg-brand-soft" : "bg-surface-muted",
                        )}
                      >
                        {comment.body}
                      </p>
                      {canAct ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {comment.fromZerror ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              isDisabled={busyComment === comment.id}
                              aria-label={comment.pinned ? `Unpin the reply by ${comment.authorName}` : `Pin the reply by ${comment.authorName}`}
                              onPress={() => void changeComment(comment, { pinned: !comment.pinned })}
                            >
                              {comment.pinned ? "Unpin" : "Pin"}
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="sm"
                            isDisabled={busyComment === comment.id}
                            aria-label={comment.hidden ? `Show the comment by ${comment.authorName} to stores` : `Hide the comment by ${comment.authorName} from stores`}
                            onPress={() => void changeComment(comment, { hidden: !comment.hidden })}
                          >
                            {comment.hidden ? "Unhide" : "Hide"}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-label text-fg-muted">No comments yet.</p>
            )}
          </section>
        </div>
      ) : null}

      {request && canAct ? (
        <>
          <FeatureStatusDialog request={request} isOpen={dialog === "status"} onClose={() => setDialog(null)} refetchQueries={REFETCH} />
          <FeatureEditDialog request={request} isOpen={dialog === "edit"} onClose={() => setDialog(null)} refetchQueries={REFETCH} />
          <FeatureMergeDialog
            request={request}
            isOpen={dialog === "merge"}
            onClose={() => setDialog(null)}
            refetchQueries={REFETCH}
            onMerged={(targetId) => {
              setDialog(null);
              onOpen(targetId);
            }}
          />
          <ConfirmDialog
            isOpen={dialog === "hide"}
            onClose={() => setDialog(null)}
            onConfirm={() => void toggleHidden()}
            title={`Hide ${request.ref} from stores?`}
            description="It leaves every store's board. Votes and comments are kept, and you can show it again."
            confirmLabel="Hide request"
            isLoading={hiding}
            icon={<IconHide aria-hidden />}
          />
        </>
      ) : null}
    </Drawer>
  );
}
