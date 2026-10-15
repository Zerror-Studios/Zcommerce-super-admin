/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Token-based classNames for HeroUI Input / Select / Autocomplete (component-specs §4, §5, §6, §15).
 *
 * Notes:
 * - HeroUI merges these with tailwind-merge, which does not know our custom font-size names
 *   (text-body, text-caption, …) and treats them as colors. Inside HeroUI slots we therefore use
 *   text-sm / text-xs, which have the same values as text-body / text-caption (14/20, 12/16).
 *   HeroUI's text-small is avoided because the Store Dashboard overrides its font-weight.
 * - The same applies to radius and shadow names: inside HeroUI components use rounded-lg (= rounded-field, 8px)
 *   and rounded-2xl (= rounded-card, 16px), and mark custom shadows with ! (shadow-popover, shadow-modal).
 *   Otherwise HeroUI's own rounded-medium/shadow class can win (it is 50px in the Store Dashboard during migration).
 * - `!` is needed to beat HeroUI's built-in variant classes. Compound variants
 *   (focus + hover, invalid + focus) make the intended state win regardless of CSS order.
 */

export type FieldSize = "sm" | "md" | "lg";

/** Control height per size (component-specs §1): 32 / 40 / 48px. Appended after the md default below. */
export const fieldHeight: Record<FieldSize, string> = {
  sm: "h-8 min-h-8",
  md: "h-10 min-h-10",
  lg: "h-12 min-h-12",
};

const focusRing = `
  group-data-[focus-visible=true]:ring-2
  group-data-[focus-visible=true]:ring-focus
  group-data-[focus-visible=true]:ring-offset-2
  group-data-[focus-visible=true]:ring-offset-surface
`;

/** Text field (§4): muted fill, primary border on hover, tinted fill on focus, danger when invalid. */
export const getInputClasses = (className = "") => ({
  input: `
    bg-transparent
    h-full
    outline-hidden
    !text-fg
    placeholder:!text-fg-muted
  `,
  inputWrapper: `
    w-full
    min-h-10
    h-10
    rounded-lg
    border
    !shadow-none
    z-10
    !bg-surface-muted
    !border-line
    transition-colors
    duration-fast
    ease-standard
    ${className}

    data-[hover=true]:!bg-surface
    data-[hover=true]:!border-brand
    group-data-[filled-within=true]:!bg-surface

    group-data-[focus=true]:!bg-brand-tint
    group-data-[focus=true]:!border-brand
    group-data-[focus=true]:data-[hover=true]:!bg-brand-tint
    group-data-[focus=true]:group-data-[filled-within=true]:!bg-brand-tint
    ${focusRing}

    group-data-[invalid=true]:!bg-tone-danger-soft
    group-data-[invalid=true]:!border-tone-danger
    group-data-[invalid=true]:data-[hover=true]:!bg-tone-danger-soft
    group-data-[invalid=true]:data-[hover=true]:!border-tone-danger
    group-data-[invalid=true]:group-data-[focus=true]:!bg-tone-danger-soft
    group-data-[invalid=true]:group-data-[focus=true]:!border-tone-danger
  `,
  label: "text-sm font-medium !text-fg w-full",
  errorMessage: "!text-tone-danger-text",
  description: "!text-fg-muted",
});

/** Select / Dropdown trigger (§6): white fill, strong border on hover, soft fill when open. */
export const getDropdownClasses = (className = "") => ({
  trigger: `
    ${className}
    w-full
    rounded-lg
    border
    py-0
    min-h-10
    h-10
    !shadow-none
    !bg-surface
    !border-line
    transition-colors
    duration-fast
    ease-standard

    data-[hover=true]:!border-line-strong

    data-[focus=true]:!border-brand
    data-[open=true]:!bg-brand-soft
    data-[open=true]:!border-brand
    data-[open=true]:data-[hover=true]:!border-brand

    data-[focus-visible=true]:ring-2
    data-[focus-visible=true]:ring-focus
    data-[focus-visible=true]:ring-offset-2
    data-[focus-visible=true]:ring-offset-surface

    group-data-[invalid=true]:!bg-tone-danger-soft
    group-data-[invalid=true]:!border-tone-danger
  `,
  value: "!text-fg",
  selectorIcon: "!text-fg-muted",
  label: "text-sm font-medium !text-fg",
  errorMessage: "!text-tone-danger-text",
});

