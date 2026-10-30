/** The page header's Export and the tab that serves it (04 S-06). */
import { useEffect, type MutableRefObject, type ReactNode } from "react";

/** The page's Export runs whatever the visible tab registered here. */
export type AiExportRef = MutableRefObject<(() => void | Promise<void>) | null>;

/** Props every tab of the table card receives. */
export interface AiTabProps {
  /** The tab switch, on the left of the toolbar row. */
  tabs: ReactNode;
  exportRef: AiExportRef;
}

/** Registers the tab's export while it is shown. */
export function useAiExport(exportRef: AiExportRef, run: () => void | Promise<void>) {
  useEffect(() => {
    exportRef.current = run;
    return () => {
      if (exportRef.current === run) exportRef.current = null;
    };
  }, [exportRef, run]);
}

/** "ai-usage-2026-10-30.csv" */
export function datedCsvName(base: string, now: Date = new Date()): string {
  return `${base}-${now.toISOString().slice(0, 10)}.csv`;
}
