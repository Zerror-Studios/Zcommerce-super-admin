/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Login screen for both dashboards (docs/design/02-components.md §17, ref 02): dark page with a faint dot grid,
 * a 380px centre column with the wordmark and a small card whose spectrum edge slowly rotates.
 */
import { forwardRef, useEffect, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "../ui/cx";

export interface AuthLayoutProps {
  /** Card heading: "Log in". */
  title: ReactNode;
  /** Browser tab title while this page is open. Restored on leave. */
  documentTitle?: string;
  /** One line under the title. */
  subtitle?: ReactNode;
  /** Muted label after the wordmark ("Super admin"). */
  productLabel?: string;
  /** Line under the card (Merchant: "New to Zcom? Start your store"). */
  belowCard?: ReactNode;
  children: ReactNode;
}

export function AuthLayout({ title, documentTitle, subtitle, productLabel, belowCard, children }: AuthLayoutProps) {
  const year = new Date().getFullYear();

  useEffect(() => {
    if (!documentTitle) return;
    const previous = document.title;
    document.title = documentTitle;
    return () => {
      document.title = previous;
    };
  }, [documentTitle]);

  return (
    <div className="relative flex min-h-dvh flex-col bg-auth text-brand-on">
      <div aria-hidden className="auth-dots pointer-events-none absolute inset-0" />

      <main className="relative flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[380px]">
          {/* Text-only logotype: heavy Geist with tight tracking, no "Z" tile. */}
          <div className="mb-[22px] flex items-baseline justify-center gap-2.5">
            <span className="text-[28px] font-extrabold leading-none tracking-[-0.045em] text-brand-on">Zcom</span>
            {productLabel ? <span className="text-label font-medium text-auth-muted">{productLabel}</span> : null}
          </div>

          <section className="auth-edge">
            <div className="auth-edge-body p-7">
              <h1 className="text-login font-semibold text-brand-on">{title}</h1>
              {subtitle ? <p className="mt-1 text-body text-auth-muted">{subtitle}</p> : null}
              <div className="mt-6">{children}</div>
            </div>
          </section>

          {belowCard ? <p className="mt-5 text-center text-body text-auth-muted">{belowCard}</p> : null}
        </div>
      </main>

      <footer className="relative flex justify-center gap-4 pb-6 text-caption text-auth-footer">
        <span>© {year} Zcom</span>
        <span>Privacy</span>
        <span>Terms</span>
      </footer>
    </div>
  );
}

export interface AuthFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  /** Shown under the field in red; the border turns red too. */
  error?: string;
  /** Right side of the label row (e.g. a "Forgot?" link). */
  labelAction?: ReactNode;
  /** Inside the field on the right (e.g. the show-password toggle). */
  endContent?: ReactNode;
}

/** Dark login field: 40px, 8px radius, white text; soft blue focus ring; autofill stays dark. No asterisks. */
export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(function AuthField(
  { label, error, labelAction, endContent, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between">
        <label htmlFor={inputId} className="text-label font-medium text-auth-muted">
          {label}
        </label>
        {labelAction}
      </div>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cx(
            "auth-field h-10 w-full rounded-lg border bg-auth-field px-3 text-sm text-brand-on outline-hidden transition-colors duration-instant placeholder:text-auth-footer",
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
    </div>
  );
});
