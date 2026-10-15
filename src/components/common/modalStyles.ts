import type { ModalProps } from "@heroui/react";

/** Shared HeroUI Modal chrome (component-specs §11): white surface, 16px radius, modal shadow. */
export const dashboardModalClassNames: NonNullable<ModalProps["classNames"]> = {
  backdrop: "bg-overlay/50",
  base: "rounded-card border-0 bg-surface shadow-modal mx-4",
  header:
    "flex flex-col gap-1 px-6 pt-6 pb-2 text-xl font-bold text-fg",
  body: "px-6 py-3 gap-4",
  footer: "px-6 pb-6 pt-3 gap-3",
  closeButton:
    "top-4 end-4 z-20 rounded-full text-fg-muted hover:bg-tone-neutral-soft hover:text-fg",
};

export const dashboardModalProps: Pick<
  ModalProps,
  "placement" | "scrollBehavior" | "classNames"
> = {
  placement: "center",
  scrollBehavior: "inside",
  classNames: dashboardModalClassNames,
};
