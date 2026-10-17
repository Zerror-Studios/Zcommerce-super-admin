/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { ReactNode } from "react";
import { Accordion, AccordionItem, Switch, Tooltip } from "@heroui/react";
import { cx } from "./cx";
import { IconInfo } from "./icons";

export interface CardWrapperProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Right-aligned header content (buttons, filters, links). */
  endContent?: ReactNode;
  /** Body padding/layout. Defaults to 20px (spec card body); use "p-0" for a full-bleed table. */
  bodyClassName?: string | null;
  children?: ReactNode;
  className?: string;

  // Switch support
  showSwitch?: boolean;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;

  // Accordion support
  accordion?: boolean;
  defaultOpen?: boolean;

  // Info support
  info?: ReactNode;
}

/** Card frame shared by every card in both dashboards (docs/design/02-components.md §4): white, 1px border, 12px radius, no shadow. */
export const cardFrameClasses = "bg-surface border border-line rounded-card";

/**
 * Titled card: header (16px 20px) with a 14/600 title, optional description, switch, info tooltip and
 * end content, then the body (20px). No icon tiles, no nested cards.
 */
export function CardWrapper({
  title = null,
  description = null,
  endContent = null,
  bodyClassName,
  children,
  showSwitch = false,
  switchValue = false,
  onSwitchChange,
  accordion = false,
  defaultOpen = false,
  className = "",
  info = null,
}: CardWrapperProps) {
  const headerContent = (
    <div className="flex items-center justify-between gap-4 w-full">
      <div>
        <div className="flex items-center gap-3">
          <h3 className="text-body font-semibold text-fg">{title}</h3>
          {showSwitch && (
            <Switch
              size="sm"
              aria-label="toggle option"
              isSelected={switchValue}
              onValueChange={onSwitchChange}
              classNames={{
                base: "scale-75 origin-left",
              }}
            />
          )}
          {info && (
            <Tooltip radius="sm" color="foreground" content={info} delay={400} closeDelay={0}>
              <button type="button" aria-label="More information" className="text-fg-subtle transition-colors hover:text-fg">
                <IconInfo size={14} />
              </button>
            </Tooltip>
          )}
        </div>

        {description && <p className="mt-0.5 text-label text-fg-muted">{description}</p>}
      </div>

      {endContent && <div className="shrink-0">{endContent}</div>}
    </div>
  );

  if (accordion) {
    return (
      <Accordion
        defaultExpandedKeys={defaultOpen ? ["card"] : []}
        className={cx(cardFrameClasses, "!px-0", className)}
        itemClasses={{
          title: "w-full",
          trigger: "px-5 py-4",
          content: bodyClassName === undefined ? "px-5 pb-5" : (bodyClassName ?? undefined),
          indicator: "text-fg text-sm",
        }}
      >
        <AccordionItem key="card" title={headerContent}>
          {children}
        </AccordionItem>
      </Accordion>
    );
  }

  return (
    <div className={cx(cardFrameClasses, "w-full", !/(^|\s)h-/.test(className) && "h-fit", className)}>
      {title && (
        <div className="px-5 py-4">{headerContent}</div>
      )}
      {children ? <div className={bodyClassName === undefined ? (title ? "px-5 pb-5" : "p-5") : (bodyClassName ?? undefined)}>{children}</div> : null}
    </div>
  );
}

export default CardWrapper;
