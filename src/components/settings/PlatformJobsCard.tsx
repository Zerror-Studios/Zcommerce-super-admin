/**
 * Settings › Payments & billing rules › Billing jobs (04 S-07f, PRD-014 PLT-13, PRD-024 FR-3.10)
 *
 * The nightly jobs run on the server's schedule; an owner can run one now (`runPlatformJob`,
 * `runUsageSnapshotJob`, settings:manage). Each asks first, then shows the server's summary. "Recent runs"
 * (`platformJobRuns`) is collapsed by default: the last 10 runs, and "Show all" in a drawer. One row per job
 * and day; a Run now replaces that day's row.
 */

import { useMutation } from "@apollo/client";
import { addToast } from "@heroui/react";
import { useState } from "react";

import { RUN_PLATFORM_JOB, RUN_USAGE_SNAPSHOT_JOB } from "../../graphql/billing";
import { useJobRuns } from "../../hooks/use-platform-reports";
import { mutationFailureCopy } from "../../lib/mutation-errors";
import { formatDurationMs, jobRunLabel, jobRunStatusView } from "../../lib/platform-history.util";
import type { PlatformJobRun } from "../../types/platform-api";
import { ConfirmModal } from "../common/ConfirmModal";
import {
  Button,
  Card,
  Chip,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  ErrorState,
  Skeleton,
  Tooltip,
  formatDateTime,
  toastError,
} from "../ui";
import { IconCaret, IconExpand, IconPlay } from "../ui/icons";

type PlatformJob = "billing_cycle" | "reminders" | "usage_snapshot";

const JOBS: { key: PlatformJob; label: string; description: string }[] = [
  {
    key: "billing_cycle",
    label: "Billing cycle",
    description: "Renews subscriptions whose period ended and issues their invoices, ends expired trials and cancellations, and marks unpaid invoices past their grace period overdue.",
  },
  { key: "reminders", label: "Renewal reminders", description: "Sends the reminders due today on the schedule above." },
  { key: "usage_snapshot", label: "Usage snapshot", description: "Records today's usage (products, orders, storage, staff) for every store." },
];

const RECENT_RUNS = 10;
/** The server's page cap (`JOB_RUNS_MAX`). */
const ALL_RUNS = 100;

