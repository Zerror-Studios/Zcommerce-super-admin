import type { ModalProps } from "@heroui/react";

/** Shared HeroUI Modal chrome, same as ui/Modal (docs/design/02-components.md §11): 16px radius, title 16/600. */
export const dashboardModalClassNames: NonNullable<ModalProps["classNames"]> = {
  backdrop: "bg-overlay/40",
  base: "rounded-2xl border-0 bg-surface !shadow-modal mx-4",
  header:
    "flex flex-col gap-0.5 px-6 pt-5 pb-2 pr-14 text-base font-semibold text-fg",
  body: "px-6 py-2 gap-4 text-sm",
  footer: "px-6 pb-5 pt-3 gap-2 justify-end",
  closeButton:
    "top-4 end-4 z-20 size-8 rounded-lg text-fg-muted hover:bg-surface-sunken hover:text-fg",
};

export const dashboardModalProps: Pick<
  ModalProps,
  "placement" | "scrollBehavior" | "classNames"
> = {
  placement: "center",
  scrollBehavior: "inside",
  classNames: dashboardModalClassNames,
};
