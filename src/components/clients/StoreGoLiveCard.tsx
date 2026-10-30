/**
 * Store detail › Go live (PRD-018 FR-4, §6 console)
 *
 * Domain status, the domain being verified, and the DNS TXT record to
 * publish (`startDomainVerification`), with "Check now"
 * (`checkDomainVerification`) and its last error. The server's go-live
 * checklist (`tenantGoLiveChecklist`, nine checks probed live) with pass /
 * fail / unknown / waived, and "Mark live" (`markTenantLive`) with the
 * waivable checks (payment app, legal pages) and a reason. A serving
 * domain keeps serving until a new one verifies (FR-4.4); this card is the
 * only way the console changes a store's domain.
 */

import { useMutation, useQuery } from "@apollo/client";
import { addToast } from "@heroui/react";
import { useState } from "react";
import {
  CHECK_DOMAIN_VERIFICATION,
  MARK_TENANT_LIVE,
  PLATFORM_TENANT,
  START_DOMAIN_VERIFICATION,
  TENANT_GO_LIVE_CHECKLIST,
} from "../../graphql/tenants";
import { errorReasonOf } from "../../lib/apollo-client";
import { isUserInputError } from "../../lib/mutation-errors";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import {
  DOMAIN_STATUS_VIEW,
  GO_LIVE_STATE_VIEW,
  blockingChecks,
  failingChecksFromError,
  isWaivable,
  lifecycleFailureCopy,
  markLiveVariables,
  normaliseDomain,
} from "../../lib/tenant-lifecycle.util";
import { formatDate } from "../../lib/utils";
import { useAuth } from "../../providers/AuthProvider";
import type { Client } from "../../types";
import type { GoLiveCheck, TenantDomainVerification } from "../../types/platform-api";
import { IconError, IconInfo, IconRefresh, IconSuccess, IconWarning } from "../ui/icons";
import { KeyValue, KeyValueGrid } from "./StoreDetailParts";
import {
  Button as UiButton,
  Card,
  Checkbox,
  Chip,
  CopyableId,
  ErrorState,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Skeleton,
  Textarea,
  Tooltip,
  cx,
  toastError,
} from "../ui";

export interface StoreGoLiveCardProps {
  client: Client;
}

const STATE_ICON = {
  PASS: IconSuccess,
  FAIL: IconError,
  UNKNOWN: IconWarning,
  WAIVED: IconInfo,
} as const;

const STATE_ICON_CLASS = {
  PASS: "text-tone-success",
  FAIL: "text-tone-danger-text",
  UNKNOWN: "text-tone-warning",
  WAIVED: "text-fg-subtle",
} as const;

