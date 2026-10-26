import { addToast } from "@heroui/react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button as UiButton } from "../components/ui";
import { AuthField, AuthLayout } from "../components/layout/AuthLayout";
import { PLATFORM_SET_PASSWORD } from "../graphql/auth";
import { toasts } from "../copy";
import { client, errorCodeOf, errorReasonOf } from "../lib/apollo-client";
import { passwordErrorReasonEnum, passwordPolicyError } from "../lib/password-policy";

/**
 * Invite or reset link → choose a password (PRD-005 FR-1.5; reset links
 * from PRD-014 FR-1.10). Public: the token is the credential. One policy,
 * 8+ characters (`lib/password-policy`); a reset ends every other session.
 */
export function SetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Read once: the token is then dropped from the URL (W1V-C-04).
  const [token] = useState(() => searchParams.get("token") ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
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

  if (!token) {
    return (
      <AuthLayout title="Set your password" documentTitle="Set password · Zcom Super admin" subtitle="This link is missing its token. Open the invite link exactly as it was sent." productLabel="Super admin">
        <UiButton variant="secondary" size="lg" className="w-full" onPress={() => navigate("/sign-in")}>
          Go to log in
        </UiButton>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set your password" documentTitle="Set password · Zcom Super admin" subtitle="Choose the password for your Zerror platform account." productLabel="Super admin">
      <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <AuthField
          id="set-password"
          type="password"
          label="New password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
          }}
          aria-required
          error={errors.password}
          autoComplete="new-password"
          autoFocus
        />
        <AuthField
          id="set-password-confirm"
          type="password"
          label="Confirm password"
          value={confirm}
          onChange={(event) => {
            setConfirm(event.target.value);
            if (errors.confirm) setErrors((prev) => ({ ...prev, confirm: undefined }));
          }}
          aria-required
          error={errors.confirm ?? errors.form}
          autoComplete="new-password"
        />
        <UiButton
          variant="secondary"
          size="lg"
          type="submit"
          isLoading={submitting}
          className="mt-1 w-full border-0 !bg-surface font-semibold !text-fg data-[hover=true]:!bg-surface-sunken"
        >
          Save password
        </UiButton>
        <Link
          to="/forgot-password"
          className="text-center text-caption text-auth-muted underline-offset-2 hover:underline"
        >
          Link expired? Request a new one
        </Link>
      </form>
    </AuthLayout>
  );
}
