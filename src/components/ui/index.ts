/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Shared UI layer. Feature code imports from here, not from @heroui/react.
 * HeroUI building blocks without design-system styling of their own are re-exported as-is.
 */
export { AppToastProvider } from "./AppToastProvider";
export { toast, toastError } from "./toast";
export type { ToastAction } from "./toast";
export { Badge } from "./Badge";
export type { BadgeProps } from "./Badge";
export { IconTile, sectionClass } from "./IconTile";
export type { IconTileProps, SectionColor } from "./IconTile";
export { Button, ButtonLink } from "./Button";
export { buttonClasses, resolveButtonSize, resolveButtonVariant } from "./button-variants";
export { ButtonShortLabelContext } from "./short-label";
export type { ButtonLinkProps, ButtonProps } from "./Button";
export type { ButtonSize, ButtonVariant, ButtonVariantName, LegacyButtonVariant } from "./button-variants";
export { AttentionList } from "./AttentionList";
export type { AttentionItem, AttentionListProps, AttentionUrgency } from "./AttentionList";
export { VideoBanner } from "./VideoBanner";
export type { VideoBannerProps, VideoBannerTile } from "./VideoBanner";
export { Card } from "./Card";
export type { CardPadding, CardProps } from "./Card";
export { CardWrapper, cardFrameClasses } from "./CardWrapper";
export type { CardWrapperProps } from "./CardWrapper";
export { Checkbox } from "./Checkbox";
export type { CheckboxProps } from "./Checkbox";
export { Chip } from "./Chip";
export type { ChipProps } from "./Chip";
export { FilterChip, OptionChip } from "./FilterChips";
export type { FilterChipProps, OptionChipProps } from "./FilterChips";
export { ConfirmDialog } from "./ConfirmDialog";
export type { ConfirmDialogProps } from "./ConfirmDialog";
export { Dropdown, DropdownMenu } from "./Dropdown";
export type { DropdownMenuProps, DropdownProps } from "./Dropdown";
export { IconButton } from "./IconButton";
export type { IconButtonProps, IconButtonSize, IconButtonVariant } from "./IconButton";
export { Input } from "./Input";
export type { InputProps } from "./Input";
export { Drawer } from "./Drawer";
export type { DrawerProps, DrawerSize } from "./Drawer";
export { FilterButton, FilterDrawer, countActiveFilters } from "./FilterDrawer";
export type {
  FilterButtonProps,
  FilterDraftValue,
  FilterDrawerProps,
  FilterGroup,
  FilterGroupType,
  FilterOption,
  FilterRange,
  FilterValues,
} from "./FilterDrawer";
export { RowMenu } from "./RowMenu";
export type { RowMenuItem, RowMenuProps } from "./RowMenu";
export { Modal } from "./Modal";
export type { ModalProps } from "./Modal";
export { resolveModalSize } from "./modal-size";
export type { LegacyModalSize, ModalSize, ModalWidth } from "./modal-size";
export { SearchInput } from "./SearchInput";
export type { SearchInputProps } from "./SearchInput";
export { Select } from "./Select";
export type { SelectProps } from "./Select";
export { Skeleton } from "./Skeleton";
export type { SkeletonProps } from "./Skeleton";
export { RouteProgress, RouteSkeleton } from "./RouteSkeleton";
export type { RouteSkeletonProps } from "./RouteSkeleton";
export { Spinner } from "./Spinner";
export type { SpinnerProps } from "./Spinner";
export { Switch } from "./Switch";
export type { SwitchProps } from "./Switch";
export { SegmentedSwitch, TabLabel, Tabs } from "./Tabs";
export type { SegmentedItem, SegmentedSize, SegmentedSwitchProps, SegmentedVariant, TabsProps, TabsVariant } from "./Tabs";
export { Textarea } from "./Textarea";
export type { TextareaProps } from "./Textarea";
export { Tooltip } from "./Tooltip";
export type { TooltipProps } from "./Tooltip";
export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";
export { ErrorState } from "./ErrorState";
export type { ErrorStateProps } from "./ErrorState";
export { HealthScore } from "./HealthScore";
export type { HealthScoreProps } from "./HealthScore";
export { MoneyText } from "./MoneyText";
export type { MoneyTextProps } from "./MoneyText";
export { PlanExpiryBadge } from "./PlanExpiryBadge";
export type { PlanExpiryBadgeProps } from "./PlanExpiryBadge";
export { KpiStrip, StatCard } from "./StatCard";
export type { KpiStripProps, StatCardProps } from "./StatCard";
export { StatusChip } from "./StatusChip";
export type { StatusChipProps } from "./StatusChip";
export {
  PHONE_CHART_POINTS,
  apexBaseOptions,
  areaGradientStops,
  categoryColor,
  chartColors,
  isEndTick,
  planColor,
  planColors,
  pointsForViewport,
  recharts,
  rechartsEndTicks,
} from "./chart-theme";
export {
  DUR_1_S,
  DUR_2_S,
  DUR_3_S,
  DUR_4_S,
  EASE_IN,
  EASE_IN_OUT,
  EASE_OUT,
  EXIT_S,
  POPOVER_EXIT_S,
  drawerLeftVariants,
  drawerVariants,
  fadeVariants,
  popoverVariants,
  popupVariants,
  presetMotion,
  sheetVariants,
  spring,
  toastMotionProps,
  tooltipVariants,
  usePresetMotion,
} from "./motion";
export type { MotionPreset } from "./motion";
export { formatCount, formatDelta, formatMoney, formatPercent } from "./money";
export { formatPlanName } from "./format-name";
export { formatDate, formatDateTime, formatDayTime, formatRange, formatRelative, formatTime } from "./format-date";
export type { DateInput } from "./format-date";
export type { FormatMoneyOptions } from "./money";
export { STATUS_MAP, getExpiryStatus, getHealthBand, getStatus, normalizeStatus, statusTone } from "./status-map";
export type { StatusDomain, StatusInfo } from "./status-map";