export function StoreGoLiveCard({ client }: StoreGoLiveCardProps) {
  const { can } = useAuth();
  const canManage = can(PLATFORM_PERMISSIONS.TENANTS_MANAGE);
  const status = client.domainStatus ?? "NONE";
  const statusView = DOMAIN_STATUS_VIEW[status];
  const [domainInput, setDomainInput] = useState("");
  const [domainError, setDomainError] = useState<string | null>(null);
  // The record to publish: from start or the latest check this session
  const [claim, setClaim] = useState<TenantDomainVerification | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [liveOpen, setLiveOpen] = useState(false);
  // The answer is the claim, not the store: re-read the store so its
  // domain status (here and in the list) follows
  const rereadStore = [{ query: PLATFORM_TENANT, variables: { id: client.id } }];
  const [startDomain, startState] = useMutation<{ startDomainVerification: TenantDomainVerification }>(
    START_DOMAIN_VERIFICATION,
    { refetchQueries: rereadStore },
  );
  const [checkDomain, checkState] = useMutation<{ checkDomainVerification: TenantDomainVerification }>(
    CHECK_DOMAIN_VERIFICATION,
    { refetchQueries: rereadStore },
  );
  const checklist = useQuery<{ tenantGoLiveChecklist: GoLiveCheck[] }>(TENANT_GO_LIVE_CHECKLIST, {
    variables: { tenantId: client.id },
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });
  const checks = checklist.data?.tenantGoLiveChecklist ?? [];
  const pendingDomain = claim?.status !== "VERIFIED" ? (claim?.domain ?? client.pendingDomain) : undefined;

  const start = async () => {
    const domain = normaliseDomain(domainInput);
    if (!domain) {
      setDomainError("Enter a domain like shop.example.com, without https:// or a path.");
      return;
    }
    setDomainError(null);
    try {
      const { data } = await startDomain({ variables: { tenantId: client.id, domain } });
      if (data) setClaim(data.startDomainVerification);
      setCheckError(null);
      setDomainInput("");
    } catch (error) {
      const message = lifecycleFailureCopy(error);
      if (message && (isUserInputError(error) || errorReasonOf(error))) setDomainError(message);
      else if (message) toastError(message);
    }
  };

  const check = async () => {
    setCheckError(null);
    try {
      const { data } = await checkDomain({ variables: { tenantId: client.id } });
      const result = data?.checkDomainVerification;
      if (!result) return;
      setClaim(result);
      if (result.status === "VERIFIED") {
        addToast({ title: `${result.domain} verified.`, description: "The store now answers on this domain." });
        void checklist.refetch();
      } else {
        setCheckError(result.lastError ?? "The TXT record wasn't found yet. DNS changes can take a while.");
      }
    } catch (error) {
      const message = lifecycleFailureCopy(error);
      if (message && errorReasonOf(error)) setCheckError(message);
      else if (message) toastError(message);
    }
  };

  // Every required check passes, counting the ones the Mark live pop-up may waive with a reason (PRD-018 FR-4).
  const stillFailing = blockingChecks(
    checks,
    checks.filter((item) => isWaivable(item.key)).map((item) => item.key),
  );
  const canMarkLive = status === "VERIFIED" && checks.length > 0 && stillFailing.length === 0;
  const markLiveBlockedReason =
    status === "LIVE"
      ? "This store is already live"
      : status !== "VERIFIED"
        ? "Verify the domain first"
        : "Every check must pass first";

  return (
    <div className="flex flex-col gap-4">
      <Card title="Domain" actions={<Chip tone={statusView.tone}>{statusView.label}</Chip>}>
        <div className="flex flex-col gap-4">
          {client.domain || client.liveAt ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {client.domain ? <span className="text-body font-medium text-fg">{client.domain}</span> : null}
              {client.liveAt ? (
                <span className="text-label text-fg-muted">Live since {formatDate(client.liveAt)}</span>
              ) : null}
            </div>
          ) : null}
          {status === "NONE" && client.domain ? (
            <p className="text-label text-fg-muted">
              This domain was set before verification existed. Verify it to keep it after the domain migration.
            </p>
          ) : null}

          {pendingDomain ? (
            <section aria-label="Domain being verified" className="rounded-tile border border-line px-4 py-3">
              <p className="text-body text-fg">
                Verifying <span className="font-medium">{pendingDomain}</span>
                {client.domain ? ". The store keeps serving its current domain until this one verifies." : "."}
              </p>
              {claim && claim.status !== "VERIFIED" ? (
                <KeyValueGrid columns={3} className="mt-3">
                  <KeyValue label="Record type">
                    <span className="font-mono">TXT</span>
                  </KeyValue>
                  <KeyValue label="Name">
                    <CopyableId value={claim.recordName} />
                  </KeyValue>
                  <KeyValue label="Value">
                    <CopyableId value={claim.recordValue} />
                  </KeyValue>
                </KeyValueGrid>
              ) : (
                <p className="mt-1 text-label text-fg-muted">
                  Start the verification again below to see the TXT record to publish.
                </p>
              )}
              {checkError ? (
                <p role="alert" className="mt-2 text-label text-tone-danger-text">
                  {checkError}
                </p>
              ) : null}
              {canManage ? (
                <UiButton
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  isLoading={checkState.loading}
                  onPress={() => void check()}
                >
                  Check now
                </UiButton>
              ) : null}
            </section>
          ) : null}

          {canManage ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <Input
                label={client.domain || pendingDomain ? "Verify a new domain" : "Store domain"}
                placeholder="shop.example.com"
                value={domainInput}
                onValueChange={(value) => {
                  setDomainInput(value);
                  setDomainError(null);
                }}
                isInvalid={!!domainError}
                errorMessage={domainError ?? undefined}
                autoComplete="off"
                className="sm:w-90"
              />
              <UiButton
                variant="primary"
                className="sm:mt-6"
                isLoading={startState.loading}
                isDisabled={!domainInput.trim()}
                onPress={() => void start()}
              >
                Start verification
              </UiButton>
            </div>
          ) : null}
        </div>
      </Card>

      <Card
        title="Go-live checklist"
        padding="none"
        className="overflow-clip"
        actions={
          <UiButton
            variant="secondary"
            size="sm"
            startIcon={<IconRefresh aria-hidden />}
            isLoading={checklist.loading && checks.length > 0}
            onPress={() => void checklist.refetch()}
          >
            Run again
          </UiButton>
        }
      >
        {checklist.loading && checks.length === 0 ? (
          <div className="flex flex-col gap-3 px-5 pb-5" role="status" aria-label="Running the checks">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-8 w-full rounded-lg" />
            ))}
          </div>
        ) : checklist.error && checks.length === 0 ? (
          <div className="px-5 pb-5">
            <ErrorState inline title="Couldn't run the go-live checks." onRetry={() => void checklist.refetch()} />
          </div>
        ) : (
          <>
            <ChecklistRows checks={checks} />
            {canManage ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle bg-card-footer px-5 py-3">
                <p className="text-label text-fg-muted">
                  {status === "LIVE"
                    ? "This store is live."
                    : status === "VERIFIED"
                      ? "Every required check must pass; the payment app and legal pages can be waived with a reason."
                      : "Verify the domain before going live."}
                </p>
                {canMarkLive ? (
                  <UiButton variant="primary" onPress={() => setLiveOpen(true)}>
                    Mark live
                  </UiButton>
                ) : (
                  <Tooltip content={markLiveBlockedReason}>
                    {/* A disabled button gets no pointer events; the wrapper carries the tooltip. */}
                    <span tabIndex={0} className="inline-flex rounded-full">
                      <UiButton variant="primary" isDisabled>
                        Mark live
                      </UiButton>
                    </span>
                  </Tooltip>
                )}
              </div>
            ) : null}
          </>
        )}
      </Card>

      <MarkLiveDialog
        isOpen={liveOpen}
        onClose={() => setLiveOpen(false)}
        client={client}
        checks={checks}
        onRecheck={() => checklist.refetch()}
      />
    </div>
  );
}

