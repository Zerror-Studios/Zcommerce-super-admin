/**
 * Settings › Billing rules › Plan limits (PRD-016 FR-14, FR-26)
 *
 * The entitlement mode: OFF, LOG (deploy default: count, never block) or
 * ENFORCE. Saved on its own through `updatePlatformSettings`
 * (`settings:manage`), after a confirmation; the server writes the
 * before/after to the audit log, with the operator's optional note
 * (`PlatformSettingsInput.note`, max 500).
 */

import { addToast } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { ENTITLEMENTS_MODE_COPY } from "../../lib/platform-billing.util";
import { billingFailureCopy } from "../../lib/mutation-errors";
import { usePlatformSettings } from "../../providers/SettingsProvider";
import { entitlementsModeEnum, type EntitlementsMode } from "../../types/platform-api";
import {
  Button as UiButton,
  Card,
  Chip,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Textarea,
  toastError,
} from "../ui";

export interface EntitlementsModeCardProps {
  /** True without settings:manage: the mode is shown, not changed. */
  readOnly: boolean;
}

const MODES = Object.values(entitlementsModeEnum);

const MODE_TONES = { OFF: "neutral", LOG: "info", ENFORCE: "success" } as const;

/** The server keeps at most this many characters of the note. */
const MAX_NOTE_LENGTH = 500;

export function EntitlementsModeCard({ readOnly }: EntitlementsModeCardProps) {
  const { settings, loading, updateSettingsPatch } = usePlatformSettings();
  const saved: EntitlementsMode = settings.entitlementsMode ?? "LOG";
  const [mode, setMode] = useState<EntitlementsMode>(saved);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    setMode(saved);
  }, [saved]);

  const save = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const trimmed = note.trim();
      await updateSettingsPatch({ entitlementsMode: mode, ...(trimmed ? { note: trimmed } : {}) });
      setNote("");
      addToast({ title: `Plan limits: ${ENTITLEMENTS_MODE_COPY[mode].label}.` });
      setConfirming(false);
    } catch (error) {
      const message = billingFailureCopy(error);
      if (message) toastError(message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <Card
      title="Plan limits"
      description="Whether stores are held to their plan's limits (products, staff, messages, sales channels)."
      actions={<Chip tone={MODE_TONES[saved]}>{ENTITLEMENTS_MODE_COPY[saved].label}</Chip>}
    >
      <div className="flex flex-col gap-3">
        <Select
          label="Mode"
          selectedKeys={new Set([mode])}
          onSelectionChange={(keys) => {
            const value = Array.from(keys)[0];
            if (typeof value === "string" && (MODES as string[]).includes(value)) {
              setMode(value as EntitlementsMode);
            }
          }}
          disallowEmptySelection
          isDisabled={readOnly || loading}
          className="max-w-xs"
        >
          {MODES.map((key) => (
            <SelectItem key={key} description={ENTITLEMENTS_MODE_COPY[key].description}>
              {ENTITLEMENTS_MODE_COPY[key].label}
            </SelectItem>
          ))}
        </Select>
        <p className="text-caption text-fg-muted">
          Start with Log only, check a week of "would block" counts against each store's plan, then enforce
          (PRD-016 rollout).
        </p>
        {readOnly ? null : (
          <div className="flex justify-end">
            <UiButton variant="secondary" isDisabled={mode === saved || loading} onPress={() => setConfirming(true)}>
              Change mode
            </UiButton>
          </div>
        )}
      </div>

      <Modal isOpen={confirming} onClose={() => setConfirming(false)} width="sm">
        <ModalContent>
          <ModalHeader>
            Change plan limits from {ENTITLEMENTS_MODE_COPY[saved].label} to {ENTITLEMENTS_MODE_COPY[mode].label}?
          </ModalHeader>
          <ModalBody>
            <p className="text-body text-fg-muted">{ENTITLEMENTS_MODE_COPY[mode].description}</p>
            <p className="mt-2 text-body text-fg-muted">
              It applies to every store within a minute. Your name and the before and after values go to the audit
              log.
            </p>
            <Textarea
              label="Note for the audit log"
              placeholder="A week of Log only showed no store over its limits"
              description="Optional. Saved with the audit entry only."
              value={note}
              onValueChange={(value) => setNote(value.slice(0, MAX_NOTE_LENGTH))}
              className="mt-3"
            />
          </ModalBody>
          <ModalFooter>
            <UiButton variant="ghost" onPress={() => setConfirming(false)} isDisabled={busy}>
              Cancel
            </UiButton>
            <UiButton
              variant={mode === "ENFORCE" ? "danger" : "primary"}
              isLoading={busy}
              isDisabled={busy}
              onPress={() => void save()}
            >
              Change mode
            </UiButton>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  );
}
