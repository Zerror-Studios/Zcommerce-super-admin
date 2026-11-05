import { addToast } from "@heroui/react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button as UiButton } from "../components/ui";
import { AuthBuddy, type AuthBuddyMood } from "../components/layout/AuthBuddy";
import { AuthField, AuthLayout } from "../components/layout/AuthLayout";
import { PLATFORM_SET_PASSWORD } from "../graphql/auth";
import { toasts } from "../copy";
import { client, errorCodeOf, errorReasonOf } from "../lib/apollo-client";
import { passwordErrorReasonEnum, passwordPolicyError } from "../lib/password-policy";

/** The white sign-in button (same as SignIn). */
const SUBMIT_CLASSES =
  "mt-1 w-full border-0 !bg-surface font-semibold !text-fg data-[hover=true]:!bg-surface-sunken";
const DOCUMENT_TITLE = "Set password · Zcom Platform";

const requestNewLink = (
  <Link to="/forgot-password" className="hover:text-brand-on hover:underline">
    Link expired? Request a new one
  </Link>
);

/**
 * Invite or reset link → choose a password (PRD-005 FR-1.5; reset links
 * from PRD-014 FR-1.10). Public: the token is the credential. One policy,
 * 8+ characters (`lib/password-policy`); a reset ends every other session.
 * Design v2 §5: the sign-in look; the orb says each line and looks away while the password is typed.
 */
export function SetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Read once: the token is then dropped from the URL (W1V-C-04).
  const [token] = useState(() => searchParams.get("token") ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; form?: string }>({});

  // W1V-C-04: keep the one-time token out of the address bar and history.
  useEffect(() => {
    if (!window.location.search) return;
    const { pathname, hash } = window.location;
    window.history.replaceState(window.history.state, "", `${pathname}${hash}`);
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    const policyError = passwordPolicyError(password);
    if (policyError) nextErrors.password = policyError;
    if (confirm !== password) nextErrors.confirm = "The passwords don't match.";
    setErrors(nextErrors);
    if (nextErrors.password || nextErrors.confirm) return;

    setSubmitting(true);
    try {
      await client.mutate({
        mutation: PLATFORM_SET_PASSWORD,
        variables: { token, password },
        context: { skipAuth: true },
      });
      addToast({ title: toasts.passwordSet, color: "success" });
      navigate("/sign-in", { replace: true });
    } catch (error) {
      const code = errorCodeOf(error);
      if (errorReasonOf(error) === passwordErrorReasonEnum.WEAK_PASSWORD) {
        // The server's policy wins if it is stricter than the form's.
        setErrors({ password: (error as Error).message });
      } else {
        setErrors({
          form:
            code === "BAD_USER_INPUT"
              ? "This link is invalid or has expired. Request a new reset link, or ask a platform owner for a new invite."
              : "Can't reach the platform right now. Try again in a moment.",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // What the orb says (v2 §5): one line at a time; the eyes close while the password is typed.
  const failed = errors.form ?? errors.password ?? errors.confirm;
  const buddy: { message: string; mood: AuthBuddyMood } = submitting
    ? { message: "Saving your password", mood: "thinking" }
    : failed
      ? { message: "That didn't work. Let's try again.", mood: "sad" }
      : focused
        ? { message: "Choose a new password. I'm not looking.", mood: "shy" }
        : { message: "Choose a new password.", mood: "idle" };

  if (!token) {
    return (
      <AuthLayout
        title="Set your password"
        hideTitle
        documentTitle={DOCUMENT_TITLE}
        productLabel="Platform"
        belowCard={requestNewLink}
      >
        <div className="flex flex-col gap-4">
          <AuthBuddy message="This link is missing a piece." mood="sad" className="mb-3" />
          <p className="text-center text-body text-auth-muted">
            Open the invite or reset link exactly as it was sent, or request a new one.
          </p>
          <UiButton variant="secondary" size="lg" className={SUBMIT_CLASSES} onPress={() => navigate("/sign-in")}>
            Go to log in
          </UiButton>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Set your password"
      hideTitle
      documentTitle={DOCUMENT_TITLE}
      subtitle="Choose the password for your Zerror platform account."
      productLabel="Platform"
      belowCard={requestNewLink}
    >
      <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <AuthBuddy message={buddy.message} mood={buddy.mood} className="mb-3" />
        <AuthField
          id="set-password"
          type="password"
          label="New password"
          hideLabel
          placeholder="New password, 8 or more characters"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-required
          error={errors.password}
          autoComplete="new-password"
          autoFocus
        />
        <AuthField
          id="set-password-confirm"
          type="password"
          label="Confirm password"
          hideLabel
          placeholder="Type it again"
          value={confirm}
          onChange={(event) => {
            setConfirm(event.target.value);
            if (errors.confirm) setErrors((prev) => ({ ...prev, confirm: undefined }));
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-required
          error={errors.confirm ?? errors.form}
          autoComplete="new-password"
        />
        <UiButton variant="secondary" size="lg" type="submit" isLoading={submitting} className={SUBMIT_CLASSES}>
          Save password
        </UiButton>
      </form>
    </AuthLayout>
  );
}
