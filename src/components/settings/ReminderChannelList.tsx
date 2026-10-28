/**
 * Reminder channels (PRD-024 FR-4.2.5), one row per channel (owner 2026-10-28 redesign): icon, name and where
 * it goes on the left; the switch, or a "Not set up" chip, on the right. A channel the backend can't deliver
 * stays visible and the setup note is said once under the list, not under every switch.
 * Used by Payment reminders and Settings › Grace period and reminders.
 */

import type { ComponentType } from "react";
import type { ChannelAvailability, ReminderChannelSelection } from "../../lib/messaging-channels.util";
import { Chip, Switch, cx } from "../ui";
import { IconMessages, IconPhone, IconWhatsApp } from "../ui/icons";

export interface ReminderChannelListProps {
  selection: ReminderChannelSelection;
  onChange: (channel: keyof ReminderChannelSelection, on: boolean) => void;
  sms: ChannelAvailability;
  whatsapp: ChannelAvailability;
  isDisabled?: boolean;
  className?: string;
}

interface ChannelRow {
  key: keyof ReminderChannelSelection;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  availability: ChannelAvailability;
}

export function ReminderChannelList({ selection, onChange, sms, whatsapp, isDisabled = false, className }: ReminderChannelListProps) {
  const rows: ChannelRow[] = [
    {
      key: "email",
      label: "Email",
      description: "To the owner's email",
      icon: IconMessages,
      availability: { isConfigured: true, hint: null },
    },
    { key: "sms", label: "SMS", description: "Text message to the owner's phone", icon: IconPhone, availability: sms },
    { key: "whatsapp", label: "WhatsApp", description: "WhatsApp message to the owner's phone", icon: IconWhatsApp, availability: whatsapp },
  ];
  const notSetUp = rows.filter((row) => !row.availability.isConfigured);
  // While checking or after a failed check, each row says so; the setup note is only for "not set up".
  const checkHint = notSetUp.find((row) => row.availability.hint && !isSetupHint(row.availability))?.availability.hint;

  return (
    <div className={className}>
      <ul role="group" aria-label="Reminder channels" className="divide-y divide-line-subtle rounded-lg border border-line">
        {rows.map((row) => {
          const Icon = row.icon;
          const available = row.availability.isConfigured;
          return (
            <li key={row.key} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden
                  className={cx(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-sunken",
                    available ? "text-fg-muted" : "text-fg-subtle",
                  )}
                >
                  <Icon aria-hidden className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className={cx("text-body font-medium", available ? "text-fg" : "text-fg-muted")}>{row.label}</p>
                  <p className="text-label text-fg-muted">{row.description}</p>
                </div>
              </div>
              {available ? (
                <Switch
                  aria-label={`Send by ${row.label}`}
                  isSelected={selection[row.key]}
                  onValueChange={(on) => onChange(row.key, on)}
                  isDisabled={isDisabled}
                />
              ) : (
                <Chip tone="neutral">{isSetupHint(row.availability) ? "Not set up" : "Unavailable"}</Chip>
              )}
            </li>
          );
        })}
      </ul>
      {notSetUp.some((row) => isSetupHint(row.availability)) ? (
        <p className="mt-2 text-label text-fg-muted">
          {notSetUp.filter((row) => isSetupHint(row.availability)).map((row) => row.label).join(" and ")}{" "}
          {notSetUp.filter((row) => isSetupHint(row.availability)).length > 1 ? "need" : "needs"} the platform MSG91
          account. A developer turns it on with the <code className="font-mono text-caption">PLATFORM_MSG91_*</code>{" "}
          settings on the backend.
        </p>
      ) : checkHint ? (
        <p className="mt-2 text-label text-fg-muted">{checkHint}</p>
      ) : null}
    </div>
  );
}

/** "Not configured" (vs. still checking, or the check failed). */
function isSetupHint(availability: ChannelAvailability): boolean {
  return !availability.isConfigured && (availability.hint?.startsWith("Not configured") ?? false);
}
