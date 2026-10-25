/**
 * Forgot password (PRD-014 FR-1.10, PRD-014 §5.2 "Platform staff recovery")
 *
 * Public page: asks `platformRequestPasswordReset` to email a reset link.
 * The server answers `true` whether or not the email has an account, so
 * the page always shows the same confirmation and never says which.
 * The emailed link opens `/set-password?token=…` (`platformSetPassword`).
 */

import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button as UiButton } from "../components/ui";
import { AuthField, AuthLayout } from "../components/layout/AuthLayout";
import { PLATFORM_REQUEST_PASSWORD_RESET } from "../graphql/auth";
import { client } from "../lib/apollo-client";
import { looksLikeEmail } from "../lib/password-policy";

const SUBMIT_CLASSES =
  "mt-1 w-full border-0 !bg-surface font-semibold !text-fg data-[hover=true]:!bg-surface-sunken";

// ─── Page ─────────────────────────────────────────────────────────────────

export function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    if (!looksLikeEmail(address)) {
      setError("Enter the email address of your platform account.");
      return;
    }
    setSubmitting(true);
    setError(undefined);
    try {
      await client.mutate({
        mutation: PLATFORM_REQUEST_PASSWORD_RESET,
        variables: { email: address },
        context: { skipAuth: true },
      });
      setSentTo(address);
    } catch (failure) {
      const status = (failure as { networkError?: { statusCode?: number } })
        ?.networkError?.statusCode;
      setError(
        status === 429
          ? "Too many requests. Wait a few minutes and try again."
          : "Can't reach the platform right now. Try again in a moment.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (sentTo) {
    return (
      <AuthLayout
        title="Check your email"
        documentTitle="Reset password · Zcommerce Super admin"
        subtitle={`If ${sentTo} has a platform account, we've sent it a link to choose a new password. The link works once.`}
        productLabel="Super admin"
      >
        <UiButton
          variant="secondary"
          size="lg"
          className={SUBMIT_CLASSES}
          onPress={() => navigate("/sign-in")}
        >
          Back to log in
        </UiButton>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      documentTitle="Reset password · Zcommerce Super admin"
      subtitle="Enter your platform account's email and we'll send you a reset link."
      productLabel="Super admin"
    >
      <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <AuthField
          id="forgot-email"
          type="email"
          label="Email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (error) setError(undefined);
          }}
          aria-required
          error={error}
          autoComplete="email"
          autoFocus
        />
        <UiButton
          variant="secondary"
          size="lg"
          type="submit"
          isLoading={submitting}
          className={SUBMIT_CLASSES}
        >
          Send reset link
        </UiButton>
        <button
          type="button"
          className="text-caption text-auth-muted underline-offset-2 hover:underline"
          onClick={() => navigate("/sign-in")}
        >
          Back to log in
        </button>
      </form>
    </AuthLayout>
  );
}
