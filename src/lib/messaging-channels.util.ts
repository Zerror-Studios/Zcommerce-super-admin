/**
 * Renewal-reminder channels (PRD-024 FR-4.2.5)
 *
 * SMS and WhatsApp go through the platform MSG91 account, which exists only
 * when the backend has the `PLATFORM_MSG91_*` names
 * (`platformMessagingStatus`). A channel the backend can't deliver is shown
 * disabled with the reason and is never sent; email always can.
 */

import type {
  PlatformMessagingStatus,
  ReminderPreview,
} from "../types/platform-api";

// ─── Types ────────────────────────────────────────────────────────────────

export type ReminderChannel = ReminderPreview["channel"];

/** The reminder switches, as the settings store them. */
export interface ReminderChannelSelection {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
}

/** What the platform API answered for `platformMessagingStatus`. */
export interface MessagingStatusState {
  status: PlatformMessagingStatus | null;
  loading: boolean;
  error: boolean;
}

export interface ChannelAvailability {
  /** The backend can deliver through this channel. */
  isConfigured: boolean;
  /** Why the switch is disabled; `null` when it isn't. */
  hint: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────

export const MESSAGING_NOT_CONFIGURED_HINT =
  "Not configured: set PLATFORM_MSG91_* on the backend";

const CHANNEL_LABELS: Record<ReminderChannel, string> = {
  EMAIL: "Email",
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
};

// ─── Checks ───────────────────────────────────────────────────────────────

/** Whether an SMS or WhatsApp switch can be used, and why not. */
export function channelAvailability(
  channel: "SMS" | "WHATSAPP",
  { status, loading, error }: MessagingStatusState,
): ChannelAvailability {
  if (status) {
    const isConfigured =
      channel === "SMS" ? status.smsConfigured : status.whatsappConfigured;
    return {
      isConfigured,
      hint: isConfigured ? null : MESSAGING_NOT_CONFIGURED_HINT,
    };
  }
  if (loading) return { isConfigured: false, hint: "Checking the setup…" };
  if (error) {
    return {
      isConfigured: false,
      hint: "Couldn't check whether this channel is set up.",
    };
  }
  return { isConfigured: false, hint: MESSAGING_NOT_CONFIGURED_HINT };
}

/** The channels to send: the switched-on ones the backend can deliver. */
export function reminderChannelsToSend(
  selection: ReminderChannelSelection,
  state: MessagingStatusState,
): ReminderChannel[] {
  const channels: ReminderChannel[] = [];
  if (selection.email) channels.push("EMAIL");
  if (selection.sms && channelAvailability("SMS", state).isConfigured) {
    channels.push("SMS");
  }
  if (
    selection.whatsapp &&
    channelAvailability("WHATSAPP", state).isConfigured
  ) {
    channels.push("WHATSAPP");
  }
  return channels;
}

/** "Email and SMS" for the queued toast. */
export function channelListLabel(channels: readonly ReminderChannel[]): string {
  const labels = channels.map((channel) => CHANNEL_LABELS[channel]);
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}
