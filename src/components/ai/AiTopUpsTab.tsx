import { useMutation } from "@apollo/client";
import { addToast, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { DISMISS_AI_TOP_UP_REQUEST } from "../../graphql/ai";
import { useAiTopUpRequests } from "../../hooks/use-platform-ai";
import { mutationFailureCopy } from "../../lib/mutation-errors";
import { TOP_UP_STATUS_OPTIONS, topUpEmptyCopy, topUpStatusOf } from "../../lib/platform-ai.util";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { useAuth } from "../../providers/AuthProvider";
import type { PlatformAiTopUpRequest, PlatformAiTopUpRequestStatus } from "../../types/platform-api";
import { toasts } from "../../copy";
import { ConfirmModal } from "../common/ConfirmModal";
import { dataTableClassNames } from "../common/dataTableStyles";
import { PageHeader } from "../common/PageHeader";
import { IconGift } from "../ui/icons";
import {
  Button as UiButton,
  Card,
  EmptyState,
  ErrorState,
  Select,
  SelectItem,
  Skeleton,
  formatCount,
  formatDate,
  formatDateTime,
  tableRowClasses,
  toastError,
} from "../ui";
import { GrantTopUpDialog } from "./GrantTopUpDialog";

const PAGE_SIZE = 25;

/**
 * AI › Top-up requests (PRD-021 FR-6.4): stores that ran out of questions
 * and asked for more (one request per store per week). Grant adds questions
 * until the end of the store's month and closes its open requests; Dismiss
 * closes one without granting. Both need `platform:ai:manage`.
 */
export function AiTopUpsTab() {
  const { can } = useAuth();
  const canManage = can(PLATFORM_PERMISSIONS.AI_MANAGE);
  const [page, setPage] = useState(0);
  // PRD-024 FR-1.10 (B-11): open, granted or dismissed requests.
  const [status, setStatus] = useState<PlatformAiTopUpRequestStatus>("OPEN");
  const [granting, setGranting] = useState<{ tenantId: string; name: string } | null>(null);
  const [dismissing, setDismissing] = useState<PlatformAiTopUpRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [dismiss] = useMutation(DISMISS_AI_TOP_UP_REQUEST);

  const api = useAiTopUpRequests({ status, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
  const isOpen = status === "OPEN";
  const rows = api.data?.items ?? [];
  const total = api.data?.totalCount ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const runDismiss = async () => {
    if (!dismissing || busy) return;
    setBusy(true);
    try {
      const response = await dismiss({ variables: { requestId: dismissing.id } });
      await api.refetch().catch(() => undefined);
      addToast({
        title: response.data?.dismissAiTopUpRequest
          ? `Request from ${dismissing.storeName} dismissed.`
          : `The request from ${dismissing.storeName} was already handled.`,
      });
      setDismissing(null);
    } catch (error) {
      const message = mutationFailureCopy(error);
      if (message) toastError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="AI top-up requests"
        count={total || undefined}
        description="Stores that used up this week's AI questions and asked for more."
        actions={
          <Select
            aria-label="Request status"
            size="sm"
            className="w-40"
            selectedKeys={new Set([status])}
            disallowEmptySelection
            onSelectionChange={(keys) => {
              setStatus(topUpStatusOf(Array.from(keys)[0]));
              setPage(0);
            }}
            items={TOP_UP_STATUS_OPTIONS}
          >
            {(option) => <SelectItem key={option.key}>{option.label}</SelectItem>}
          </Select>
        }
      />

      {api.error ? (
        <ErrorState title="Couldn't load the top-up requests." description={toasts.genericError} onRetry={() => void api.refetch()} />
      ) : null}

      <Card padding="none" className="overflow-hidden">
        {api.loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <Table aria-label="AI top-up requests" removeWrapper classNames={{ ...dataTableClassNames, tr: tableRowClasses }}>
            <TableHeader>
              <TableColumn>Store</TableColumn>
              <TableColumn>Week of</TableColumn>
              <TableColumn>Requested</TableColumn>
              <TableColumn align="end">{isOpen ? "Actions" : "Handled"}</TableColumn>
            </TableHeader>
            <TableBody
              items={rows}
              emptyContent={
                <EmptyState icon={IconGift} title={topUpEmptyCopy(status)} description="Requests from stores appear here." />
              }
            >
              {(row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link to={`/stores/${row.tenantId}`} className="font-medium text-fg hover:underline">
                      {row.storeName}
                    </Link>
                  </TableCell>
                  <TableCell><span className="whitespace-nowrap num">{formatDate(row.week)}</span></TableCell>
                  <TableCell><span className="whitespace-nowrap num">{formatDateTime(row.createdAt)}</span></TableCell>
                  <TableCell>
                    {!isOpen ? (
                      <span className="block whitespace-nowrap text-right text-caption text-fg-muted num">
                        {row.handledAt ? formatDateTime(row.handledAt) : "—"}
                      </span>
                    ) : canManage ? (
                      <div className="flex justify-end gap-2">
                        <UiButton size="sm" variant="ghost" onPress={() => setDismissing(row)}>
                          Dismiss
                        </UiButton>
                        <UiButton
                          size="sm"
                          variant="secondary"
                          onPress={() => setGranting({ tenantId: row.tenantId, name: row.storeName })}
                        >
                          Grant
                        </UiButton>
                      </div>
                    ) : (
                      <span className="block text-right text-caption text-fg-subtle">View only</span>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
        {pages > 1 ? (
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-caption text-fg-muted">
            <span>Page {page + 1} of {pages} · {formatCount(total)} requests</span>
            <div className="flex gap-2">
              <UiButton variant="ghost" size="sm" isDisabled={page === 0} onPress={() => setPage((value) => value - 1)}>Previous</UiButton>
              <UiButton variant="ghost" size="sm" isDisabled={page + 1 >= pages} onPress={() => setPage((value) => value + 1)}>Next</UiButton>
            </div>
          </div>
        ) : null}
      </Card>

      <GrantTopUpDialog store={granting} onClose={() => setGranting(null)} onGranted={api.refetch} />

      <ConfirmModal
        isOpen={!!dismissing}
        onClose={() => setDismissing(null)}
        onConfirm={() => void runDismiss()}
        title="Dismiss this request?"
        description={`${dismissing?.storeName ?? "The store"} gets no extra questions. Its weekly limit resets on Monday as usual.`}
        confirmLabel="Dismiss request"
        confirmColor="primary"
        isLoading={busy}
      />
    </div>
  );
}
