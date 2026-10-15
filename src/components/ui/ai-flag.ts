/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Feature flag `ai` (docs/design/README.md Phase 7): every AI surface renders only when this is on.
 * On when the build sets VITE_FEATURE_AI=true, or for one browser via localStorage "zc-feature-ai" = "1"
 * (toggle on /dev/ui). Off by default, so nothing changes for users until the assistant backend exists.
 */
import { useSyncExternalStore } from "react";

const STORAGE_KEY = "zc-feature-ai";
const EVENT = "zc-feature-ai-change";

function read(): boolean {
  if (import.meta.env?.VITE_FEATURE_AI === "true") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function isAiEnabled(): boolean {
  return read();
}

/** Turns the flag on or off for this browser (development and demos). */
export function setAiEnabled(enabled: boolean) {
  try {
    if (enabled) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable: the flag stays as it is */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** React hook: re-renders when the flag changes. */
export function useAiEnabled(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
