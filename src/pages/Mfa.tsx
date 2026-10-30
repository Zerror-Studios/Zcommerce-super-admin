import { addToast } from "@heroui/react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/common/PageHeader";
import { toasts } from "../copy";
import { TotpQrCode } from "../components/auth/TotpQrCode";
import { Button as UiButton, Card, CopyableId, Input } from "../components/ui";
import { IconLock } from "../components/ui/icons";

/** "JBSW Y3DP EHPK 3PXP": easier to type into an app than one long run. */
function groupKey(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}
import { PLATFORM_CONFIRM_MFA, PLATFORM_ENROL_MFA } from "../graphql/auth";
import { client, errorCodeOf } from "../lib/apollo-client";
import { broadcastToken } from "../lib/auth-channel";
import { getCsrfToken, setAccessToken } from "../lib/session-store";
import { useAuth } from "../providers/AuthProvider";
import type { PlatformMfaConfirmation, PlatformMfaEnrolment } from "../types/platform-api";

type Step = "intro" | "scan" | "done";

/**
 * MFA enrolment (PRD-005 FR-1.4). Manage roles must enrol before any manage
 * action; the secret is shown for manual entry (no QR library) with the
 * otpauth link for apps that accept it.
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
    <div className="mx-auto w-full max-w-[720px]">
      <PageHeader
        type="page"
        icon={<IconLock aria-hidden />}
        section="slate"
        title="Two-step verification"
        description="Required for owners, admins and billing managers before any change to platform data."
      />

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
            {!replacing && startError && password ? <p className="text-caption text-danger">{startError}</p> : null}
            <div className="flex justify-end gap-2">
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
            <div className="flex justify-end gap-2">
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

      {step === "done" ? (
        <Card
          title={recoveryCodes.length ? "Save your recovery codes" : "Two-step verification is on"}
          description={
            recoveryCodes.length
              ? "Each code signs you in once if you lose your phone. They are shown only now."
              : "Ask a platform owner to reset it if you lose your device."
          }
        >
          {recoveryCodes.length ? (
            <ul className="mb-4 grid grid-cols-2 gap-2 font-mono text-body">
              {recoveryCodes.map((recoveryCode) => (
                <li key={recoveryCode}>
                  <CopyableId value={recoveryCode} />
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <UiButton variant="primary" onPress={() => navigate("/", { replace: true })}>
              Done
            </UiButton>
            {recoveryCodes.length === 0 ? (
              <UiButton variant="secondary" onPress={() => setStep("intro")}>
                Replace authenticator
              </UiButton>
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