/** 56px rows: 20px status icon, the check and its reason, the badge on the right; dividers inset 20px. */
function ChecklistRows({ checks }: { checks: readonly GoLiveCheck[] }) {
  if (checks.length === 0) return <p className="px-5 pb-5 text-body text-fg-muted">No checks returned.</p>;
  return (
    <ul className="mx-5 divide-y divide-line-subtle border-t border-line-subtle">
      {checks.map((check) => {
        const Icon = STATE_ICON[check.state];
        const view = GO_LIVE_STATE_VIEW[check.state];
        return (
          <li key={check.key} className="flex min-h-14 items-center gap-3 py-2">
            <Icon aria-hidden className={cx("size-5 shrink-0", STATE_ICON_CLASS[check.state])} />
            <div className="min-w-0 flex-1">
              <p className="text-body font-medium text-fg">
                {check.label}
                {!check.required ? <span className="font-normal text-fg-subtle"> (optional)</span> : null}
              </p>
              {check.detail ? <p className="text-label text-fg-muted">{check.detail}</p> : null}
            </div>
            <Chip tone={view.tone}>{view.label}</Chip>
          </li>
        );
      })}
    </ul>
  );
}

interface MarkLiveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
  checks: readonly GoLiveCheck[];
  onRecheck: () => Promise<unknown>;
}

function MarkLiveDialog({ isOpen, onClose, client, checks, onRecheck }: MarkLiveDialogProps) {
  const [waived, setWaived] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [failing, setFailing] = useState<string[]>([]);
  const [markLive, { loading }] = useMutation(MARK_TENANT_LIVE);
  const waivable = checks.filter((check) => isWaivable(check.key) && check.state !== "PASS");
  const blocking = blockingChecks(checks, waived);

  const close = () => {
    if (loading) return;
    setWaived([]);
    setReason("");
    setError(null);
    setFailing([]);
    onClose();
  };

  const run = async () => {
    const result = markLiveVariables(client.id, waived, reason);
    if (!result.variables) {
      setError(result.error);
      return;
    }
    setError(null);
    try {
      await markLive({ variables: result.variables });
      addToast({ title: `${client.storeName} is live.` });
      close();
    } catch (err) {
      setFailing(failingChecksFromError(err));
      const message = lifecycleFailureCopy(err);
      if (message && (isUserInputError(err) || errorReasonOf(err))) setError(message);
      else if (message) toastError(message);
      void onRecheck();
    }
  };

  const labelOf = (key: string) => checks.find((check) => check.key === key)?.label ?? key;

  return (
    <Modal isOpen={isOpen} onClose={close} width="md">
      <ModalContent>
        <ModalHeader>Mark {client.storeName} live</ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-3">
            <p className="text-body text-fg-muted">
              The server runs the checklist again before it marks the store live.
            </p>
            {waivable.length > 0 ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-label text-fg-muted">Waive (not passing today)</legend>
                {waivable.map((check) => (
                  <Checkbox
                    key={check.key}
                    isSelected={waived.includes(check.key)}
                    onValueChange={(selected) =>
                      setWaived((current) =>
                        selected ? [...current, check.key] : current.filter((key) => key !== check.key),
                      )
                    }
                  >
                    {check.label}
                  </Checkbox>
                ))}
              </fieldset>
            ) : null}
            {waived.length > 0 ? (
              <Textarea
                label="Reason for the waivers"
                isRequired
                description="Required. Your name and the reason go to the audit log."
                value={reason}
                onValueChange={setReason}
              />
            ) : null}
            {blocking.length > 0 ? (
              <p role="note" className="text-body text-tone-danger-text">
                Still failing: {blocking.map((check) => check.label).join(", ")}.
              </p>
            ) : null}
            {failing.length > 0 ? (
              <p role="alert" className="text-body text-tone-danger-text">
                The server refused: {failing.map(labelOf).join(", ")}.
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="text-body text-tone-danger-text">
                {error}
              </p>
            ) : null}
          </div>
        </ModalBody>
        <ModalFooter>
          <UiButton variant="secondary" onPress={close} isDisabled={loading}>
            Cancel
          </UiButton>
          <UiButton
            variant="primary"
            isLoading={loading}
            isDisabled={loading || blocking.length > 0 || (waived.length > 0 && !reason.trim())}
            onPress={() => void run()}
          >
            Mark live
          </UiButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
