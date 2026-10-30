/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { ComponentType, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button, ButtonLink } from "./Button";
import { cx } from "./cx";
import { IconExpand, IconSuccess } from "./icons";
import { formatCount } from "./money";
import { Skeleton } from "./Skeleton";
import { Tooltip } from "./Tooltip";

/**
 * "Needs your attention" (01 §7.23): one component, two layouts, used by both Homes. An AI card (1px gradient ring,
 * padding 20) with a 28px AI tile, the title and a "checked … ago" line; then the items in urgency order — red
 * (urgent), orange (medium), blue (needs a look), newest first within a colour — and an optional one-line system
 * note in the footer.
 * - layout="stacked" (admin side card): at most 5 rows of 64px; the whole row is the link; the count sits in a
 *   fixed 64px column, right-aligned, so the digits line up.
 * - layout="row" (super admin, full width): at most 3 tiles; the tile itself isn't clickable, only its one
 *   secondary sm action; tiles stack below 760px of card width, and the action moves under the text in tiles
 *   narrower than 340px.
 */
export type AttentionUrgency = "red" | "orange" | "blue";

export interface AttentionItem {
  id: string;
  urgency: AttentionUrgency;
  title: ReactNode;
  text?: ReactNode;
  /** Stacked rows: the number in the 64px column. */
  count?: number;
  /** Stacked rows: where the row goes. */
  href?: string;
  /** Row tiles: the 16px glyph in the white circle. */
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  /** Row tiles: the one action. */
  action?: { label: string; href?: string; onPress?: () => void };
}

export interface AttentionListProps {
  items: AttentionItem[];
  layout: "stacked" | "row";
  /** The header line: "Zcom AI checked your store 5 min ago". */
  checkedLabel?: ReactNode;
  footerNote?: { text: string; actionLabel?: string; href?: string; onPress?: () => void };
  /** "See all (8) ›" in the header when there are more items than the layout shows. */
  seeAll?: { label: string; href?: string; onPress?: () => void };
  /** Shown when there's nothing ("All clear. Nothing needs your attention right now."). */
  emptyText?: string;
  loading?: boolean;
  title?: string;
  className?: string;
}

const ORDER: Record<AttentionUrgency, number> = { red: 0, orange: 1, blue: 2 };
const MAX_ITEMS = { stacked: 5, row: 3 } as const;

const tone = {
  red: { soft: "bg-tone-danger-soft", text: "text-tone-danger-text" },
  orange: { soft: "bg-tone-warning-soft", text: "text-tone-warning" },
  blue: { soft: "bg-tone-info-soft", text: "text-tone-info" },
} as const;

/** The 28px gradient tile with a white sparkle (the AI mark). */
function AiTile() {
  return (
    <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[image:var(--zc-ai-gradient)]">
      <svg viewBox="0 0 24 24" className="size-3.5 fill-white">
        <path d="M12 2.5l2.1 5.6 5.6 2.1-5.6 2.1L12 17.9l-2.1-5.6-5.6-2.1 5.6-2.1z" />
      </svg>
    </span>
  );
}

function ActionButton({ action }: { action: NonNullable<AttentionItem["action"]> }) {
  return action.href ? (
    <ButtonLink variant="secondary" size="sm" to={action.href}>
      {action.label}
    </ButtonLink>
  ) : (
    <Button variant="secondary" size="sm" onPress={action.onPress}>
      {action.label}
    </Button>
  );
}

