import { addToast } from "@heroui/react";
import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button as UiButton } from "../components/ui";
import { AuthField, AuthLayout } from "../components/layout/AuthLayout";
import { PLATFORM_SET_PASSWORD } from "../graphql/auth";
import { client, errorCodeOf } from "../lib/apollo-client";

const MIN_PASSWORD_LENGTH = 12;

/** Invite or reset link → choose a password (PRD-005 FR-1.5). Public: the token is the credential. */
export function SetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; form?: string }>({});

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (password.length < MIN_PASSWORD_LENGTH) {
      nextErrors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
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
      addToast({ title: "Password set. Log in to continue.", color: "success" });
      navigate("/sign-in", { replace: true });
    } catch (error) {
      const code = errorCodeOf(error);
      setErrors({
        form:
          code === "BAD_USER_INPUT"
            ? "This link is invalid or has expired. Ask a platform owner for a new invite."
            : "Can't reach the platform right now. Try again in a moment.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout title="Set your password" documentTitle="Set password · Zcommerce Super admin" subtitle="This link is missing its token. Open the invite link exactly as it was sent." productLabel="Super admin">
        <UiButton variant="secondary" size="lg" className="w-full" onPress={() => navigate("/sign-in")}>
          Go to log in
        </UiButton>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set your password" documentTitle="Set password · Zcommerce Super admin" subtitle="Choose the password for your Zerror platform account." productLabel="Super admin">
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
      </form>
    </AuthLayout>
  );
}
