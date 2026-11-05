/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Sign-in screen for both apps (docs/design-v2/README.md §5): pure black and full screen. "Zcom" as a bold 24px
 * wordmark at the top left (with "Platform" in the Super Admin), "Welcome to the new era of e-commerce." small at the
 * bottom right, and a soft blue halo behind the centre column, where the orb character asks one question at a time.
 * No card, no marketing panel, no Google or Apple buttons.
 */
import { forwardRef, useEffect, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "../ui/cx";

export interface AuthLayoutProps {
  /** The page heading ("Reset your password"). On the sign-in steps the orb asks the question, so it is hidden. */
  title: ReactNode;
  /** Keep the heading for screen readers only (the orb character says it). */
  hideTitle?: boolean;
  /** Browser tab title while this page is open. Restored on leave. */
  documentTitle?: string;
  /** One line under the title. */
  subtitle?: ReactNode;
  /** Muted label after the wordmark ("Platform"). */
  productLabel?: string;
  /** Small grey links under the form ("New to Zcom? Start a store"). */
  belowCard?: ReactNode;
  children: ReactNode;
}

export function AuthLayout({ title, hideTitle = false, documentTitle, subtitle, productLabel, belowCard, children }: AuthLayoutProps) {
  useEffect(() => {
    if (!documentTitle) return;
    const previous = document.title;
    document.title = documentTitle;
    return () => {
      document.title = previous;
    };
  }, [documentTitle]);

  return (
    <div className="zc-auth relative flex min-h-dvh flex-col overflow-hidden bg-auth text-brand-on">
      <div aria-hidden className="zc-auth__halo" />

      {/* Wordmark: bold 24px, no Z tile. */}
      <header className="relative flex items-baseline gap-2 px-6 pt-6 md:px-10 md:pt-8">
        <span className="text-[24px] font-bold leading-none tracking-[-0.04em] text-brand-on">Zcom</span>
        {productLabel ? <span className="text-label font-medium text-auth-muted">{productLabel}</span> : null}
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[400px]">
          <h1 className={cx(hideTitle ? "sr-only" : "text-title-1 text-brand-on")}>{title}</h1>
          {subtitle ? <p className={cx("text-body text-auth-muted", hideTitle ? "sr-only" : "mt-1")}>{subtitle}</p> : null}
          <div className={hideTitle ? undefined : "mt-6"}>{children}</div>
          {belowCard ? <div className="mt-6 flex flex-col items-center gap-2 text-center text-label text-auth-muted">{belowCard}</div> : null}
        </div>
      </main>

      <footer className="relative flex justify-end px-6 pb-6 text-caption text-auth-footer md:px-10 md:pb-8">
        <span>Welcome to the new era of e-commerce.</span>
      </footer>
    </div>
  );
}

export interface AuthFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  /** Keep the label for screen readers only (the login helper asks the question); `labelAction` moves under the field. */
  hideLabel?: boolean;
  /** Shown under the field in red; the border turns red too. */
  error?: string;
  /** Right side of the label row (e.g. a "Forgot?" link). */
  labelAction?: ReactNode;
  /** Inside the field on the right (e.g. the show-password toggle). */
  endContent?: ReactNode;
}

/** Dark sign-in field: 48px, 12px radius, white text; soft blue focus ring; a red edge on error; autofill stays dark. */
export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(function AuthField(
  { label, hideLabel = false, error, labelAction, endContent, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      {hideLabel ? (
        <label htmlFor={inputId} className="sr-only">
          {label}
        </label>
      ) : (
        <div className="flex items-center justify-between">
          <label htmlFor={inputId} className="text-label font-medium text-auth-muted">
            {label}
          </label>
          {labelAction}
        </div>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cx(
            "auth-field h-12 w-full rounded-field border bg-auth-field px-4 text-base text-brand-on outline-hidden transition-colors duration-instant placeholder:text-auth-footer",
            "focus:border-auth-focus focus:shadow-auth-focus",
            error ? "border-auth-error" : "border-auth-field-line",
            endContent ? "pr-10" : undefined,
          )}
          {...rest}
        />
        {endContent ? <div className="absolute inset-y-0 right-2 flex items-center">{endContent}</div> : null}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-caption text-auth-error">
          {error}
        </p>
      ) : null}
      {hideLabel && labelAction ? <div className="flex justify-end">{labelAction}</div> : null}
    </div>
  );
});
