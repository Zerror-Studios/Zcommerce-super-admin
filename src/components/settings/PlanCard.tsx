/**
 * One global plan as a card (04 S-07d change 1): name + version, status and listing badges, monthly and yearly
 * price, six limits, the live store counts, then Edit and the ⋯ menu (Migrate stores, Archive). Plan names show
 * as stored (sentence case waits for Check first 05 #4).
 */
import { PLAN_STATUS_LABELS, PLAN_STATUS_TONES } from "../../lib/plan-catalog.util";
import type { PlatformPlan } from "../../types/platform-api";
import { Button, Chip, RowMenu, formatCount, formatMoney } from "../ui";
import { IconEdit } from "../ui/icons";
import { limitText, planActions, planTitle } from "./plan-card.util";
import { SkelButton, SkelChip, SkelLine } from "../common/SkeletonBits";

export interface PlanCardProps {
  plan: PlatformPlan;
  canManage: boolean;
  onEdit: (plan: PlatformPlan) => void;
  onMigrate: (plan: PlatformPlan) => void;
  onArchive: (plan: PlatformPlan) => void;
}

export function PlanCard({ plan, canManage, onEdit, onMigrate, onArchive }: PlanCardProps) {
  const status = plan.status ?? (plan.isActive ? "ACTIVE" : "ARCHIVED");
  const currency = plan.price.currency;
  const limits: [string, string][] = [
    ["Products", limitText(plan.limits.maxSkus)],
    ["Staff accounts", limitText(plan.limits.maxStaffAccounts)],
    ["Emails a month", limitText(plan.limits.emailsPerMonth)],
    ["SMS a month", limitText(plan.limits.smsPerMonth)],
    ["WhatsApp a month", limitText(plan.limits.whatsappPerMonth)],
    ["AI questions a week", limitText(plan.limits.aiQuestionsPerWeek)],
  ];
  const menu = canManage ? planActions(plan, { edit: onEdit, migrate: onMigrate, archive: onArchive }, { includeEdit: false }) : [];

  return (
    <article className="flex flex-col rounded-card-lg border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="min-w-0 truncate text-title-3 text-fg">{planTitle(plan)}</h4>
        <Chip tone="neutral" dot={false}>
          v{plan.version ?? 1}
        </Chip>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Chip tone={PLAN_STATUS_TONES[status]}>{PLAN_STATUS_LABELS[status]}</Chip>
        <Chip tone="neutral">{plan.isPublic === false ? "Unlisted" : "Public"}</Chip>
      </div>

      <p className="mt-4 flex items-baseline gap-1">
        <span className="text-kpi-l text-fg num">{formatMoney(plan.price.monthly, { currency })}</span>
        <span className="text-label text-fg-muted">/ month</span>
      </p>
      <p className="text-label text-fg-muted num">{formatMoney(plan.price.yearly, { currency })} / year</p>

      <dl className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 border-t border-line-subtle pt-4 text-label">
        {limits.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="truncate text-fg-muted">{label}</dt>
            <dd className="text-fg num">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-auto border-t border-line-subtle pt-4">
        <p className="text-label text-fg-muted num">
          {formatCount(plan.tenantCount ?? 0)} {plan.tenantCount === 1 ? "store" : "stores"} · {formatCount(plan.subscriberCount ?? 0)}{" "}
          {plan.subscriberCount === 1 ? "subscriber" : "subscribers"} · {formatCount(plan.pendingCount ?? 0)} moving in
        </p>
        {canManage ? (
          <div className="mt-3 flex items-center justify-end gap-2">
            {status !== "ARCHIVED" ? (
              <Button variant="secondary" size="sm" startIcon={<IconEdit aria-hidden />} onPress={() => onEdit(plan)}>
                Edit
              </Button>
            ) : null}
            {menu.length ? <RowMenu items={menu} label={`Actions for ${planTitle(plan)} v${plan.version ?? 1}`} /> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

const LIMIT_LABELS = ["Products", "Staff accounts", "Emails a month", "SMS a month", "WhatsApp a month", "AI questions a week"];

/** Loading pass (2026-11-10): a plan card's layout with its real labels; the plan's own values are placeholders. */
export function PlanCardSkeleton({ canManage }: { canManage: boolean }) {
  return (
    <article aria-hidden className="flex flex-col rounded-card-lg border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <SkelLine text="text-title-3" className="w-32" />
        <SkelChip className="w-8" />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <SkelChip />
        <SkelChip className="w-14" />
      </div>
      <p className="mt-4 flex items-baseline gap-1">
        <SkelLine text="text-kpi-l" className="w-28" />
        <span className="text-label text-fg-muted">/ month</span>
      </p>
      <SkelLine text="text-label" className="w-24" />
      <dl className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 border-t border-line-subtle pt-4 text-label">
        {LIMIT_LABELS.map((label) => (
          <div key={label} className="contents">
            <dt className="truncate text-fg-muted">{label}</dt>
            <dd>
              <SkelLine text="text-label" className="w-12" />
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-auto border-t border-line-subtle pt-4">
        <SkelLine text="text-label" className="w-3/4" />
        {canManage ? (
          <div className="mt-3 flex items-center justify-end gap-2">
            <SkelButton size="sm" className="w-16" />
            <SkelButton size="sm" className="w-8" />
          </div>
        ) : null}
      </div>
    </article>
  );
}