export function AttentionList({
  items,
  layout,
  checkedLabel,
  footerNote,
  seeAll,
  emptyText = "All clear. Nothing needs your attention right now.",
  loading = false,
  title = "Needs your attention",
  className,
}: AttentionListProps) {
  const shown = [...items].sort((a, b) => ORDER[a.urgency] - ORDER[b.urgency]).slice(0, MAX_ITEMS[layout]);
  const seeAllButton = seeAll ? (
    seeAll.href ? (
      <ButtonLink variant="tertiary" size="sm" to={seeAll.href} endIcon={<IconExpand aria-hidden />}>
        {seeAll.label}
      </ButtonLink>
    ) : (
      <Button variant="tertiary" size="sm" onPress={seeAll.onPress} endIcon={<IconExpand aria-hidden />}>
        {seeAll.label}
      </Button>
    )
  ) : null;

  return (
    <section aria-label={title} className={cx("zc-ai-card flex flex-col p-5", className)}>
      <header className="flex items-start gap-3">
        <AiTile />
        <div className="min-w-0 flex-1">
          <h2 className="text-title-3 text-fg">{title}</h2>
          {checkedLabel ? <p className="text-label text-fg-muted">{checkedLabel}</p> : null}
        </div>
        {seeAllButton}
      </header>

      <div className="zc-attention-body mt-4 flex flex-1 flex-col">
        {loading ? (
          <div className={layout === "row" ? "zc-attention-tiles" : "flex flex-col gap-2"}>
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className={cx("w-full rounded-xl", layout === "row" ? "h-24" : "h-16")} />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <p className="flex items-center gap-2 text-body text-fg-muted">
            <IconSuccess aria-hidden className="size-5 shrink-0 text-tone-success" />
            {emptyText}
          </p>
        ) : layout === "stacked" ? (
          <ul className="flex flex-col gap-2">
            {shown.map((item) => {
              const body = (
                <>
                  <span className={cx("w-16 shrink-0 text-right text-kpi-l num", tone[item.urgency].text)}>
                    {item.count != null ? formatCount(item.count) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cx("block text-body-strong", tone[item.urgency].text)}>{item.title}</span>
                    {item.text ? (
                      <Tooltip content={item.text} placement="top-start">
                        <span className="block truncate text-label text-fg-muted">{item.text}</span>
                      </Tooltip>
                    ) : null}
                  </span>
                  <IconExpand aria-hidden className={cx("size-4 shrink-0", tone[item.urgency].text)} />
                </>
              );
              const rowClass = cx(
                "flex min-h-16 items-center gap-3 rounded-xl px-4 py-3 transition-[filter,transform] duration-fast ease-standard",
                tone[item.urgency].soft,
              );
              return (
                <li key={item.id}>
                  {item.href ? (
                    <Link
                      to={item.href}
                      className={cx(
                        rowClass,
                        "hover:brightness-[0.96] active:scale-[var(--zc-press-scale-card)] focus-visible:shadow-focus-strong focus-visible:outline-none",
                      )}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className={rowClass}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="zc-attention-tiles">
            {shown.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id} className={cx("zc-attention-tile rounded-xl p-4", tone[item.urgency].soft)}>
                  <div className="zc-attention-tile__inner">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span aria-hidden className={cx("flex size-8 shrink-0 items-center justify-center rounded-full bg-surface", tone[item.urgency].text)}>
                        {Icon ? <Icon aria-hidden className="size-4" /> : null}
                      </span>
                      <span className="min-w-0">
                        <span className={cx("block text-body-strong", tone[item.urgency].text)}>{item.title}</span>
                        {item.text ? <span className="line-clamp-2 text-label text-fg-muted">{item.text}</span> : null}
                      </span>
                    </div>
                    {item.action ? (
                      <div className="zc-attention-tile__action">
                        <ActionButton action={item.action} />
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {footerNote ? (
        <footer className="mt-4 flex items-center gap-2 border-t border-line-subtle pt-3">
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-tone-warning-dot" />
          <Tooltip content={footerNote.text} placement="top-start">
            <span className="min-w-0 flex-1 truncate text-label text-fg-muted">{footerNote.text}</span>
          </Tooltip>
          {footerNote.actionLabel ? (
            footerNote.href ? (
              <ButtonLink variant="tertiary" size="sm" to={footerNote.href} endIcon={<IconExpand aria-hidden />}>
                {footerNote.actionLabel}
              </ButtonLink>
            ) : (
              <Button variant="tertiary" size="sm" onPress={footerNote.onPress} endIcon={<IconExpand aria-hidden />}>
                {footerNote.actionLabel}
              </Button>
            )
          ) : null}
        </footer>
      ) : null}
    </section>
  );
}
