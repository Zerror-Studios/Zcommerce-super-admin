/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Lets a page open the Zcom AI sheet with a question (docs/design-v2/README.md §3.3: contextual AI actions such as
 * "Ask why" or "Write one with AI" stay, because they do one job on one thing; the bar stays the only general entry
 * point). The app shell provides it; `useAskZcomAi()` returns null when the user can't use the assistant, so the page
 * hides its button.
 */
import { createContext, useContext } from "react";

export type AskZcomAi = (question?: string) => void;

export const AskZcomAiContext = createContext<AskZcomAi | null>(null);

export function useAskZcomAi(): AskZcomAi | null {
  return useContext(AskZcomAiContext);
}
