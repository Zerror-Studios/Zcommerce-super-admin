import { useEffect, type ReactNode } from "react";

/**
 * Sticky form footer for full-page create forms (02 §7.3): white, 1px top border, padding 12 24, buttons on the
 * right. It takes the page's bottom padding (kept for the AI bar), and the AI bar hides while it is on the page
 * (it uses the save bar's flag, `html[data-zc-savebar]`).
 */
export function FormFooter({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.zcSavebar = "open";
    return () => {
      delete root.dataset.zcSavebar;
    };
  }, []);

  return (
    <div className="sticky bottom-0 z-[var(--zc-z-sticky)] -mx-4 mt-6 -mb-28 flex items-center justify-end gap-2 border-t border-line bg-surface px-6 py-3 md:-mx-6 lg:-mx-8">
      {children}
    </div>
  );
}
