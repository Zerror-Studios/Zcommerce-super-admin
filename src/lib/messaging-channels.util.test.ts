import { describe, expect, it } from "vitest";
import {
  MESSAGING_NOT_CONFIGURED_HINT,
  channelAvailability,
  channelListLabel,
  reminderChannelsToSend,
  type MessagingStatusState,
} from "./messaging-channels.util";

const answered = (smsConfigured: boolean, whatsappConfigured: boolean): MessagingStatusState => ({
  status: { smsConfigured, whatsappConfigured },
  loading: false,
  error: false,
});

describe("reminder channel switches (PRD-024 FR-4.2.5)", () => {
  it("enables a configured channel", () => {
    expect(channelAvailability("SMS", answered(true, false))).toEqual({ isConfigured: true, hint: null });
  });

  it("disables an unconfigured channel with the env hint", () => {
    expect(channelAvailability("WHATSAPP", answered(true, false))).toEqual({
      isConfigured: false,
      hint: MESSAGING_NOT_CONFIGURED_HINT,
    });
    expect(MESSAGING_NOT_CONFIGURED_HINT).toBe("Not configured: set PLATFORM_MSG91_* on the backend");
  });

  it("stays disabled while loading, on an error and without billing:read", () => {
    expect(channelAvailability("SMS", { status: null, loading: true, error: false }).isConfigured).toBe(false);
    expect(channelAvailability("SMS", { status: null, loading: false, error: true }).hint).toMatch(/Couldn't check/);
    expect(channelAvailability("SMS", { status: null, loading: false, error: false }).hint).toBe(
      MESSAGING_NOT_CONFIGURED_HINT,
    );
  });

  it("sends only switched-on channels the backend can deliver", () => {
    const all = { email: true, sms: true, whatsapp: true };
    expect(reminderChannelsToSend(all, answered(false, false))).toEqual(["EMAIL"]);
    expect(reminderChannelsToSend(all, answered(true, false))).toEqual(["EMAIL", "SMS"]);
    expect(reminderChannelsToSend(all, answered(true, true))).toEqual(["EMAIL", "SMS", "WHATSAPP"]);
    expect(reminderChannelsToSend({ email: false, sms: false, whatsapp: true }, answered(true, true))).toEqual([
      "WHATSAPP",
    ]);
    expect(reminderChannelsToSend({ email: false, sms: true, whatsapp: false }, answered(false, false))).toEqual([]);
  });

  it("names the channels in the queued toast", () => {
    expect(channelListLabel(["EMAIL"])).toBe("Email");
    expect(channelListLabel(["EMAIL", "SMS"])).toBe("Email and SMS");
    expect(channelListLabel(["EMAIL", "SMS", "WHATSAPP"])).toBe("Email, SMS and WhatsApp");
    expect(channelListLabel([])).toBe("");
  });
});
