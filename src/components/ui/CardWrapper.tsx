/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { ReactNode } from "react";
import { Accordion, AccordionItem, Switch, Tooltip } from "@heroui/react";
import { cx } from "./cx";
import { IconInfo } from "./icons";

export interface CardWrapperProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Right-aligned header content (buttons, filters, links). */
  endContent?: ReactNode;
  /** Body padding/layout. Defaults to 32px sides, 24px top and bottom; use "p-0" for a full-bleed table. */
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

/** Card frame shared by every card in both dashboards: white surface, 1px border (same as table cards), 8px radius. */
export const cardFrameClasses = "bg-surface border border-line rounded-lg";

/**
 * Titled card (Store Dashboard "Revenue over time" style): header row with title, optional description,
 * switch, info tooltip and end content, a divider, then the body.
 */
export function CardWrapper({
  title = null,
  description = null,
  endContent = null,
  bodyClassName = "p-8 py-6",
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
          <h3 className="text-[1.05rem] font-bold leading-tight">{title}</h3>
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
            <Tooltip showArrow={true} radius="sm" color="foreground" content={info} closeDelay={0}>
              <button className="text-fg-muted hover:text-fg-muted transition-colors">
                <IconInfo size={16} />
              </button>
            </Tooltip>
          )}
        </div>

        {description && <p className="mt-1 text-body text-fg-muted leading-tight">{description}</p>}
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
          trigger: `
      px-8 py-4
      data-[open=true]:border-b
      data-[open=true]:border-line
    `,
          content: bodyClassName ?? undefined,
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
        <div className={cx("px-8 py-4", children ? "border-b border-line" : "")}>{headerContent}</div>
      )}
      {children ? <div className={bodyClassName ?? undefined}>{children}</div> : null}
    </div>
  );
}

export default CardWrapper;
