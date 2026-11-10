/**
 * Ask ZCOM usage bar for staff (backend PRD-026 FR-7.2, guide §12)
 *
 * Round 3 B4: the same quota row as merchants (<AiQuota>): "11% of this month's
 * AI budget used" · "resets 1 Dec" (never "30L"). When the chat can't answer
 * (budget used up, resting, switched off, unavailable) it says why; with
 * `platform:ai:manage` the budget message links to AI settings
 * (`zerrorMonthlyTokenBudget`).
 */

import { Link } from "react-router-dom";

import { AiQuota } from "../ui/AiQuota";
import { cx } from "../ui/cx";
import { assistantUsageText } from "../../lib/platform-insights.util";
import type { PlatformAssistantUsage } from "../../types/platform-insights";

// ─── Constants ────────────────────────────────────────────────────────────

const AI_SETTINGS_PATH = "/settings/ai";

// ─── Types ────────────────────────────────────────────────────────────────

interface AiUsageBarProps {
  usage: PlatformAssistantUsage;
  /** Shows the AI settings link when the budget is used up. */
  canManageAi?: boolean;
  /** Closes the panel before leaving for settings. */
  onNavigate?: () => void;
}

/** "resets 1 Dec" in India time, like the rest of the console. */
function resetsLabel(iso: string): string | undefined {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return undefined;
  return `resets ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(at)}`;
}

// ─── Component ────────────────────────────────────────────────────────────

export function AiUsageBar({ usage, canManageAi = false, onNavigate }: AiUsageBarProps) {
  const percent = Math.max(0, Math.min(100, usage.budgetUsedPercent));
  const text = assistantUsageText(usage);
  return (
    <div className="flex flex-col gap-2 border-b border-line px-4 py-3">
      {usage.available ? (
        <AiQuota
          label={`${Math.round(percent)}% of this month's AI budget used`}
          resets={resetsLabel(usage.monthResetsAt)}
          percentUsed={percent}
          tone={percent >= 80 ? "warning" : "default"}
          barLabel="Internal AI budget used this month"
        />
      ) : (
        <p className={cx("text-label text-fg-muted")}>{text}</p>
      )}
      {!usage.available && usage.reason === "AI_TOKEN_BUDGET_EXHAUSTED" && canManageAi ? (
        <Link
          to={AI_SETTINGS_PATH}
          onClick={onNavigate}
          className="text-label font-medium text-brand underline-offset-2 hover:underline"
        >
          Raise the budget in AI settings
        </Link>
      ) : null}
    </div>
  );
}

export default AiUsageBar;
