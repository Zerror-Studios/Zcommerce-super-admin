import { addToast } from "@heroui/react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/common/PageHeader";
import { toasts } from "../copy";
import { TotpQrCode } from "../components/auth/TotpQrCode";
import { Button as UiButton, Card, Chip, CopyableId, IconTile, Input, cx } from "../components/ui";
import { IconCheck, IconClipboard, IconLock, IconMobile } from "../components/ui/icons";
import { PLATFORM_CONFIRM_MFA, PLATFORM_ENROL_MFA } from "../graphql/auth";
import { client, errorCodeOf } from "../lib/apollo-client";
import { broadcastToken } from "../lib/auth-channel";
import { getCsrfToken, setAccessToken } from "../lib/session-store";
import { useAuth } from "../providers/AuthProvider";
import type { PlatformMfaConfirmation, PlatformMfaEnrolment } from "../types/platform-api";

type Step = "intro" | "scan" | "done";

/** "JBSW Y3DP EHPK 3PXP": easier to type into an app than one long run. */
function groupKey(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

const SETUP_STEPS = [
  { key: "intro", label: "Confirm it's you", icon: IconLock },
  { key: "scan", label: "Scan the code", icon: IconMobile },
  { key: "done", label: "Save recovery codes", icon: IconClipboard },
] as const;

/**
 * The setup's step tracker (v2 §10A record recipe: one icon per step). Done steps get a tick, the current one is
 * ink, the next ones grey; on phone only the current step keeps its label.
 */
function SetupSteps({ current }: { current: Step }) {
  const index = SETUP_STEPS.findIndex((step) => step.key === current);
  return (
    <ol aria-label="Setup steps" className="mb-4 flex items-center gap-2">
      {SETUP_STEPS.map((step, position) => {
        const done = position < index;
        const isCurrent = position === index;
        const Icon = done ? IconCheck : step.icon;
        return (
          <li
            key={step.key}
            aria-current={isCurrent ? "step" : undefined}
            className={cx("flex items-center gap-2", position < SETUP_STEPS.length - 1 && "flex-1")}
          >
            <IconTile size="sm" tone={done || isCurrent ? "ink" : "neutral"}>
              <Icon aria-hidden />
            </IconTile>
            <span
              className={cx(
                "whitespace-nowrap text-label font-medium",
                isCurrent ? "text-fg" : "hidden text-fg-muted sm:inline",
              )}
            >
              {step.label}
              {done ? <span className="sr-only"> (done)</span> : null}
            </span>
            {position < SETUP_STEPS.length - 1 ? <span aria-hidden className="h-px min-w-4 flex-1 bg-line" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * MFA enrolment (PRD-005 FR-1.4). Manage roles must enrol before any manage
 * action; the QR code, the secret for manual entry and the otpauth link for
 * apps that accept it.
 *
 * Design v2: inside the shell, so the settings look (board 55 "Your login")
 * rather than the black sign-in screen: the page title row (ink tile), a
 * 720px column, a three-step tracker while setting up (confirm it's you →
 * scan → save recovery codes) and one card per step with the buttons on the
 * right, Cancel / Later first. Once it is on, one settings row: "Two-step
 * login · Authenticator app", an On badge and Replace authenticator.
 */
export function Mfa() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState<Step>(user?.mfaEnabled ? "done" : "intro");
  const [enrolment, setEnrolment] = useState<PlatformMfaEnrolment | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  // Re-checked by the server (review B-H1): a stolen session cannot enrol an authenticator.
  const [password, setPassword] = useState("");
  const [currentCode, setCurrentCode] = useState("");
  const [startError, setStartError] = useState<string | undefined>();
  const replacing = user?.mfaEnabled === true;
  // The tracker shows while setting up, and on the recovery codes that end it.
  const setupStep: Step | null = step === "done" && recoveryCodes.length === 0 ? null : step;

  const start = async (event: FormEvent) => {
    event.preventDefault();
    if (!password) {
      setStartError("Enter your password.");
      return;
    }
    if (replacing && !currentCode.trim()) {
      setStartError("Enter the code from your current app, or a recovery code.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await client.mutate<{ platformEnrolMfa: PlatformMfaEnrolment }>({
        mutation: PLATFORM_ENROL_MFA,
        variables: { password, currentCode: replacing ? currentCode.trim() : null },
      });
      setEnrolment(data?.platformEnrolMfa ?? null);
      setPassword("");
      setCurrentCode("");
      setStep("scan");
    } catch (err) {
      const errorCode = errorCodeOf(err);
      if (errorCode === "UNAUTHENTICATED") setStartError("That password didn't match.");
      else if (errorCode === "BAD_USER_INPUT") setStartError("That code didn't match. Try the next one, or a recovery code.");
      else addToast({ title: toasts.mfaStartFailed, color: "danger" });
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code from your app.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await client.mutate<{ platformConfirmMfa: PlatformMfaConfirmation }>({
        mutation: PLATFORM_CONFIRM_MFA,
        variables: { totp: code.trim() },
      });
      const result = data?.platformConfirmMfa;
      if (!result) throw new Error("empty");
      // The old token says mfaEnabled:false; swap in the one the server issued
      // and hand it to the other tabs too (review C-L4).
      setAccessToken(result.accessToken);
      // Same session, so the CSRF token is unchanged (PRD-014 FR-1.11).
      broadcastToken(result.accessToken, getCsrfToken());
      setRecoveryCodes(result.recoveryCodes);
      await refreshUser();
      setStep("done");
    } catch (err) {
      setError(
        errorCodeOf(err) === "BAD_USER_INPUT"
          ? "That code didn't match. Check the time on your phone and try the next code."
          : "Couldn't confirm the code. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[var(--zc-content-max-form)]">
      <PageHeader
        type="page"
        icon={<IconLock aria-hidden />}
        title="Two-step verification"
        description="Required for owners, admins and billing managers before any change to platform data."
      />

      {setupStep ? <SetupSteps current={setupStep} /> : null}

      {step === "intro" ? (
        <Card
          title={replacing ? "Replace your authenticator" : "Set up an authenticator app"}
          description={
            replacing
              ? "Your current app keeps working until the new one is confirmed. Confirm it's you first."
              : "Google Authenticator, 1Password, Authy or any TOTP app. Confirm it's you first."
          }
        >
          <form className="flex flex-col gap-4" onSubmit={start}>
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onValueChange={(value) => {
                setPassword(value);
                setStartError(undefined);
              }}
              isInvalid={!!startError && !password}
              errorMessage={!password ? startError : undefined}
            />
            {replacing ? (
              <Input
                label="Code from your current app (or a recovery code)"
                value={currentCode}
                onValueChange={(value) => {
                  setCurrentCode(value);
                  setStartError(undefined);
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                isInvalid={!!startError && !!password}
                errorMessage={password ? startError : undefined}
              />
            ) : null}
            {!replacing && startError && password ? (
              <p role="alert" className="text-caption text-tone-danger-text">
                {startError}
              </p>
            ) : null}
            {/* Phone (v2 §10): full-width buttons, the action on top. */}
            <div className="flex justify-end gap-2 max-md:flex-col-reverse max-md:[&>*]:w-full">
              {replacing ? (
                <UiButton variant="secondary" onPress={() => setStep("done")}>
                  Cancel
                </UiButton>
              ) : null}
              <UiButton variant="primary" type="submit" isLoading={busy}>
                {replacing ? "Continue" : "Set up"}
              </UiButton>
            </div>
          </form>
        </Card>
      ) : null}

      {step === "scan" && enrolment ? (
        <Card title="Scan the QR code" description="Open Google Authenticator, Microsoft Authenticator, 1Password or Authy, add an account, and scan this code.">
          <form className="flex flex-col gap-5" onSubmit={confirm}>
            <div className="flex flex-col items-start gap-4 sm:flex-row">
              <TotpQrCode otpauthUrl={enrolment.otpauthUrl} />
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-body text-fg-muted">
                <li>In your authenticator app, choose <span className="font-medium text-fg">Add account</span> or the <span className="font-medium text-fg">+</span> button.</li>
                <li>Scan the QR code. The account shows as <span className="font-medium text-fg">Zcommerce</span>.</li>
                <li>Enter the 6-digit code the app shows below.</li>
              </ol>
            </div>
            <details className="text-body">
              <summary className="cursor-pointer text-brand">Can't scan? Enter the setup key instead</summary>
              <div className="mt-3 flex flex-col gap-2">
                <CopyableId value={groupKey(enrolment.secret)} />
                <p className="text-caption text-fg-muted">Choose "Enter a setup key", account name your email, key type "Time based".</p>
                {enrolment.otpauthUrl.startsWith("otpauth://") ? (
                  <a className="text-caption text-brand underline-offset-2 hover:underline" href={enrolment.otpauthUrl}>
                    On this phone? Open in your authenticator app
                  </a>
                ) : null}
              </div>
            </details>
            <Input
              label="6-digit code"
              placeholder="123 456"
              maxLength={7}
              className="max-w-xs"
              autoFocus
              value={code}
              onValueChange={(value) => {
                setCode(value.replace(/\D/g, "").slice(0, 6));
                setError(undefined);
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              isInvalid={!!error}
              errorMessage={error}
            />
            <div className="flex justify-end gap-2 max-md:flex-col-reverse max-md:[&>*]:w-full">
              <UiButton variant="secondary" onPress={() => navigate("/")}>
                Later
              </UiButton>
              <UiButton variant="primary" type="submit" isLoading={busy}>
                Turn on
              </UiButton>
            </div>
          </form>
        </Card>
      ) : null}

      {step === "done" && recoveryCodes.length ? (
        <Card
          title="Save your recovery codes"
          description="Each code signs you in once if you lose your phone. They are shown only now."
        >
          <ul className="mb-4 grid grid-cols-1 gap-2 font-mono text-body sm:grid-cols-2">
            {recoveryCodes.map((recoveryCode) => (
              <li key={recoveryCode}>
                <CopyableId value={recoveryCode} />
              </li>
            ))}
          </ul>
          <div className="flex justify-end max-md:[&>*]:w-full">
            <UiButton variant="primary" onPress={() => navigate("/", { replace: true })}>
              Done
            </UiButton>
          </div>
        </Card>
      ) : null}

      {step === "done" && recoveryCodes.length === 0 ? (
        <Card title="Your login">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="min-w-0 flex-1">
              <p className="text-body font-medium text-fg">Two-step login</p>
              <p className="text-label text-fg-muted">
                Authenticator app. Ask a platform owner to reset it if you lose your device.
              </p>
            </div>
            <Chip tone="success">On</Chip>
            <UiButton variant="secondary" size="sm" onPress={() => setStep("intro")}>
              Replace authenticator
            </UiButton>
          </div>
          <div className="mt-4 flex justify-end border-t border-line-subtle pt-4">
            <UiButton variant="primary" onPress={() => navigate("/", { replace: true })}>
              Done
            </UiButton>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
