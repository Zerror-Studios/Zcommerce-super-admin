/**
 * Forgot password (PRD-014 FR-1.10, PRD-014 §5.2 "Platform staff recovery")
 *
 * Public page: asks `platformRequestPasswordReset` to email a reset link.
 * The server answers `true` whether or not the email has an account, so
 * the page always shows the same confirmation and never says which.
 * The emailed link opens `/set-password?token=…` (`platformSetPassword`).
 *
 * Design v2 §5: the sign-in look. The orb asks the one question ("What's
 * your email?"), says when it is sending and when the link is on its way;
 * "Back to log in" is a small grey link under the form.
 */

import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button as UiButton } from "../components/ui";
import { AuthBuddy, type AuthBuddyMood } from "../components/layout/AuthBuddy";
import { AuthField, AuthLayout } from "../components/layout/AuthLayout";
import { PLATFORM_REQUEST_PASSWORD_RESET } from "../graphql/auth";
import { client } from "../lib/apollo-client";
import { looksLikeEmail } from "../lib/password-policy";

/** The white sign-in button (same as SignIn). */
const SUBMIT_CLASSES =
  "mt-1 w-full border-0 !bg-surface font-semibold !text-fg data-[hover=true]:!bg-surface-sunken";
const DOCUMENT_TITLE = "Reset password · Zcom Platform";

const backToLogIn = (
  <Link to="/sign-in" className="hover:text-brand-on hover:underline">
    Back to log in
  </Link>
);

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
        hideTitle
        documentTitle={DOCUMENT_TITLE}
        productLabel="Platform"
      >
        <div className="flex flex-col gap-4">
          <AuthBuddy message="Check your email." mood="happy" className="mb-3" />
          <p className="text-center text-body text-auth-muted">
            If {sentTo} has a platform account, we've sent it a link to choose a new password. The link works once.
          </p>
          <UiButton variant="secondary" size="lg" className={SUBMIT_CLASSES} onPress={() => navigate("/sign-in")}>
            Back to log in
          </UiButton>
        </div>
      </AuthLayout>
    );
  }

  const buddy: { message: string; mood: AuthBuddyMood } = submitting
    ? { message: "Sending your link", mood: "thinking" }
    : error
      ? { message: "That didn't work. Let's try again.", mood: "sad" }
      : { message: "Forgot it? What's your email?", mood: "idle" };

  return (
    <AuthLayout
      title="Reset your password"
      hideTitle
      documentTitle={DOCUMENT_TITLE}
      subtitle="Enter your platform account's email and we'll send you a reset link."
      productLabel="Platform"
      belowCard={backToLogIn}
    >
      <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <AuthBuddy
          message={buddy.message}
          mood={buddy.mood}
          follow={email ? Math.min(1, email.length / 32) : undefined}
          className="mb-3"
        />
        <AuthField
          id="forgot-email"
          type="email"
          label="Email"
          hideLabel
          placeholder="Email address"
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
        <UiButton variant="secondary" size="lg" type="submit" isLoading={submitting} className={SUBMIT_CLASSES}>
          Send reset link
        </UiButton>
      </form>
    </AuthLayout>
  );
}
