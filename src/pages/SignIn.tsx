import { addToast } from "@heroui/react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth, type SignInFailure } from "../providers/AuthProvider";
import { IconHide, IconView } from "../components/ui/icons";
import { Button as UiButton } from "../components/ui";
import { AuthField, AuthLayout } from "../components/layout/AuthLayout";
import { SESSION_END_MESSAGES, consumeSessionEnd } from "../lib/auth-channel";
import { toasts } from "../copy";

type Step = "credentials" | "totp";

const FAILURE_COPY: Record<Exclude<SignInFailure, "MFA_REQUIRED">, string> = {
  INVALID: toasts.wrongLogin,
  INVALID_TOTP: "That code didn't work. Enter the current code from your authenticator app.",
  ACCOUNT_DISABLED: "This account has been disabled. Ask a platform owner to restore it.",
  RATE_LIMITED: "Too many attempts. Wait a minute and try again.",
  UNAVAILABLE: "Can't reach the platform right now. Try again in a moment.",
};

/** Log in (docs/design/04-super-admin.md §4.8), with the TOTP step for MFA accounts (PRD-005 FR-1.4). */
export function SignIn() {
  const { isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; totp?: string }>({});

  // Why the last session ended, shown once after the redirect here.
  useEffect(() => {
    const reason = consumeSessionEnd();
    if (!reason) return;
    addToast({
      title: SESSION_END_MESSAGES[reason],
      color: reason === "SIGNED_OUT" ? "success" : "warning",
    });
  }, []);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const submit = async (code?: string) => {
    setSubmitting(true);
    const result = await signIn(email, password, code);
    setSubmitting(false);

    if (result.ok) {
      // No "Signed in" toast (docs/design/04-super-admin.md §4.8).
      navigate(result.mfaRequired ? "/mfa" : "/", { replace: true });
      return;
    }
    if (result.code === "MFA_REQUIRED") {
      setStep("totp");
      return;
    }
    const message = FAILURE_COPY[result.code];
    if (step === "totp") setErrors({ totp: message });
    else setErrors({ password: message });
  };

  const handleCredentials = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = {
      email: email.trim() ? undefined : "Enter your email address.",
      password: password.trim() ? undefined : "Enter your password.",
    };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;
    void submit();
  };

  const handleTotp = (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(totp.trim()) && !/^[a-f0-9]{4}-?[a-f0-9]{4}$/i.test(totp.trim())) {
      setErrors({ totp: "Enter the 6-digit code, or a recovery code." });
      return;
    }
    void submit(totp);
  };

  if (step === "totp") {
    return (
      <AuthLayout
        title="Two-step verification"
        documentTitle="Verify · Zcom Super admin"
        subtitle={`Enter the code from your authenticator app for ${email.trim()}.`}
        productLabel="Super admin"
      >
        <form noValidate className="flex flex-col gap-4" onSubmit={handleTotp}>
          <AuthField
            id="signin-totp"
            type="text"
            inputMode="numeric"
            label="One-time code"
            value={totp}
            onChange={(event) => {
              setTotp(event.target.value);
              if (errors.totp) setErrors({});
            }}
            aria-required
            error={errors.totp}
            autoComplete="one-time-code"
            autoFocus
          />
          <UiButton
            variant="secondary"
            size="lg"
            type="submit"
            isLoading={submitting}
            className="mt-1 w-full border-0 !bg-surface font-semibold !text-fg data-[hover=true]:!bg-surface-sunken"
          >
            Verify
          </UiButton>
          <button
            type="button"
            className="text-caption text-auth-muted underline-offset-2 hover:underline"
            onClick={() => {
              setStep("credentials");
              setTotp("");
              setErrors({});
            }}
          >
            Use a different account
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Log in" documentTitle="Log in · Zcom Super admin" subtitle="Zerror team access only." productLabel="Super admin">
      <form noValidate className="flex flex-col gap-4" onSubmit={handleCredentials}>
        <AuthField
          id="signin-email"
          type="email"
          label="Email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
          }}
          aria-required
          error={errors.email}
          autoComplete="email"
        />

        <AuthField
          id="signin-password"
          type={showPassword ? "text" : "password"}
          label="Password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
          }}
          aria-required
          error={errors.password}
          autoComplete="current-password"
          labelAction={
            // PRD-014 FR-1.10: staff reset their own password by email.
            <Link
              to="/forgot-password"
              className="text-caption text-auth-muted underline-offset-2 hover:underline"
            >
              Forgot password?
            </Link>
          }
          endContent={
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((prev) => !prev)}
              className="rounded-md p-1 text-auth-muted transition-colors hover:text-brand-on"
            >
              {showPassword ? <IconHide className="size-4" /> : <IconView className="size-4" />}
            </button>
          }
        />

        <UiButton
          variant="secondary"
          size="lg"
          type="submit"
          isLoading={submitting}
          className="mt-1 w-full border-0 !bg-surface font-semibold !text-fg data-[hover=true]:!bg-surface-sunken"
        >
          Log in
        </UiButton>
      </form>
    </AuthLayout>
  );
}
