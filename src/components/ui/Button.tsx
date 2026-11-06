/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Button as HeroButton } from "@heroui/react";
import type { ButtonProps as HeroButtonProps } from "@heroui/react";
import {
  forwardRef,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { buttonClasses, resolveButtonVariant, type ButtonSize, type ButtonVariant } from "./button-variants";
import { cx } from "./cx";
import { ButtonShortLabelContext } from "./short-label";
import { IconExternalArrow } from "./icons";

/**
 * Capsule button (round 2 G10, styles in src/styles/components.css `.zc-btn`). One button system:
 * - primary: blue fill; one per view (Save, Create order, Send)
 * - secondary: light blue; other actions next to the primary (Pause, Preview, Show all)
 * - ghost: transparent, blue text, light blue hover; inline and text actions (See all, Documentation)
 * - dark: ink; only Mark done, Log out, Connect Claude
 * - on-dark: white fill, ink text; buttons on gradient/AI cards and the Home/SA hero
 * - danger: red fill; only the delete / discard confirmation button
 * - icon: the circle `IconButton` (⋯, filter, sort, edit, delete, close)
 * The old names still compile and render the new look: tertiary/link → ghost, destructive → danger,
 * glass/secondary-on-dark → on-dark, ai/outline/destructive-secondary/danger-outline → secondary.
 */
export type { ButtonSize, ButtonVariant, ButtonVariantName, LegacyButtonVariant } from "./button-variants";

export interface ButtonProps
  extends Omit<HeroButtonProps, "variant" | "color" | "size" | "radius" | "startContent" | "endContent"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  /** Opens another site or tab: adds a trailing ↗ and target="_blank" rel="noopener". Use with href. */
  external?: boolean;
  /** LEGACY alias for isDisabled, accepted during migration. */
  disabled?: boolean;
}

/** The spinner shows only if the action is still running after 250ms, then stays at least 400ms (01 §7.1). */
const SPINNER_DELAY_MS = 250;
const SPINNER_MIN_MS = 400;

function useDelayedSpinner(busy: boolean): boolean {
  const [shown, setShown] = useState(false);
  const shownAt = useRef(0);
  useEffect(() => {
    if (busy) {
      const timer = window.setTimeout(() => {
        shownAt.current = Date.now();
        setShown(true);
      }, SPINNER_DELAY_MS);
      return () => window.clearTimeout(timer);
    }
    if (!shown) return undefined;
    const left = SPINNER_MIN_MS - (Date.now() - shownAt.current);
    if (left <= 0) {
      setShown(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setShown(false), left);
    return () => window.clearTimeout(timer);
  }, [busy, shown]);
  return shown;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    startIcon,
    endIcon,
    external,
    disabled,
    isDisabled,
    isLoading = false,
    fullWidth,
    className,
    style,
    onPress,
    onClick,
    children,
    ...rest
  },
  forwardedRef,
) {
  const innerRef = useRef<HTMLButtonElement | null>(null);
  const spinner = useDelayedSpinner(isLoading);
  const shortLabel = useContext(ButtonShortLabelContext);
  const short = shortLabel && resolveButtonVariant(variant) === "primary" ? shortLabel : undefined;
  // Lock the width while busy so the button never jumps when the spinner replaces the icon.
  const [lockedWidth, setLockedWidth] = useState<number>();
  useLayoutEffect(() => {
    setLockedWidth(isLoading ? innerRef.current?.offsetWidth : undefined);
  }, [isLoading]);

  const setRef = (node: HTMLButtonElement | null) => {
    innerRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  const leading = spinner ? <span aria-hidden className="zc-spinner" /> : startIcon;
  const trailing = external ? (endIcon ?? <IconExternalArrow aria-hidden />) : endIcon;
  const externalProps = external ? { target: "_blank", rel: "noopener noreferrer" } : null;

  return (
    <HeroButton
      ref={setRef}
      variant="light"
      disableAnimation
      disableRipple
      startContent={leading}
      endContent={trailing}
      isDisabled={isDisabled ?? disabled}
      aria-busy={isLoading || undefined}
      // The short label keeps the full one as the accessible name.
      aria-label={short ? (rest["aria-label"] ?? (typeof children === "string" ? children : undefined)) : rest["aria-label"]}
      // Busy buttons ignore extra clicks, without the disabled look.
      onPress={isLoading ? undefined : onPress}
      onClick={isLoading ? undefined : onClick}
      fullWidth={fullWidth}
      style={lockedWidth ? { ...style, width: lockedWidth } : style}
      className={cx(buttonClasses(variant, size), fullWidth && "zc-btn--full", className)}
      {...externalProps}
      {...rest}
    >
      {short ?? children}
    </HeroButton>
  );
});

export interface ButtonLinkProps extends Omit<ComponentProps<typeof Link>, "className" | "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * A link that looks like a button (01 §7.1): a real router <a> with the same capsule classes, so middle-click and
 * "open in new tab" work. Use it for navigation-only actions ("View full report ›", "See all", "View").
 */
export function ButtonLink({ variant = "secondary", size = "md", startIcon, endIcon, children, className, ...rest }: ButtonLinkProps) {
  return (
    <Link className={cx(buttonClasses(variant, size), className)} {...rest}>
      {startIcon}
      <span>{children}</span>
      {endIcon}
    </Link>
  );
}
