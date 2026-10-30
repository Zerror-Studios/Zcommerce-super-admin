/**
 * Settings save pattern (04 S-07 change 3, 02 §7.1): one kit SaveBar per section, and leaving the section with
 * unsaved changes asks "Discard changes?" first.
 *
 * The console uses <BrowserRouter>, so react-router's useBlocker isn't available. While the page is dirty the
 * guard wraps the router's navigator: a push or replace to another path is held until the user confirms. Hash
 * and query changes on the same path (the settings search) go through. Closing the tab asks the browser's own
 * question.
 */
import { useContext, useEffect, useRef, useState } from "react";
import { UNSAFE_NavigationContext, type Navigator } from "react-router-dom";
import { ConfirmDialog, SaveBar, type SaveBarProps } from "../ui";

type NavigateFn = Navigator["push"];

function targetPath(to: Parameters<NavigateFn>[0]): string {
  if (typeof to === "string") return new URL(to, window.location.href).pathname;
  return to.pathname ? new URL(to.pathname, window.location.href).pathname : window.location.pathname;
}

/** Holds navigation away from the page while `isDirty`; render `dialog` once. */
function useUnsavedChangesGuard(isDirty: boolean) {
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const allowRef = useRef(false);

  useEffect(() => {
    if (!isDirty) return undefined;
    allowRef.current = false;
    const { push, replace } = navigator;
    const hold =
      (navigate: NavigateFn): NavigateFn =>
      (to, state, opts) => {
        if (allowRef.current || targetPath(to) === window.location.pathname) {
          navigate(to, state, opts);
          return;
        }
        setPending(() => () => navigate(to, state, opts));
      };
    navigator.push = hold(push);
    navigator.replace = hold(replace);
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      navigator.push = push;
      navigator.replace = replace;
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [isDirty, navigator]);

  const dialog = (
    <ConfirmDialog
      isOpen={pending != null}
      onClose={() => setPending(null)}
      onConfirm={() => {
        const go = pending;
        setPending(null);
        allowRef.current = true;
        go?.();
      }}
      title="Discard changes?"
      description="Your changes on this page aren't saved."
      confirmLabel="Discard changes"
      cancelLabel="Keep editing"
    />
  );

  return { dialog };
}

export type SettingsSaveBarProps = Omit<SaveBarProps, "isVisible"> & {
  /** Something differs from the saved values. */
  isDirty: boolean;
};

/** The section's one save bar plus the leave guard. Shows while the section has unsaved changes. */
export function SettingsSaveBar({ isDirty, ...rest }: SettingsSaveBarProps) {
  const { dialog } = useUnsavedChangesGuard(isDirty);
  return (
    <>
      <SaveBar isVisible={isDirty} {...rest} />
      {dialog}
    </>
  );
}
