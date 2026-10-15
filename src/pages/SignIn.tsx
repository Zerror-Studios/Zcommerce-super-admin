import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";
import { IconHide, IconView } from "../components/ui/icons";
import { Button as UiButton } from "../components/ui";
import { AuthField, AuthLayout } from "../components/layout/AuthLayout";

export function SignIn() {
  const { isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    // Same rule as before (both fields filled), reported inline.
    const nextErrors = {
      email: email.trim() ? undefined : "Enter your email address.",
      password: password.trim() ? undefined : "Enter your password.",
    };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;
    setSubmitting(true);
    const ok = signIn(email, password);
    setSubmitting(false);
    if (!ok) {
      setErrors({ password: "Couldn't log in. Check your email and password." });
      return;
    }
    // No "Signed in" toast (docs/design/04-super-admin.md §4.8).
    navigate("/", { replace: true });
  };

  return (
    <AuthLayout title="Log in" documentTitle="Log in · Zcommerce Super admin" subtitle="Zerror team access only." productLabel="Super admin">
      <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit}>
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
