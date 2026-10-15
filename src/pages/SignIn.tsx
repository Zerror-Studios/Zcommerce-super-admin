import { addToast } from "@heroui/react";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";
import { IconHide, IconView } from "../components/ui/icons";
import { Button as UiButton, Input } from "../components/ui";
import { AuthLayout } from "../components/layout/AuthLayout";
import type { AuthBrandPanel } from "../components/layout/AuthLayout";

const brandPanel: AuthBrandPanel = {
  headline: "Every store on the platform, in one view.",
  description: "Clients, billing, plans and platform health for the whole ZCommerce network.",
  previewSrc: "/images/auth/admin-preview.png",
  previewAlt: "ZCommerce Super Admin dashboard",
};

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
    // Same rule as before (both fields filled), reported inline like every other form instead of a toast.
    const nextErrors = {
      email: email.trim() ? undefined : "Enter your email address",
      password: password.trim() ? undefined : "Enter your password",
    };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;
    setSubmitting(true);
    const ok = signIn(email, password);
    setSubmitting(false);
    if (!ok) return;
    addToast({
      title: "Signed in",
      description: "Welcome back to Zcommerce Admin.",
      color: "success",
    });
    navigate("/", { replace: true });
  };

  return (
    <AuthLayout title="Sign in" documentTitle="Sign in — ZCommerce Super Admin" subtitle="Continue to ZCommerce Super Admin" badge="Super Admin" panel={brandPanel}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <Input
          id="signin-email"
          type="email"
          label="Email"
          labelPlacement="outside-top"
          value={email}
          onValueChange={(value) => {
            setEmail(value);
            if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
          }}
          isRequired
          validationBehavior="aria"
          isInvalid={!!errors.email}
          errorMessage={errors.email}
          autoComplete="email"
        />

        <Input
          id="signin-password"
          type={showPassword ? "text" : "password"}
          label="Password"
          labelPlacement="outside-top"
          value={password}
          onValueChange={(value) => {
            setPassword(value);
            if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
          }}
          isRequired
          validationBehavior="aria"
          isInvalid={!!errors.password}
          errorMessage={errors.password}
          autoComplete="current-password"
          endContent={
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((prev) => !prev)}
              className="text-fg-muted transition-colors hover:text-fg"
            >
              {showPassword ? <IconView className="size-4" /> : <IconHide className="size-4" />}
            </button>
          }
        />

        <UiButton variant="primary" size="md" type="submit" className="mt-2 w-full" isLoading={submitting}>
          Sign in
        </UiButton>
      </form>
    </AuthLayout>
  );
}
