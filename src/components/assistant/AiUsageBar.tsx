/**
 * Ask ZCOM usage bar for staff (backend PRD-026 FR-7.2, guide §12)
 *
 * Unlike merchants, staff see the internal budget: "AI budget: 42% of this
 * month's 3M tokens used · resets 1 Dec". When the chat can't answer
 * (budget used up, resting, switched off, unavailable) it says why; with
 * `platform:ai:manage` the budget message links to AI settings
 * (`zerrorMonthlyTokenBudget`).
 */

import { Link } from "react-router-dom";

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

// ─── Component ────────────────────────────────────────────────────────────

export function AiUsageBar({ usage, canManageAi = false, onNavigate }: AiUsageBarProps) {
  const percent = Math.max(0, Math.min(100, usage.budgetUsedPercent));
  const text = assistantUsageText(usage);
  return (
    <div className="flex flex-col gap-2 border-b border-line px-4 py-3">
      <p className={cx("text-label", usage.available ? "text-fg" : "text-fg-muted")}>{text}</p>
      {usage.available ? (
        <div
          className="h-1 rounded-full bg-surface-sunken"
          role="progressbar"
          aria-label="Internal AI budget used this month"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={cx("h-1 rounded-full", percent >= 80 ? "bg-tone-warning-dot" : "bg-fg")}
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}
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
