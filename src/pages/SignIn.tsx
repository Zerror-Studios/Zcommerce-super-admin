import { addToast } from "@heroui/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth, type SignInFailure } from "../providers/AuthProvider";
import { IconHide, IconView } from "../components/ui/icons";
import { Button as UiButton } from "../components/ui";
import { AuthField, AuthLayout } from "../components/layout/AuthLayout";
import { AuthBuddy, AuthCodeInput, AuthReveal, type AuthBuddyMood } from "../components/layout/AuthBuddy";
import { SESSION_END_MESSAGES, consumeSessionEnd } from "../lib/auth-channel";
import { toasts } from "../copy";

/** One field at a time, like a chat (owner, 2026-11-04): email, then password, then the code for MFA accounts. */
type Step = "email" | "password" | "totp";

const FAILURE_COPY: Record<Exclude<SignInFailure, "MFA_REQUIRED">, string> = {
  INVALID: toasts.wrongLogin,
  INVALID_TOTP: "That code didn't work. Enter the current code from your authenticator app.",
  ACCOUNT_DISABLED: "This account has been disabled. Ask a platform owner to restore it.",
  RATE_LIMITED: "Too many attempts. Wait a minute and try again.",
  UNAVAILABLE: "Can't reach the platform right now. Try again in a moment.",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sign in (docs/design-v2/README.md §5): the black screen with the "Platform" wordmark; the orb character asks one
 * question at a time and each field opens after the one before it. The two-step code (PRD-005 FR-1.4) opens in the same card when the server asks for it.
 */
export function SignIn() {
  const { isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<"email" | "password" | "totp" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; totp?: string }>({});
  const passwordRef = useRef<HTMLInputElement>(null);
  const totpRef = useRef<HTMLInputElement>(null);
  /** A recovery code ("a1b2-c3d4") doesn't fit the six digit boxes, so it gets a text field. */
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);

  // Why the last session ended, shown once after the redirect here.
  useEffect(() => {
    const reason = consumeSessionEnd();
    if (!reason) return;
    addToast({
      title: SESSION_END_MESSAGES[reason],
      color: reason === "SIGNED_OUT" ? "success" : "warning",
    });
  }, []);

  // The field that just opened gets the cursor.
  useEffect(() => {
    const target = step === "password" ? passwordRef : step === "totp" ? totpRef : null;
    if (target) window.setTimeout(() => target.current?.focus(), 50);
  }, [step]);

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
      setErrors({});
      setStep("totp");
      return;
    }
    const message = FAILURE_COPY[result.code];
    if (step === "totp") setErrors({ totp: message });
    else setErrors({ password: message });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (step === "email") {
      const emailError = !email.trim()
        ? "Enter your email address."
        : EMAIL_PATTERN.test(email.trim())
          ? undefined
          : "Enter a valid email address.";
      setErrors({ email: emailError });
      if (!emailError) setStep("password");
      return;
    }
    if (step === "password") {
      const passwordError = password.trim() ? undefined : "Enter your password.";
      setErrors({ password: passwordError });
      if (!passwordError) void submit();
      return;
    }
    if (!/^\d{6}$/.test(totp.trim()) && !/^[a-f0-9]{4}-?[a-f0-9]{4}$/i.test(totp.trim())) {
      setErrors({ totp: "Enter the 6-digit code, or a recovery code." });
      return;
    }
    void submit(totp);
  };

  const startOver = () => {
    setStep("email");
    setPassword("");
    setTotp("");
    setUseRecoveryCode(false);
    setErrors({});
  };

  // What the orb says, one question at a time (v2 §5). A wrong sign-in never says whether the email or the
  // password was wrong.
  const failed = errors.email || errors.password || errors.totp;
  const wrongLogin = errors.password === FAILURE_COPY.INVALID;
  const localPart = email.trim().split("@")[0]?.split(/[._+\-\d]/).find(Boolean) ?? "";
  const thanks = localPart ? `Thanks, ${localPart[0].toUpperCase()}${localPart.slice(1).toLowerCase()}. ` : "";
  const buddy: { message: string; mood: AuthBuddyMood } = submitting
    ? { message: "Getting the platform ready", mood: "thinking" }
    : failed
      ? {
          message:
            step === "email" ? "That email doesn't look right." : wrongLogin ? "That didn't match. Let's try again." : (failed ?? ""),
          mood: "sad",
        }
      : step === "email"
        ? { message: "Hi. What's your email?", mood: "idle" }
        : step === "password"
          ? focused === "password" && !showPassword
            ? { message: `${thanks}Now your password. I'm not looking.`, mood: "shy" }
            : { message: `${thanks}Now your password.`, mood: "idle" }
          : useRecoveryCode
            ? { message: "Type a recovery code.", mood: "idle" }
            : { message: "Now the 6-digit code.", mood: "idle" };
  const follow = step === "email" && email ? Math.min(1, email.length / 32) : undefined;

  return (
    <AuthLayout
      title="Sign in"
      hideTitle
      documentTitle={step === "totp" ? "Verify · Zcom Platform" : "Sign in · Zcom Platform"}
      subtitle="Zerror team access only."
      productLabel="Platform"
      belowCard={
        step === "password" ? (
          // PRD-014 FR-1.10: staff reset their own password by email.
          <Link to="/forgot-password" className="hover:text-brand-on hover:underline">
            Forgot password?
          </Link>
        ) : undefined
      }
    >
      <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <AuthBuddy message={buddy.message} mood={buddy.mood} follow={follow} className="mb-3" />

        <AuthField
          id="signin-email"
          type="email"
          label="Email"
          hideLabel
          placeholder="Email address"
          value={email}
          autoFocus
          readOnly={step === "totp"}
          onChange={(event) => {
            setEmail(event.target.value);
            if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
          }}
          onFocus={() => setFocused("email")}
          onBlur={() => setFocused(null)}
          aria-required
          error={errors.email}
          autoComplete="email"
        />

        <AuthReveal open={step !== "email"}>
          <AuthField
            ref={passwordRef}
            id="signin-password"
            type={showPassword ? "text" : "password"}
            label="Password"
            hideLabel
            placeholder="Password"
            value={password}
            readOnly={step === "totp"}
            onChange={(event) => {
              setPassword(event.target.value);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            onFocus={() => setFocused("password")}
            onBlur={() => setFocused(null)}
            aria-required
            // A red field edge on a wrong sign-in; the orb says what happened (v2 §5).
            error={wrongLogin ? undefined : errors.password}
            aria-invalid={errors.password ? true : undefined}
            className={wrongLogin ? "[&_input]:!border-auth-error" : undefined}
            autoComplete="current-password"
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
        </AuthReveal>

        {/* The two-step code, in the same card (was a separate screen) */}
        <AuthReveal open={step === "totp"}>
          {useRecoveryCode ? (
            <AuthField
              ref={totpRef}
              id="signin-totp"
              type="text"
              label="Recovery code"
              hideLabel
              placeholder="Recovery code, e.g. a1b2-c3d4"
              value={totp}
              onChange={(event) => {
                setTotp(event.target.value);
                if (errors.totp) setErrors({});
              }}
              onFocus={() => setFocused("totp")}
              onBlur={() => setFocused(null)}
              aria-required
              error={errors.totp}
              autoComplete="off"
            />
          ) : (
            // Six boxes (owner, 2026-11-04); the last digit sends the code.
            <AuthCodeInput
              ref={totpRef}
              label="One-time code"
              value={totp}
              onChange={(code) => {
                setTotp(code);
                if (errors.totp) setErrors({});
              }}
              onComplete={(code) => {
                if (!submitting) void submit(code);
              }}
              error={errors.totp}
            />
          )}
          <button
            type="button"
            className="mt-2 text-caption text-auth-muted underline-offset-2 hover:underline"
            onClick={() => {
              setUseRecoveryCode((current) => !current);
              setTotp("");
              setErrors({});
              window.setTimeout(() => totpRef.current?.focus(), 50);
            }}
          >
            {useRecoveryCode ? "Use the 6-digit code instead" : "Use a recovery code instead"}
          </button>
        </AuthReveal>

        <UiButton
          variant="secondary"
          size="lg"
          type="submit"
          isLoading={submitting}
          className="mt-1 w-full border-0 !bg-surface font-semibold !text-fg data-[hover=true]:!bg-surface-sunken"
        >
          {step === "email" ? "Continue" : step === "password" ? "Sign in" : "Verify"}
        </UiButton>

        {step === "totp" ? (
          <button
            type="button"
            className="text-caption text-auth-muted underline-offset-2 hover:underline"
            onClick={startOver}
          >
            Use a different account
          </button>
        ) : null}
      </form>
    </AuthLayout>
  );
}
