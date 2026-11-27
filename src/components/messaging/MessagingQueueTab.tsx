/**
 * Console › Messaging › Work queue (backend PRD-050 FR-1.10): the MSG91
 * steps ZCOM can't do by API yet. Status tabs and a type filter (server
 * side), the open and overdue counts, and one card per task with the store,
 * the values to copy, the SLA chip, the per-type completion form, "Done" and
 * "Rejected, with reason". A CONNECT_CHILD task opens the connect form.
 * Reads need platform:messaging:read; every action platform:messaging:manage.
 */
import { useQuery } from "@apollo/client";
import { useState } from "react";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Select,
  SelectItem,
  Skeleton,
  TablePagination,
  TableToolbar,
  formatCount,
  formatDateTime,
} from "../ui";
import { IconMessages } from "../ui/icons";
import { PLATFORM_MESSAGING_ACCOUNT, PLATFORM_MESSAGING_TASKS } from "../../graphql/messaging";
import {
  TASK_STATUS_LABEL,
  TASK_STATUS_TABS,
  TASK_STATUS_TONE,
  TASK_TYPE_HINT,
  TASK_TYPE_LABEL,
  isTaskType,
  messagingTaskStatusEnum,
  messagingTaskTypeEnum,
  taskQueueVariables,
  taskSlaChip,
  taskSourceLabel,
  type MessagingAccount,
  type MessagingTask,
  type MessagingTaskType,
  type TaskStatusTab,
} from "../../lib/platform-messaging.util";
import { CompleteTaskDialog, ConnectAccountDialog, CopyValue, RejectTaskDialog } from "./MessagingDialogs";

const PAGE_SIZE = 20;
const ALL_TYPES = "ALL";

/** Refetched after every task action (the connect step also changes accounts). */
export const MESSAGING_REFETCH = ["PlatformMessagingTasks", "PlatformMessagingAccounts", "PlatformMessagingAccount"];

type TasksData = {
  platformMessagingTasks: { items: MessagingTask[]; totalCount: number; openCount: number; overdueCount: number };
};

type Dialog = { kind: "complete" | "reject" | "connect"; task: MessagingTask } | null;

