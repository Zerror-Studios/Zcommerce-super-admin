/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Token-based classNames for HeroUI Input / Select / Autocomplete (docs/design/02-components.md §7).
 *
 * Inputs and selects (v2, 01 §7.4): 36px (40 on phone, with 16px text so iOS doesn't zoom), 10px radius, 1px
 * border that darkens on hover, white, 14px. Focus: primary border + 3px ring. Invalid: red border, red ring while
 * focused. Label above 13/500 with a red * when required; helper 12px subtle; error 12px red. Search is a capsule.
 *
 * Notes:
 * - HeroUI merges these with tailwind-merge, which does not know our custom font-size names
 *   (text-body, text-label, …) and treats them as colors. Inside HeroUI slots we therefore use
 *   text-sm / text-xs / text-[13px], which tailwind-merge reads as font sizes.
 * - The same applies to radius and height names: inside HeroUI slots use arbitrary values that read the tokens
 *   (rounded-[var(--zc-radius-field)], h-[var(--zc-control-h)]); tailwind-merge recognises those.
 * - `!` is needed to beat HeroUI's built-in variant classes. Compound variants
 *   (focus + hover, invalid + focus) make the intended state win regardless of CSS order.
 */

export type FieldSize = "sm" | "md" | "lg";

/** Control height per size: 32 / 36 / 40px. Appended after the md default below. */
export const fieldHeight: Record<FieldSize, string> = {
  sm: "h-[var(--zc-control-h-sm)] min-h-[var(--zc-control-h-sm)]",
  md: "h-[var(--zc-control-h)] min-h-[var(--zc-control-h)]",
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
  max-md:text-base
  !text-fg
  placeholder:!text-fg-placeholder
`;

/* v2 (01 §7.4): required fields get a red * after the label (HeroUI adds it for isRequired); optional ones carry no marker. */
const fieldLabel = "text-[13px] leading-4.5 font-medium !text-fg w-full after:!text-tone-danger-dot";

/** Text field: white, strong border; primary border + ring on focus; red border when invalid. */
export const getInputClasses = (className = "") => ({
  input: fieldInput,
  inputWrapper: `
    w-full
    min-h-[var(--zc-control-h)]
    h-[var(--zc-control-h)]
    px-3
    rounded-[var(--zc-radius-field)]
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
    data-[hover=true]:!border-field-line-hover
    group-data-[filled-within=true]:!bg-surface

    group-data-[focus=true]:!bg-surface
    group-data-[focus=true]:!border-brand
    group-data-[focus=true]:data-[hover=true]:!border-brand
    ${focusRing}

    group-data-[invalid=true]:!bg-surface
    group-data-[invalid=true]:!border-tone-danger-dot
    group-data-[invalid=true]:data-[hover=true]:!border-tone-danger-dot
    group-data-[invalid=true]:group-data-[focus=true]:!border-tone-danger-dot
    group-data-[invalid=true]:group-data-[focus=true]:!shadow-[var(--zc-focus-ring-danger)]

    group-data-[disabled=true]:!bg-surface-muted
    group-data-[disabled=true]:!border-line
  `,
  label: fieldLabel,
  errorMessage: "text-xs !text-tone-danger-text",
  description: "text-xs !text-fg-subtle",
});

/** Select / Dropdown trigger: same box as the text field; primary border while open. */
export const getDropdownClasses = (className = "") => ({
  trigger: `
    ${className}
    w-full
    rounded-[var(--zc-radius-field)]
    border
    px-3
    py-0
    min-h-[var(--zc-control-h)]
    h-[var(--zc-control-h)]
    !shadow-none
    !bg-surface
    !border-line-strong
    transition-colors
    duration-instant
    ease-standard

    data-[hover=true]:!border-field-line-hover

    data-[focus=true]:!border-brand
    data-[focus=true]:data-[hover=true]:!border-brand
    data-[open=true]:!border-brand
    data-[open=true]:data-[hover=true]:!border-brand

    data-[focus-visible=true]:!shadow-focus

    group-data-[invalid=true]:!border-tone-danger-dot
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

/** Search field (01 §7.5): capsule, 36px (32px in table toolbars), border darkens on hover; primary border + ring on focus. */
export const getSearchInputClasses = (className = "") => ({
  inputWrapper: `
    ${className}
    rounded-full
    border
    px-3
    gap-2
    min-h-[var(--zc-control-h)]
    h-[var(--zc-control-h)]
    !shadow-none
    !bg-surface
    !border-line-strong
    transition-colors
    duration-instant
    ease-standard

    data-[hover=true]:!bg-surface
    data-[hover=true]:!border-field-line-hover

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
    rounded-full
    min-h-8
    h-8
    px-3
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
    rounded-full
    border
    px-3
    gap-2
    min-h-[var(--zc-control-h-sm)]
    h-[var(--zc-control-h-sm)]
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

/** Leading magnifier for search fields (16px, subtle), 12px from the left edge. */
export const tableSearchIconClass = "size-4 shrink-0 text-fg-subtle";

/**
 * HeroUI draws an "outside" label inside the box when there is no placeholder, so without one the field
 * gets an invisible placeholder: the label always sits above, like every other field.
 */
export const OUTSIDE_LABEL_PLACEHOLDER = " ";
