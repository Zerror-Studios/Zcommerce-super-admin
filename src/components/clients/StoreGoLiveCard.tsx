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
import { IconError, IconInfo, IconSuccess, IconWarning } from "../ui/icons";
import {
  Button as UiButton,
  Card,
  Checkbox,
  Chip,
  CopyableId,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Skeleton,
  Textarea,
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

  return (
    <div className="flex flex-col gap-4">
      <Card title="Domain">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={statusView.tone}>{statusView.label}</Chip>
            {client.domain ? <span className="font-mono text-body text-fg">{client.domain}</span> : null}
            {client.liveAt ? (
              <span className="text-caption text-fg-muted">Live since {formatDate(client.liveAt)}</span>
            ) : null}
          </div>
          {status === "NONE" && client.domain ? (
            <p className="text-caption text-fg-muted">
              This domain was set before verification existed. Verify it to keep it after the domain migration.
            </p>
          ) : null}

          {pendingDomain ? (
            <section aria-label="Domain being verified" className="rounded-card border border-line p-3">
              <p className="text-body text-fg">
                Verifying <span className="font-mono">{pendingDomain}</span>
                {client.domain ? ". The store keeps serving its current domain until this one verifies." : "."}
              </p>
              {claim && claim.status !== "VERIFIED" ? (
                <dl className="mt-2 flex flex-col gap-1 text-body">
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-fg-muted">Record type</dt>
                    <dd className="font-mono text-fg">TXT</dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-fg-muted">Name</dt>
                    <dd className="min-w-0 break-all">
                      <CopyableId value={claim.recordName} />
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-fg-muted">Value</dt>
                    <dd className="min-w-0 break-all">
                      <CopyableId value={claim.recordValue} />
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-1 text-caption text-fg-muted">
                  Start the verification again below to see the TXT record to publish.
                </p>
              )}
              {checkError ? (
                <p role="alert" className="mt-2 text-body text-tone-danger-text">
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
                className="sm:max-w-sm"
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
        actions={
          <UiButton
            variant="ghost"
            size="sm"
            isDisabled={checklist.loading}
            onPress={() => void checklist.refetch()}
          >
            Run again
          </UiButton>
        }
      >
        {checklist.loading && checks.length === 0 ? (
          <div className="space-y-2" role="status" aria-label="Running the checks">
            <Skeleton className="h-5 w-full rounded" />
            <Skeleton className="h-5 w-5/6 rounded" />
            <Skeleton className="h-5 w-2/3 rounded" />
          </div>
        ) : checklist.error && checks.length === 0 ? (
          <div role="alert" className="flex items-center justify-between gap-2">
            <p className="text-body text-tone-danger-text">Couldn't run the go-live checks.</p>
            <UiButton variant="secondary" size="sm" onPress={() => void checklist.refetch()}>
              Retry
            </UiButton>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <ChecklistRows checks={checks} />
            {canManage ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-caption text-fg-muted">
                  {status === "LIVE"
                    ? "This store is live."
                    : status === "VERIFIED"
                      ? "Every required check must pass; the payment app and legal pages can be waived with a reason."
                      : "Verify the domain before going live."}
                </p>
                <UiButton
                  variant="primary"
                  isDisabled={status !== "VERIFIED" || checks.length === 0}
                  onPress={() => setLiveOpen(true)}
                >
                  Mark live
                </UiButton>
              </div>
            ) : null}
          </div>
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

function ChecklistRows({ checks }: { checks: readonly GoLiveCheck[] }) {
  if (checks.length === 0) return <p className="text-body text-fg-muted">No checks returned.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {checks.map((check) => {
        const Icon = STATE_ICON[check.state];
        const view = GO_LIVE_STATE_VIEW[check.state];
        return (
          <li key={check.key} className="flex items-start gap-2">
            <Icon aria-hidden className={cx("mt-0.5 size-4 shrink-0", STATE_ICON_CLASS[check.state])} />
            <div className="min-w-0 flex-1">
              <p className="text-body text-fg">
                {check.label}
                {!check.required ? <span className="text-fg-subtle"> (optional)</span> : null}
              </p>
              {check.detail ? <p className="text-caption text-fg-muted">{check.detail}</p> : null}
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
          <UiButton variant="ghost" onPress={close} isDisabled={loading}>
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
