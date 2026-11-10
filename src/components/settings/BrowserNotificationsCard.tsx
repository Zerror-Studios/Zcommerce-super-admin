/**
 * Settings › Profile & security › Browser notifications (PRD-033 FR-2.8, FR-2.9)
 *
 * Opt-in push for urgent console notifications with the tab closed. Hidden
 * while the platform has no push keys (`platformWebPushConfig.enabled`).
 * Shows why this browser can't take push (not supported, blocked, iPhone /
 * iPad not on the home screen), or turns it on and off, sets which
 * severities push and sends a test. The bell's feed is unchanged.
 */

import { addToast } from "@heroui/react";
import { useState } from "react";

import { useWebPush } from "../../hooks/use-web-push";
import {
  PUSH_BLOCKED_COPY,
  PUSH_PREFERENCE_OPTIONS,
  deviceCountCopy,
  pushDeviceStateEnum,
  pushFailureCopy,
  testPushResultCopy,
} from "../../lib/web-push.util";
import type { PlatformPushMinSeverity } from "../../types/platform-api";
import { toasts } from "../../copy";
import {
  Button,
  Card,
  Chip,
  ErrorState,
  Select,
  SelectItem,
  toastError,
} from "../ui";
import { IconInfo, IconNotifications, IconSend } from "../ui/icons";
import { SkelLine } from "../common/SkeletonBits";

// ─── Helpers ──────────────────────────────────────────────────────────────

function selectValue(keys: unknown): string | null {
  const value = Array.from(keys as Iterable<unknown>)[0];
  return typeof value === "string" ? value : null;
}

function reportFailure(error: unknown) {
  const message = pushFailureCopy(error);
  if (message) toastError(message);
}

/** One muted line with an info icon, for the states without an action. */
function StateNote({ children }: { children: string }) {
  return (
    <p className="flex items-start gap-2 text-body text-fg-muted">
      <IconInfo aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

// ─── Component ────────────────────────────────────────────────────────────

export function BrowserNotificationsCard() {
  const push = useWebPush();
  const [testResult, setTestResult] = useState<string | null>(null);

  if (push.configLoading) {
    return (
      <Card title="Browser notifications">
        <SkelLine text="text-label" className="w-3/5" />
      </Card>
    );
  }
  if (push.configError) {
    return (
      <Card title="Browser notifications">
        <ErrorState
          inline
          title="Couldn't check browser notifications."
          description={toasts.genericError}
          onRetry={push.retryConfig}
        />
      </Card>
    );
  }
  if (!push.enabled) return null;

  const isOn = push.state === pushDeviceStateEnum.ON;

  const enable = async () => {
    try {
      await push.enable();
    } catch (error) {
      reportFailure(error);
    }
  };

  const disable = async () => {
    try {
      await push.disable();
      setTestResult(null);
      addToast({ title: "Notifications turned off on this device." });
    } catch (error) {
      reportFailure(error);
    }
  };

  const changePreference = async (keys: unknown) => {
    const value = selectValue(keys) as PlatformPushMinSeverity | null;
    if (!value || value === push.settings?.minSeverity) return;
    try {
      await push.setPreference(value);
      addToast({ title: "Notification preference saved." });
    } catch (error) {
      reportFailure(error);
    }
  };

  const sendTest = async () => {
    try {
      setTestResult(testPushResultCopy(await push.sendTest()));
    } catch (error) {
      reportFailure(error);
    }
  };

  const renderDeviceState = () => {
    switch (push.state) {
      case pushDeviceStateEnum.CHECKING:
        return <SkelLine text="text-label" className="w-2/5" />;
      case pushDeviceStateEnum.UNSUPPORTED:
        return (
          <StateNote>
            Not supported: this browser can't receive push notifications.
          </StateNote>
        );
      case pushDeviceStateEnum.NEEDS_INSTALL:
        return (
          <StateNote>
            Add to Home Screen first: on iPhone and iPad (iOS 16.4 or later),
            open this console from its Home Screen icon to turn on
            notifications.
          </StateNote>
        );
      case pushDeviceStateEnum.BLOCKED:
        return (
          <div className="flex flex-col gap-1.5">
            <Chip tone="warning">Blocked in this browser</Chip>
            <StateNote>{PUSH_BLOCKED_COPY}</StateNote>
          </div>
        );
      case pushDeviceStateEnum.ON:
        return (
          <div className="flex flex-wrap items-center gap-3">
            <Chip tone="success">On this device</Chip>
            {push.settings ? (
              <span className="text-label text-fg-muted num">
                {deviceCountCopy(push.settings.deviceCount)}
              </span>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              isLoading={push.isDisabling}
              onPress={() => void disable()}
            >
              Turn off on this device
            </Button>
          </div>
        );
      default:
        return (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              startIcon={<IconNotifications aria-hidden />}
              isLoading={push.isEnabling}
              onPress={() => void enable()}
            >
              Enable notifications
            </Button>
            {push.settings && push.settings.deviceCount > 0 ? (
              <span className="text-label text-fg-muted num">
                {deviceCountCopy(push.settings.deviceCount)} on other devices
              </span>
            ) : null}
          </div>
        );
    }
  };

  return (
    <Card
      id="browser-notifications"
      data-settings-field
      title="Browser notifications"
      description="Get urgent console notifications on this device, even with the console closed."
    >
      <div className="flex flex-col gap-4">
        {renderDeviceState()}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Select
            className="sm:max-w-xs"
            label="Notify me about"
            selectedKeys={
              push.settings ? new Set([push.settings.minSeverity]) : new Set()
            }
            onSelectionChange={(keys) => void changePreference(keys)}
            disallowEmptySelection
            isDisabled={!push.settings || push.isSavingPreference}
            description="Applies to every browser you've turned on."
          >
            {PUSH_PREFERENCE_OPTIONS.map((option) => (
              <SelectItem key={option.key}>{option.label}</SelectItem>
            ))}
          </Select>
          <div>
            <Button
              variant="ghost"
              size="sm"
              startIcon={<IconSend aria-hidden />}
              isLoading={push.isTesting}
              isDisabled={!isOn}
              onPress={() => void sendTest()}
            >
              Send a test notification
            </Button>
          </div>
        </div>
        {testResult ? (
          <p role="status" className="text-label text-fg-muted">
            {testResult}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

export default BrowserNotificationsCard;