export function MessagingQueueTab({ canManage }: { canManage: boolean }) {
  const [status, setStatus] = useState<TaskStatusTab>(messagingTaskStatusEnum.OPEN);
  const [type, setType] = useState<MessagingTaskType | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [dialog, setDialog] = useState<Dialog>(null);

  const { data, loading, error, refetch } = useQuery<TasksData>(PLATFORM_MESSAGING_TASKS, {
    variables: taskQueueVariables(status, type, pageSize, (page - 1) * pageSize),
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });
  const list = data?.platformMessagingTasks;
  const tasks = list?.items ?? [];
  const now = new Date();

  const filtered = status !== messagingTaskStatusEnum.OPEN || type !== null;

  return (
    <div className="space-y-4">
      <p className="text-body text-fg-muted" aria-live="polite">
        {list
          ? `${formatCount(list.openCount)} open · ${formatCount(list.overdueCount)} overdue`
          : loading
            ? "Loading the queue…"
            : null}
      </p>
      <TableToolbar<TaskStatusTab>
        tabs={TASK_STATUS_TABS.map((tab) => ({
          value: tab.value,
          label: tab.label,
          count: tab.value === messagingTaskStatusEnum.OPEN ? (list?.openCount ?? null) : null,
        }))}
        tab={status}
        onTabChange={(next) => {
          setStatus(next);
          setPage(1);
        }}
        tabsLabel="Task status"
      >
        <Select
          aria-label="Task type"
          className="w-full sm:w-60"
          size="sm"
          selectedKeys={new Set([type ?? ALL_TYPES])}
          disallowEmptySelection
          onSelectionChange={(keys) => {
            const value = String(Array.from(keys)[0] ?? ALL_TYPES);
            setType(isTaskType(value) ? value : null);
            setPage(1);
          }}
        >
          {[
            <SelectItem key={ALL_TYPES}>All task types</SelectItem>,
            ...Object.values(messagingTaskTypeEnum).map((value) => <SelectItem key={value}>{TASK_TYPE_LABEL[value]}</SelectItem>),
          ]}
        </Select>
      </TableToolbar>

      {error && !list ? (
        <ErrorState title="Couldn't load the work queue." onRetry={() => void refetch()} />
      ) : loading && !list ? (
        <div className="space-y-3" role="status" aria-label="Loading tasks">
          {[0, 1, 2].map((key) => (
            <Card key={key}>
              <Skeleton className="h-5 w-1/3 rounded-lg" />
              <Skeleton className="mt-3 h-4 w-2/3 rounded-lg" />
            </Card>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <Card>
          <EmptyState
            icon={IconMessages}
            title={filtered ? "No tasks match" : "Nothing waiting on ops"}
            description={
              filtered
                ? "Change the status or the task type."
                : "MSG91 steps a store or the console asks for show here, with every value to copy."
            }
          />
        </Card>
      ) : (
        <ul className="space-y-3" aria-label="Messaging tasks">
          {tasks.map((task) => (
            <li key={task.id}>
              <TaskCard task={task} now={now} canManage={canManage} onAction={(kind) => setDialog({ kind, task })} />
            </li>
          ))}
        </ul>
      )}

      {list && (tasks.length > 0 || page > 1) ? (
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={list.totalCount}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          isDisabled={loading}
        />
      ) : null}

      {dialog?.kind === "complete" ? (
        <CompleteTaskDialog task={dialog.task} isOpen onClose={() => setDialog(null)} refetchQueries={MESSAGING_REFETCH} />
      ) : null}
      {dialog?.kind === "reject" ? (
        <RejectTaskDialog task={dialog.task} isOpen onClose={() => setDialog(null)} refetchQueries={MESSAGING_REFETCH} />
      ) : null}
      {dialog?.kind === "connect" ? <TaskConnectDialog task={dialog.task} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}

// ─── Task card ────────────────────────────────────────────────────────────

function TaskCard({
  task,
  now,
  canManage,
  onAction,
}: {
  task: MessagingTask;
  now: Date;
  canManage: boolean;
  onAction: (kind: "complete" | "reject" | "connect") => void;
}) {
  const sla = taskSlaChip(task, now);
  const open = task.status === messagingTaskStatusEnum.OPEN;
  const store = task.storeName || task.slug || "A store";

  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-body font-medium text-fg">
              {TASK_TYPE_LABEL[task.type]} · {store}
            </p>
            <p className="text-label text-fg-muted">
              {task.subject ? <span className="font-mono">{task.subject}</span> : null}
              {task.subject ? " · " : ""}
              {taskSourceLabel(task.source)}
              {task.createdAt ? ` · opened ${formatDateTime(task.createdAt)}` : ""}
              {task.reopenedCount > 0 ? ` · reopened ${formatCount(task.reopenedCount)}×` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {sla ? <Chip tone={sla.tone}>{sla.label}</Chip> : null}
            <Chip tone={TASK_STATUS_TONE[task.status]}>{TASK_STATUS_LABEL[task.status]}</Chip>
          </div>
        </div>

        {open ? <p className="text-label text-fg-muted">{TASK_TYPE_HINT[task.type]}</p> : null}

        {task.values.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 rounded-xl bg-surface-muted p-3 sm:grid-cols-2">
            {task.values.map((item, index) => (
              <CopyValue key={`${item.label}-${index}`} label={item.label} value={item.value} />
            ))}
          </div>
        ) : null}

        {task.status === messagingTaskStatusEnum.REJECTED && task.rejectReason ? (
          <p className="text-label text-fg">Rejected: {task.rejectReason}</p>
        ) : null}
        {task.status === messagingTaskStatusEnum.DONE ? (
          <p className="text-label text-fg-muted">
            Done{task.completedAt ? ` ${formatDateTime(task.completedAt)}` : ""}
            {task.note ? ` · ${task.note}` : ""}
          </p>
        ) : null}

        {open && canManage ? (
          <div className="flex flex-wrap gap-2">
            {task.type === messagingTaskTypeEnum.CONNECT_CHILD ? (
              <Button variant="primary" size="sm" onPress={() => onAction("connect")}>
                Connect account
              </Button>
            ) : null}
            <Button
              variant={task.type === messagingTaskTypeEnum.CONNECT_CHILD ? "secondary" : "primary"}
              size="sm"
              onPress={() => onAction("complete")}
            >
              Done
            </Button>
            <Button variant="ghost" size="sm" onPress={() => onAction("reject")}>
              Reject
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

// ─── Connect from a task ──────────────────────────────────────────────────

/** Reads the store's account first, so the form starts from what is saved. */
function TaskConnectDialog({ task, onClose }: { task: MessagingTask; onClose: () => void }) {
  const { data, loading } = useQuery<{ platformMessagingAccount: MessagingAccount | null }>(PLATFORM_MESSAGING_ACCOUNT, {
    variables: { tenantId: task.tenantId },
    fetchPolicy: "network-only",
  });
  if (loading && !data) return null;
  const account = data?.platformMessagingAccount ?? null;
  return (
    <ConnectAccountDialog
      isOpen
      onClose={onClose}
      account={account}
      store={{ id: task.tenantId, name: task.storeName || task.slug }}
      stores={[]}
      refetchQueries={MESSAGING_REFETCH}
    />
  );
}