function RunList({ runs }: { runs: PlatformJobRun[] }) {
  return (
    <ul className="flex flex-col divide-y divide-line-subtle">
      {runs.map((run) => {
        const status = jobRunStatusView(run.status);
        const chip = <Chip tone={status.tone}>{status.label}</Chip>;
        return (
          <li key={run.id} className="flex min-h-13 items-center justify-between gap-4 py-2">
            <span className="min-w-0">
              <span className="block text-body text-fg">{jobRunLabel(run.job)}</span>
              <span className="block text-label text-fg-muted num">
                {formatDateTime(run.startedAt)} · {formatDurationMs(run.durationMs)}
              </span>
              {run.error ? (
                <span className="block truncate text-label text-tone-danger-text" title={run.error}>
                  {run.error}
                </span>
              ) : null}
            </span>
            {run.summary ? (
              <Tooltip content={<pre className="max-w-sm whitespace-pre-wrap font-mono text-caption">{run.summary}</pre>}>
                <span className="shrink-0">{chip}</span>
              </Tooltip>
            ) : (
              <span className="shrink-0">{chip}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function PlatformJobsCard() {
  const [runJob] = useMutation<{ runPlatformJob: string | null }>(RUN_PLATFORM_JOB);
  const [runSnapshot] = useMutation<{ runUsageSnapshotJob: string | null }>(RUN_USAGE_SNAPSHOT_JOB);
  const [confirmJob, setConfirmJob] = useState<PlatformJob | null>(null);
  const [running, setRunning] = useState<PlatformJob | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [showRuns, setShowRuns] = useState(false);
  const [allOpen, setAllOpen] = useState(false);
  const runs = useJobRuns({ limit: RECENT_RUNS, skip: !showRuns });

  const run = async (job: PlatformJob) => {
    setRunning(job);
    try {
      const text =
        job === "usage_snapshot" ? (await runSnapshot()).data?.runUsageSnapshotJob : (await runJob({ variables: { job } })).data?.runPlatformJob;
      setSummary(text || null);
      addToast({ title: `${JOBS.find((entry) => entry.key === job)?.label} ran.` });
      // The run replaced today's row (a failed refresh is not a failed run).
      if (showRuns) await runs.refetch().catch(() => undefined);
    } catch (error) {
      const message = mutationFailureCopy(error);
      if (message) toastError(message);
    } finally {
      setRunning(null);
    }
  };

  const confirming = JOBS.find((entry) => entry.key === confirmJob);

  return (
    <Card
      id="billing-jobs"
      data-settings-field
      title="Billing jobs"
      description="These run every night on their own. Run one now after fixing data or changing the rules."
    >
      <ul className="flex flex-col divide-y divide-line-subtle">
        {JOBS.map((job) => (
          <li key={job.key} className="flex items-center justify-between gap-4 py-3 first:pt-0">
            <div className="min-w-0">
              <p className="text-body font-medium text-fg">{job.label}</p>
              <p className="text-label text-fg-muted">{job.description}</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              startIcon={<IconPlay aria-hidden />}
              isLoading={running === job.key}
              isDisabled={running !== null}
              onPress={() => setConfirmJob(job.key)}
            >
              Run now
            </Button>
          </li>
        ))}
      </ul>
      {summary ? (
        <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-surface-sunken p-3 font-mono text-caption text-fg-muted">{summary}</pre>
      ) : null}

      <div className="mt-3 border-t border-line-subtle pt-3">
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="tertiary"
            size="sm"
            endIcon={<IconCaret aria-hidden className={showRuns ? "rotate-180" : undefined} />}
            onPress={() => setShowRuns((open) => !open)}
            aria-expanded={showRuns}
          >
            {showRuns ? "Hide recent runs" : "Show recent runs"}
          </Button>
          {showRuns && runs.data.length > 0 ? (
            <Button variant="tertiary" size="sm" endIcon={<IconExpand aria-hidden />} onPress={() => setAllOpen(true)}>
              Show all
            </Button>
          ) : null}
        </div>
        {showRuns ? (
          runs.error ? (
            <ErrorState inline title="Couldn't load the recent runs." onRetry={() => void runs.refetch()} />
          ) : runs.loading ? (
            <Skeleton className="mt-3 h-16 w-full rounded-lg" />
          ) : runs.data.length === 0 ? (
            <p className="mt-2 text-body text-fg-muted">No runs recorded yet.</p>
          ) : (
            <RunList runs={runs.data} />
          )
        ) : null}
      </div>

      <Drawer isOpen={allOpen} onOpenChange={setAllOpen} size="sm">
        <DrawerContent>
          <DrawerHeader>Job runs</DrawerHeader>
          <DrawerBody>{allOpen ? <AllRuns /> : null}</DrawerBody>
        </DrawerContent>
      </Drawer>

      <ConfirmModal
        isOpen={confirming != null}
        onClose={() => setConfirmJob(null)}
        onConfirm={() => {
          if (confirmJob) void run(confirmJob);
        }}
        title={`Run ${confirming?.label.toLowerCase() ?? ""} now?`}
        description={`${confirming?.description ?? ""} It runs for every store.`}
        confirmLabel="Run now"
        confirmColor="primary"
      />
    </Card>
  );
}

function AllRuns() {
  const runs = useJobRuns({ limit: ALL_RUNS });
  if (runs.error) return <ErrorState inline title="Couldn't load the job runs." onRetry={() => void runs.refetch()} />;
  if (runs.loading) return <Skeleton className="h-40 w-full rounded-lg" />;
  if (runs.data.length === 0) return <p className="text-body text-fg-muted">No runs recorded yet.</p>;
  return <RunList runs={runs.data} />;
}

export default PlatformJobsCard;
