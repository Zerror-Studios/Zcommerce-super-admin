/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { useState, type ReactNode } from "react";
import { IconClose, IconSupport } from "../ui/icons";

const HIDDEN_KEY = "zc.support-banner.hidden";

function readHidden(): boolean {
  try {
    return window.sessionStorage.getItem(HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

export interface SupportBannerProps {
  /** The store being viewed. */
  storeName: ReactNode;
  /** Ends the support session. Also offered in the account menu, so hiding the strip never traps anyone. */
  onExit: () => void;
}

/**
 * Support-session strip (docs/design/08-fixes-and-screens.md §1.1): 36px, across the top of the main area,
 * amber. "You're viewing {Store} as Zerror admin. Changes are logged." · Exit · × hides it for this
 * browser session. It scrolls with the page and has no z-index of its own, so dialogs and popovers cover it
 * and it never stacks with a sticky page header (owner 2026-10-27: it showed over the Choose media dialog).
 * Owner 2026-10-29: just that one line; the signed-in email and the repeated "Zerror support" were dropped.
 */
export function SupportBanner({ storeName, onExit }: SupportBannerProps) {
  const [hidden, setHidden] = useState(readHidden);
  if (hidden) return null;
  const hide = () => {
    setHidden(true);
    try {
      window.sessionStorage.setItem(HIDDEN_KEY, "1");
    } catch {
      /* storage blocked: hidden until reload */
    }
  };
  return (
    <div
      role="status"
      className="zc-sec-amber flex min-h-support shrink-0 items-center gap-2.5 border-b border-support-line bg-support px-4 text-label text-support-fg"
    >
      <IconSupport aria-hidden className="size-4 shrink-0" />
      <p className="min-w-0 flex-1 truncate">
        You&apos;re viewing <span className="font-semibold">{storeName}</span> as Zerror admin. Changes are logged.
      </p>
      <button type="button" onClick={onExit} className="shrink-0 rounded-sm font-semibold underline-offset-2 hover:underline">
        Exit
      </button>
      <button
        type="button"
        aria-label="Hide for this session"
        onClick={hide}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm hover:bg-sec-soft"
      >
        <IconClose aria-hidden className="size-3.5" />
      </button>
    </div>
  );
}