/** Select trigger for modal forms. Same look as getDropdownClasses (§6). */
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

/** Search field (§5): pill, white fill, tinted on hover, 2px primary border on focus. Table-toolbar size (sm, 32px). */
export const getSearchInputClasses = (className = "") => ({
  inputWrapper: `
    ${className}
    !rounded-full
    border
    min-h-8
    h-8
    !shadow-none
    !bg-surface
    !border-line
    transition-colors
    duration-fast
    ease-standard

    data-[hover=true]:!bg-brand-tint
    data-[hover=true]:!border-brand

    group-data-[focus=true]:!bg-surface
    group-data-[focus=true]:!border-brand
    group-data-[focus=true]:border-2
    group-data-[focus=true]:data-[hover=true]:!bg-surface
    ${focusRing}
  `,
  input: `
    bg-transparent
    h-full
    outline-hidden
    !text-fg
    placeholder:!text-fg-muted
  `,
  label: "text-sm font-medium !text-fg",
});

/** Topbar search (§15): pill on the dark topbar; turns white with dark text when focused. */
export const getDarkSearchInputClasses = (className = "") => ({
  inputWrapper: `
    !rounded-full
    min-h-10
    h-10
    !shadow-none
    border-2
    !border-transparent
    !bg-topbar-control
    transition-colors
    duration-fast
    ease-standard
    ${className}

    data-[hover=true]:!bg-topbar-control-hover

    group-data-[focus=true]:!bg-surface
    group-data-[focus=true]:!border-brand
    group-data-[focus=true]:data-[hover=true]:!bg-surface
    ${focusRing}
  `,
  input: `
    bg-transparent
    h-full
    outline-hidden
    !text-topbar-fg
    placeholder:!text-topbar-fg-muted
    group-data-[focus=true]:!text-fg
    group-data-[focus=true]:placeholder:!text-fg-muted
  `,
  label: "text-sm font-medium !text-topbar-fg",
});

/**
 * Search field above data tables (Store Dashboard table header, Super Admin TableToolbar).
 * The original table-search look: 36px pill, muted fill, light blue border, blue tint on hover,
 * white fill with a primary border and soft ring on focus. Pair with tableSearchIconClass.
 */
export const getTableSearchClasses = (className = "") => ({
  /* One width everywhere: full width on phones, 384px from sm up (never stretched or squeezed by the row). */
  base: "w-full sm:w-96 sm:shrink-0",
  inputWrapper: `
    !rounded-full
    border
    min-h-9
    h-9
    !shadow-none
    !bg-surface-muted
    !border-field-line
    transition-colors
    duration-fast
    ease-standard

    data-[hover=true]:!bg-brand-soft-strong
    data-[hover=true]:!border-brand

    group-data-[focus=true]:!bg-surface
    group-data-[focus=true]:!border-brand
    group-data-[focus=true]:ring-1
    group-data-[focus=true]:ring-field-line
    group-data-[focus=true]:ring-offset-1
    group-data-[focus=true]:ring-offset-transparent
    group-data-[focus=true]:data-[hover=true]:!bg-surface
    ${className}
  `,
  input: `
    bg-transparent
    h-full
    outline-hidden
    text-sm
    !text-fg
    placeholder:!text-fg-muted
  `,
  clearButton: "text-fg-muted",
});

/** Leading magnifier for getTableSearchClasses (brand blue at 60%, as before). */
export const tableSearchIconClass = "size-4 shrink-0 text-brand/60";