export { cx } from "./cx";
export { fieldHeight } from "./field-styles";
export type { FieldSize } from "./field-styles";
export { menuItemDangerClasses } from "./menu-styles";
export {
  tableCellClasses,
  tableCheckboxClassNames,
  tableHeaderCellClasses,
  tablePanelClasses,
  tableRowClasses,
} from "./table-styles";
export { TONES, toneClasses, toneDotClasses, toneTextClasses } from "./tones";
export type { Tone } from "./tones";
export * from "./icons";

export {
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DropdownItem,
  DropdownSection,
  DropdownTrigger,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  SelectItem,
  SelectSection,
  Tab,
  useDisclosure,
} from "@heroui/react";
export { BackLink, CopyableId, Kbd, SaveBar, SegmentedControl } from "./Primitives";
export type { BackLinkProps, CopyableIdProps, SaveBarProps, SegmentedControlProps } from "./Primitives";
export { RankedBars } from "./RankedBars";
export type { RankedBarItem } from "./RankedBars";
export { SelectionBar } from "./SelectionBar";
export type { SelectionBarProps } from "./SelectionBar";
export { AiAskInput, AiAvatar, AiFeedback, AiInsightCard, AiSpectrumDefs, AiSuggestion, AiThinking, Sparkle, TodaysBrief, WriteWithAiButton } from "./Ai";
export type { AiAskInputProps, AiInsightCardProps, AiSuggestionProps, AiThinkingProps, BriefLine, TodaysBriefProps } from "./Ai";
export { isAiEnabled, useAiEnabled } from "./ai-flag";
export { PaneHeader, PaneList, TwoPaneCard } from "./TwoPane";
export { FieldGrid, SettingsSearch, SettingsShell, SetupStatusIcon, fieldSpanFull, useSettingsFieldFocus } from "./SettingsShell";
export { ProgressRing } from "./ProgressRing";
export { ColorPicker } from "./ColorPicker";
export type { SettingsMenuAction, SettingsMenuGroup, SettingsMenuItem, SettingsSearchEntry, SettingsShellProps, SetupStatus } from "./SettingsShell";
export type { PaneGroup, PaneHeaderProps, PaneItem, PaneListProps, TwoPaneCardProps } from "./TwoPane";
export { CellText, DataTable, TableSkeletonRows } from "./DataTable";
export type { DataTableColumn, DataTableProps, DataTableRowTone } from "./DataTable";
export { DEFAULT_PAGE_SIZE, PAGE_SIZES, TablePagination } from "./TablePagination";
export type { TablePaginationProps } from "./TablePagination";
export { storedPageSize, usePersistentColumns, useTableUrlState } from "./table-state";
export type { SortDirection, TableSort, TableUrlOptions, TableUrlState } from "./table-state";
export { Avatar, CoverTag, ImageControl, ViewToggle, useViewMode } from "./Media";
export type { AvatarProps, ImageControlProps, ViewMode } from "./Media";
// Design v2 (docs/design-v2/README.md §3.4, §4).
export { AiCard, AiLine, Orb } from "./Orb";
export type { AiCardProps, AiLineProps, OrbProps, OrbSize, OrbState } from "./Orb";
export { SummaryPanel } from "./SummaryPanel";
export type { SummaryCell, SummaryChart, SummaryPanelProps, SummaryTone } from "./SummaryPanel";
export { RowChevron, rowControlProps, SortButton, TableToolbar, ThumbWithCount, ViewSwitch } from "./TableToolbar";
export type { RowChevronProps, SortButtonProps, SortOption, TableToolbarProps, ThumbWithCountProps, ViewSwitchProps } from "./TableToolbar";
export { SeoScore, VIDEO_LOOKS, VideoThumb, WALLET_CRITICAL_BALANCE, WalletCapsule, seoBand, videoLookAt, walletHealth } from "./V2Display";
export type { SeoBand, SeoScoreProps, VideoLook, VideoThumbProps, WalletCapsuleProps, WalletHealth } from "./V2Display";
export { PopupTitle } from "./Modal";
export type { PopupTitleProps } from "./Modal";
export type { IconTileTone } from "./IconTile";
export { HomeHero } from "./HomeHero";
export type { HomeHeroChip, HomeHeroPeriod, HomeHeroProps, HomeHeroTrend } from "./HomeHero";
// Responsive bands (docs/design-v2/README.md §10).
export {
  BELOW_DESKTOP_QUERY,
  BELOW_LAPTOP_QUERY,
  NO_HOVER_QUERY,
  PHONE_QUERY,
  useIsPhone,
  useMediaQuery,
  useViewportBand,
} from "./use-media";
export type { ViewportBand } from "./use-media";
export {
  DateRangePicker,
  DATE_RANGE_PRESETS,
  compareRange,
  dateRangeFromParams,
  dateRangeFromPreset,
  dateRangeLabel,
  dateRangeToParams,
  formatDateRange,
  matchPreset,
  presetRange,
  useUrlDateRange,
} from "./DateRangePicker";
export type {
  DateRangeCompare,
  DateRangePickerProps,
  DateRangePreset,
  DateRangeValue,
  UseUrlDateRangeOptions,
} from "./DateRangePicker";
