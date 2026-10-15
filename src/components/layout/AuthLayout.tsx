/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export interface AuthBrandPanel {
  headline: string;
  description: string;
  /** Product screenshot (public path), shown in a window frame that runs off the panel's right and bottom edges. */
  previewSrc: string;
  previewAlt: string;
}

export interface AuthLayoutProps {
  /** Form heading, e.g. "Sign in". */
  title: ReactNode;
  /** Browser tab title while this page is open, e.g. "Sign in — ZCommerce". Restored on leave. */
  documentTitle?: string;
  subtitle?: ReactNode;
  /** Product badge after the wordmark (same as the Topbar badge), e.g. "Super Admin". */
  badge?: string;
  /** Product story on the dark side panel (hidden below lg). */
  panel: AuthBrandPanel;
  children: ReactNode;
}

/**
 * Sign-in screen shared by both dashboards, fixed to the viewport height: the form on a white surface (left)
 * and a dark brand panel (right, lg and up) with the product headline and a framed product screenshot.
 */
export function AuthLayout({ title, documentTitle, subtitle, badge, panel, children }: AuthLayoutProps) {
  const year = new Date().getFullYear();

  useEffect(() => {
    if (!documentTitle) return;
    const previous = document.title;
    document.title = documentTitle;
    return () => {
      document.title = previous;
    };
  }, [documentTitle]);
  // Hide the frame (instead of showing a broken image) until the screenshot file exists.
  const [previewFailed, setPreviewFailed] = useState(false);

  return (
    <div className="grid h-dvh grid-cols-1 overflow-hidden bg-surface lg:grid-cols-5">
      {/* Form side (2/5 from lg up) */}
      <div className="flex h-dvh min-h-0 flex-col px-6 py-8 sm:px-12 lg:col-span-2">
        <header className="flex items-center gap-3">
          <span className="text-xl font-bold text-fg">ZCOMMERCE</span>
          {badge ? (
            <span className="inline-flex h-6 items-center rounded-full bg-brand-soft px-2 text-caption font-medium uppercase text-brand-text">
              {badge}
            </span>
          ) : null}
        </header>

        <main className="flex min-h-0 flex-1 items-center justify-center py-6">
          <div className="w-full max-w-sm">
            <h1 className="text-title font-bold text-fg">{title}</h1>
            {subtitle ? <p className="mt-1 text-body text-fg-muted">{subtitle}</p> : null}
            <div className="mt-8">{children}</div>
          </div>
        </main>

        <footer className="flex flex-col gap-1 text-caption text-fg-muted">
          <p>
            By continuing, you agree to the <span className="font-medium text-fg">Terms of Service</span> and{" "}
            <span className="font-medium text-fg">Privacy Policy</span>.
          </p>
          <p>
            © {year} ·{" "}
            <a
              href="https://www.zerrorstudios.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-fg hover:underline"
            >
              Zerror Studios
            </a>
          </p>
        </footer>
      </div>

      {/* Brand panel (3/5 from lg up) */}
      <aside className="hidden h-dvh min-h-0 lg:col-span-3 lg:block">
        <div className="relative flex h-full flex-col overflow-hidden bg-topbar text-topbar-fg">
          {/* Decorative: brand glow + grid lines */}
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-brand opacity-30 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-brand opacity-20 blur-3xl" />
          <svg aria-hidden className="pointer-events-none absolute inset-0 size-full text-topbar-fg opacity-10">
            <defs>
              <pattern id="auth-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M40 0H0V40" fill="none" stroke="currentColor" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#auth-grid)" />
          </svg>

          <div className="relative max-w-lg shrink-0 px-12 pt-12">
            <h2 className="text-display font-bold text-topbar-fg">{panel.headline}</h2>
            <p className="mt-4 text-subtitle text-topbar-fg-muted">{panel.description}</p>
          </div>

          {/* Product window: anchored top-left, cropped by the panel on the right and bottom. */}
          <div className="relative mt-10 min-h-0 flex-1">
            {!previewFailed ? (
              <div className="absolute -right-96 left-12 top-0 rounded-tile border border-topbar-control bg-topbar-control p-2 shadow-modal">
                <img
                  src={panel.previewSrc}
                  alt={panel.previewAlt}
                  onError={() => setPreviewFailed(true)}
                  className="block w-full rounded-lg"
                  draggable={false}
                />
              </div>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}
