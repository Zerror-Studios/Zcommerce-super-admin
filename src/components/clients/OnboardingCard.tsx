import { useState } from "react";
import type { Client } from "../../types";
import { mutationFailureCopy } from "../../lib/mutation-errors";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { useAuth } from "../../providers/AuthProvider";
import { useClients, type CreateStoreResult } from "../../providers/ClientsProvider";
import { toasts } from "../../copy";
import { Button as UiButton, Card, Chip, toastError } from "../ui";
import { OwnerCredentialsDialog } from "./OwnerCredentialsDialog";

export interface OnboardingCardProps {
  client: Client;
}

const STEP_LABELS: Record<string, string> = {
  database: "Store database",
  ownerAdmin: "Owner login",
  channels: "Default apps (Nimbbl, Shiprocket, MSG91)",
  subscription: "Subscription",
};

/** Provisioning progress for a store that isn't READY yet (PRD-005 FR-3.3); hidden once it is. */
export function OnboardingCard({ client }: OnboardingCardProps) {
  const { retryProvisioning } = useClients();
  const { can } = useAuth();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CreateStoreResult | null>(null);
  const onboarding = client.onboarding;
  if (!onboarding || onboarding.status === "READY") return null;

  const retry = async () => {
    setBusy(true);
    try {
      const next = await retryProvisioning(client.id);
      if (next.client.onboarding?.status === "READY") setResult(next);
      else toastError(toasts.storeProvisioningFailed(client.storeName));
    } catch (error) {
      const message = mutationFailureCopy(error);
      if (message) toastError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card
        title={onboarding.status === "FAILED" ? "Provisioning failed" : "Provisioning…"}
        description={
          onboarding.status === "FAILED"
            ? onboarding.error ?? "A step failed. Retry runs only what is missing."
            : "The store comes online when every step is done."
        }
        actions={
          onboarding.status === "FAILED" && can(PLATFORM_PERMISSIONS.TENANTS_MANAGE) ? (
            <UiButton variant="primary" isLoading={busy} onPress={() => void retry()}>
              Retry
            </UiButton>
          ) : undefined
        }
      >
        <ul className="flex flex-col gap-2">
          {onboarding.steps.map((step) => (
            <li key={step.key} className="flex items-center justify-between gap-3">
              <span className="text-body text-fg">{STEP_LABELS[step.key] ?? step.key}</span>
              <Chip tone={step.status === "DONE" ? "success" : step.status === "FAILED" ? "danger" : "neutral"}>
                {step.status === "DONE" ? "Done" : step.status === "FAILED" ? "Failed" : "Pending"}
              </Chip>
            </li>
          ))}
        </ul>
      </Card>
      {result ? (
        <OwnerCredentialsDialog
          isOpen
          storeName={result.client.storeName}
          ownerEmail={result.client.ownerEmail}
          temporaryPassword={result.ownerTemporaryPassword}
          onClose={() => setResult(null)}
        />
      ) : null}
    </>
  );
}
