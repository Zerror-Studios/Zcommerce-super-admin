/**
 * Settings › Billing rules › Run now (PRD-014 PLT-13)
 *
 * The nightly jobs run on the server's schedule; an owner can run one now
 * (`runPlatformJob`, `runUsageSnapshotJob`, settings:manage). Each asks
 * first, then shows the server's summary as sent.
 */

import { useMutation } from "@apollo/client";
import { addToast } from "@heroui/react";
import { useState } from "react";

import { RUN_PLATFORM_JOB, RUN_USAGE_SNAPSHOT_JOB } from "../../graphql/billing";
import { mutationFailureCopy } from "../../lib/mutation-errors";
import { ConfirmModal } from "../common/ConfirmModal";
import { Button as UiButton, Card, toastError } from "../ui";

// ─── Constants ────────────────────────────────────────────────────────────

type PlatformJob = "billing_cycle" | "reminders" | "usage_snapshot";

const JOBS: { key: PlatformJob; label: string; description: string }[] = [
  {
    key: "billing_cycle",
    label: "Billing cycle",
    description: "Renews subscriptions whose period ended and issues their invoices, ends expired trials and cancellations, and marks unpaid invoices past their grace period overdue.",
  },
  {
    key: "reminders",
    label: "Renewal reminders",
    description: "Sends the reminders due today on the schedule above.",
  },
  {
    key: "usage_snapshot",
    label: "Usage snapshot",
    description: "Records today's usage (products, orders, storage, staff) for every store.",
  },
];

// ─── Component ────────────────────────────────────────────────────────────

export function PlatformJobsCard() {
  const [runJob] = useMutation<{ runPlatformJob: string | null }>(RUN_PLATFORM_JOB);
  const [runSnapshot] = useMutation<{ runUsageSnapshotJob: string | null }>(RUN_USAGE_SNAPSHOT_JOB);
  const [confirmJob, setConfirmJob] = useState<PlatformJob | null>(null);
  const [running, setRunning] = useState<PlatformJob | null>(null);
  const [summary, setSummary] = useState<{ job: PlatformJob; text: string } | null>(null);

  const run = async (job: PlatformJob) => {
    setRunning(job);
    try {
      const text =
        job === "usage_snapshot"
          ? (await runSnapshot()).data?.runUsageSnapshotJob
          : (await runJob({ variables: { job } })).data?.runPlatformJob;
      setSummary({ job, text: text ?? "" });
      addToast({ title: `${JOBS.find((entry) => entry.key === job)?.label} ran.` });
    } catch (error) {
      const message = mutationFailureCopy(error);
      if (message) toastError(message);
    } finally {
      setRunning(null);
    }
  };

  const confirming = JOBS.find((entry) => entry.key === confirmJob);

  return (
    <Card title="Run now" description="These run every night on their own. Run one now after fixing data or changing the rules.">
      <ul className="flex flex-col gap-3">
        {JOBS.map((job) => (
          <li key={job.key} className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-body font-medium text-fg">{job.label}</p>
              <p className="text-label text-fg-muted">{job.description}</p>
            </div>
            <UiButton
              variant="secondary"
              size="sm"
              isLoading={running === job.key}
              isDisabled={running !== null}
              onPress={() => setConfirmJob(job.key)}
            >
              Run now
            </UiButton>
          </li>
        ))}
      </ul>
      {summary?.text ? (
        <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-surface-sunken p-3 font-mono text-caption text-fg-muted">
          {summary.text}
        </pre>
      ) : null}
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

export default PlatformJobsCard;
