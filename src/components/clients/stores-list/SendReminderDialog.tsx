/**
 * Send reminder pop-up (04 S-04c), opened from a Stores row's ⋯ menu. The server picks and renders the reminder
 * (`previewRenewalReminder`) and queues it (`sendRenewalReminders`); channels start from Settings › Payments &
 * billing rules, and a channel the platform can't deliver yet is shown disabled.
 */

import { useMutation, useQuery } from "@apollo/client";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PREVIEW_RENEWAL_REMINDER, SEND_RENEWAL_REMINDERS } from "../../../graphql/billing";
import { useMessagingStatus } from "../../../hooks/use-messaging-status";
import {
  channelAvailability,
  reminderChannelsToSend,
  type ReminderChannelSelection,
} from "../../../lib/messaging-channels.util";
import { reminderForToday } from "./store-list.util";
import { mutationFailureCopy } from "../../../lib/mutation-errors";
import { ownerContactGaps } from "../../../lib/owner-contact.util";
import { usePlatformSettings } from "../../../providers/SettingsProvider";
import type { Client } from "../../../types";
import type { ReminderBatch, ReminderPreview } from "../../../types/platform-api";
import {
  Button,
  Checkbox,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Skeleton,
  toast,
  toastError,
} from "../../ui";

export interface SendReminderDialogProps {
  /** The stores to remind; the dialog is open while this has any. */
  stores: Client[];
  onClose: () => void;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Open with the stores to remind; give it a `key` per set of stores so each opening starts fresh. */
export function SendReminderDialog({ stores, onClose }: SendReminderDialogProps) {
  const navigate = useNavigate();
  const isOpen = stores.length > 0;
  const first = stores[0];
  const { settings } = usePlatformSettings();
  const messaging = useMessagingStatus();
  const sms = channelAvailability("SMS", messaging);
  const whatsapp = channelAvailability("WHATSAPP", messaging);
  const [selection, setSelection] = useState<ReminderChannelSelection>({ email: true, sms: false, whatsapp: false });
  const [sending, setSending] = useState(false);

  const preview = useQuery<{ previewRenewalReminder: ReminderPreview }>(PREVIEW_RENEWAL_REMINDER, {
    variables: { tenantId: first?.id },
    skip: !first,
    fetchPolicy: "network-only",
  });
  const [send] = useMutation<{ sendRenewalReminders: ReminderBatch }>(SEND_RENEWAL_REMINDERS);
  const data = preview.data?.previewRenewalReminder;

  // Stores the chosen channels can't reach: no owner email (email), no owner phone (SMS, WhatsApp).
  const missing = useMemo(
    () =>
      stores.filter((store) => {
        const gaps = ownerContactGaps(store);
        const noEmail = selection.email && gaps.isMissingEmail;
        const noPhone = (selection.sms || selection.whatsapp) && gaps.isMissingPhone;
        return noEmail || noPhone;
      }),
    [selection, stores],
  );

  if (!isOpen || !first) return null;

  const many = stores.length > 1;
  const which = data ? reminderForToday(settings.reminders, data.daysUntilDue) : null;
  const channels = reminderChannelsToSend(selection, messaging);

  const run = async () => {
    if (!channels.length) {
      toastError("Pick at least one channel.");
      return;
    }
    setSending(true);
    try {
      const result = await send({ variables: { tenantIds: stores.map((store) => store.id), channels } });
      const batch = result.data?.sendRenewalReminders;
      const sent = stores.length - (batch?.skipped.length ?? 0);
      if (sent <= 0) {
        toastError(many ? "No reminders were sent." : `The reminder to ${first.storeName} wasn't sent.`);
      } else {
        toast.success(many ? `Reminders sent to ${plural(sent, "store", "stores")}` : `Reminder sent to ${first.storeName}`);
      }
      onClose();
    } catch (error) {
      const message = mutationFailureCopy(error);
      if (message) toastError(message);
    } finally {
      setSending(false);
    }
  };

  const channelRows: {
    key: keyof ReminderChannelSelection;
    label: string;
    available: boolean;
  }[] = [
    { key: "email", label: "Email", available: true },
    { key: "sms", label: "SMS", available: sms.isConfigured },
    { key: "whatsapp", label: "WhatsApp", available: whatsapp.isConfigured },
  ];

  return (
    <Modal isOpen onClose={onClose} width="md">
      <ModalContent>
        <ModalHeader>
          {many ? `Send reminders to ${plural(stores.length, "store", "stores")}?` : `Send a reminder to ${first.storeName}?`}
        </ModalHeader>
        <ModalBody>
          <p className="text-body text-fg-muted">
            {which ? `They get the reminder that matches today: ${which}.` : "They get the reminder that matches today."}
            {many ? " Each store gets its own." : ""}
          </p>

          <fieldset className="mt-4">
            <legend className="mb-2 text-label font-medium text-fg">Channels</legend>
            <div className="flex flex-col gap-2">
              {channelRows.map((row) => (
                <div key={row.key} className="flex items-center gap-3">
                  <Checkbox
                    isSelected={row.available && selection[row.key]}
                    isDisabled={!row.available || sending}
                    onValueChange={(on) => setSelection((current) => ({ ...current, [row.key]: on }))}
                  >
                    {row.label}
                  </Checkbox>
                  {row.available ? null : (
                    <>
                      <Chip tone="neutral">Not set up</Chip>
                      <span className="text-label text-fg-subtle">Not available yet</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </fieldset>

          {missing.length ? (
            <div role="status" className="mt-4 rounded-lg bg-tone-warning-soft px-3 py-2 text-label text-tone-warning">
              {missing.map((store) => store.storeName).join(", ")}{" "}
              {missing.length === 1 ? "has" : "have"} no owner email or phone for these channels and will be skipped.
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-3">
            {preview.loading && !data ? (
              <>
                <Skeleton className="h-9 w-full rounded-lg" />
                <Skeleton className="h-28 w-full rounded-lg" />
              </>
            ) : data ? (
              <>
                <Input label="Subject" value={data.subject} isReadOnly />
                <div>
                  <p className="mb-1.5 text-label font-medium text-fg">Message</p>
                  <div className="max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-sunken px-3 py-2 text-body text-fg">
                    {data.body}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-label text-fg-muted">The preview couldn't be loaded. You can still send the reminder.</p>
            )}
          </div>
        </ModalBody>
        <ModalFooter className="justify-between">
          <Button variant="tertiary" onPress={() => navigate("/settings/billing")} isDisabled={sending}>
            Edit text in Settings ›
          </Button>
          <span className="flex items-center gap-2">
            <Button variant="secondary" onPress={onClose} isDisabled={sending}>
              Cancel
            </Button>
            <Button variant="primary" isLoading={sending} onPress={() => void run()}>
              Send reminder
            </Button>
          </span>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
