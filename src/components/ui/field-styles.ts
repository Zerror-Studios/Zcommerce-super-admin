/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Token-based classNames for HeroUI Input / Select / Autocomplete (docs/design/02-components.md §7).
 *
 * Inputs and selects: 36px, 8px radius, 1px strong border, white, 14px, placeholder in the placeholder grey.
 * Focus: 1px primary border + 3px focus ring. Invalid: red border (no red fill). Label above 13/500,
 * helper 12px secondary, error 12px red.
 *
 * Notes:
 * - HeroUI merges these with tailwind-merge, which does not know our custom font-size names
 *   (text-body, text-label, …) and treats them as colors. Inside HeroUI slots we therefore use
 *   text-sm / text-xs / text-[13px], which tailwind-merge reads as font sizes.
 * - The same applies to radius names: inside HeroUI components use rounded-lg (8px) and rounded-xl (12px).
 * - `!` is needed to beat HeroUI's built-in variant classes. Compound variants
 *   (focus + hover, invalid + focus) make the intended state win regardless of CSS order.
 */

export type FieldSize = "sm" | "md" | "lg";

/** Control height per size: 32 / 36 / 40px. Appended after the md default below. */
export const fieldHeight: Record<FieldSize, string> = {
  sm: "h-8 min-h-8",
  md: "h-9 min-h-9",
  lg: "h-10 min-h-10",
};

/* The hover compound keeps the ring while the pointer is still over a field it just focused. */
const focusRing = `
  group-data-[focus=true]:!shadow-focus
  group-data-[focus=true]:data-[hover=true]:!shadow-focus
`;

const fieldInput = `
  bg-transparent
  h-full
  outline-hidden
  text-sm
  !text-fg
  placeholder:!text-fg-placeholder
`;

/* No red asterisks (docs/design/02-components.md §7): required stays in aria; optional fields say "(optional)". */
const fieldLabel = "text-[13px] leading-5 font-medium !text-fg w-full after:!hidden after:!content-none";

/** Text field: white, strong border; primary border + ring on focus; red border when invalid. */
export const getInputClasses = (className = "") => ({
  input: fieldInput,
  inputWrapper: `
    w-full
    min-h-9
    h-9
    px-3
    rounded-lg
    border
    !shadow-none
    z-10
    !bg-surface
    !border-line-strong
    transition-colors
    duration-instant
    ease-standard
    ${className}

    data-[hover=true]:!bg-surface
    data-[hover=true]:!border-line-strong
    group-data-[filled-within=true]:!bg-surface

    group-data-[focus=true]:!bg-surface
    group-data-[focus=true]:!border-brand
    group-data-[focus=true]:data-[hover=true]:!border-brand
    ${focusRing}

    group-data-[invalid=true]:!bg-surface
    group-data-[invalid=true]:!border-tone-danger
    group-data-[invalid=true]:data-[hover=true]:!border-tone-danger
    group-data-[invalid=true]:group-data-[focus=true]:!border-tone-danger
  `,
  label: fieldLabel,
  errorMessage: "text-xs !text-tone-danger-text",
  description: "text-xs !text-fg-muted",
});

/** Select / Dropdown trigger: same box as the text field; primary border while open. */
export const getDropdownClasses = (className = "") => ({
  trigger: `
    ${className}
    w-full
    rounded-lg
    border
    px-3
    py-0
    min-h-9
    h-9
    !shadow-none
    !bg-surface
    !border-line-strong
    transition-colors
    duration-instant
    ease-standard

    data-[hover=true]:!border-line-strong

    data-[focus=true]:!border-brand
    data-[focus=true]:data-[hover=true]:!border-brand
    data-[open=true]:!border-brand
    data-[open=true]:data-[hover=true]:!border-brand

    data-[focus-visible=true]:!shadow-focus

    group-data-[invalid=true]:!border-tone-danger
  `,
  value: "text-sm !text-fg",
  selectorIcon: "!text-fg-muted",
  label: fieldLabel,
  errorMessage: "text-xs !text-tone-danger-text",
});

/** Select trigger for modal forms. Same look as getDropdownClasses. */
export const getSelectClasses = (className = "") => {
  const dropdown = getDropdownClasses(className);
  return {
    trigger: dropdown.trigger,
    label: dropdown.label,
    value: dropdown.value,
    selectorIcon: dropdown.selectorIcon,
    errorMessage: dropdown.errorMessage,
  };
};

/** Search field: 34px, white, strong border, 8px radius; primary border + ring on focus (also while hovered). */
export const getSearchInputClasses = (className = "") => ({
  inputWrapper: `
    ${className}
    rounded-lg
    border
    px-2.5
    min-h-[34px]
    h-[34px]
    !shadow-none
    !bg-surface
    !border-line-strong
    transition-colors
    duration-instant
    ease-standard

    data-[hover=true]:!bg-surface
    data-[hover=true]:!border-line-strong

    group-data-[focus=true]:!bg-surface
    group-data-[focus=true]:!border-brand
    group-data-[focus=true]:data-[hover=true]:!bg-surface
    group-data-[focus=true]:data-[hover=true]:!border-brand
    ${focusRing}
  `,
  input: fieldInput,
  label: fieldLabel,
});

/** Sidebar search (dark rail, 32px). The top bar search is removed in the shell phase. */
export const getDarkSearchInputClasses = (className = "") => ({
  inputWrapper: `
    rounded-lg
    min-h-8
    h-8
    px-2.5
    !shadow-none
    border
    !border-nav-border
    !bg-nav-surface
    transition-colors
    duration-instant
    ease-standard
    ${className}

    data-[hover=true]:!bg-nav-hover

    group-data-[focus=true]:!border-brand
    group-data-[focus=true]:data-[hover=true]:!bg-nav-surface
  `,
  input: `
    bg-transparent
    h-full
    outline-hidden
    text-[13px]
    !text-nav-fg-strong
    placeholder:!text-nav-fg-muted
  `,
  label: "text-[13px] font-medium !text-nav-fg-strong",
});

/**
 * Search field in table toolbars (Store Dashboard table header, Super Admin TableToolbar):
 * 34px, 240px wide from sm up (full width on phones), page-specific placeholder ("Search orders").
 * LEGACY: use <SearchInput placement="toolbar"> instead; kept for call sites not moved yet.
 */
export const getTableSearchClasses = (className = "") => ({
  base: "w-full sm:w-search sm:shrink-0",
  inputWrapper: `
    rounded-lg
    border
    px-2.5
    min-h-[34px]
    h-[34px]
    !shadow-none
    !bg-surface
    !border-line-strong
    transition-colors
    duration-instant
    ease-standard

    data-[hover=true]:!bg-surface
    data-[hover=true]:!border-line-strong

    group-data-[focus=true]:!bg-surface
    group-data-[focus=true]:!border-brand
    group-data-[focus=true]:data-[hover=true]:!bg-surface
    group-data-[focus=true]:data-[hover=true]:!border-brand
    ${focusRing}
    ${className}
  `,
  input: fieldInput,
  clearButton: "text-fg-muted",
});

/** Leading magnifier for search fields (15px, tertiary). */
export const tableSearchIconClass = "size-[15px] shrink-0 text-fg-subtle";

/**
 * HeroUI draws an "outside" label inside the box when there is no placeholder, so without one the field
 * gets an invisible placeholder: the label always sits above, like every other field.
 */
export const OUTSIDE_LABEL_PLACEHOLDER = " ";
