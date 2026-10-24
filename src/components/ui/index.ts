/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Shared UI layer. Feature code imports from here, not from @heroui/react.
 * HeroUI building blocks without design-system styling of their own are re-exported as-is.
 */
export { AppToastProvider } from "./AppToastProvider";
export { toastError } from "./toast";
export { Badge } from "./Badge";
export type { BadgeProps } from "./Badge";
export { IconTile, sectionClass } from "./IconTile";
export type { IconTileProps, SectionColor } from "./IconTile";
export { Button } from "./Button";
export type { ButtonProps, ButtonSize, ButtonVariant } from "./Button";
export { Card } from "./Card";
export type { CardPadding, CardProps } from "./Card";
export { CardWrapper, cardFrameClasses } from "./CardWrapper";
export type { CardWrapperProps } from "./CardWrapper";
export { Checkbox } from "./Checkbox";
export type { CheckboxProps } from "./Checkbox";
export { Chip } from "./Chip";
export type { ChipProps } from "./Chip";
export { ConfirmDialog } from "./ConfirmDialog";
export type { ConfirmDialogProps } from "./ConfirmDialog";
export { Dropdown, DropdownMenu } from "./Dropdown";
export type { DropdownMenuProps, DropdownProps } from "./Dropdown";
export { IconButton } from "./IconButton";
export type { IconButtonProps, IconButtonSize, IconButtonVariant } from "./IconButton";
export { Input } from "./Input";
export type { InputProps } from "./Input";
export { Modal } from "./Modal";
export type { ModalProps } from "./Modal";
export { SearchInput } from "./SearchInput";
export type { SearchInputProps } from "./SearchInput";
export { Select } from "./Select";
export type { SelectProps } from "./Select";
export { Skeleton } from "./Skeleton";
export type { SkeletonProps } from "./Skeleton";
export { Spinner } from "./Spinner";
export type { SpinnerProps } from "./Spinner";
export { Switch } from "./Switch";
export type { SwitchProps } from "./Switch";
export { Tabs } from "./Tabs";
export type { TabsProps } from "./Tabs";
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
export { apexBaseOptions, areaGradientStops, categoryColor, chartColors, planColor, planColors, recharts } from "./chart-theme";
export { formatCount, formatDelta, formatMoney, formatPercent } from "./money";
export { formatDate, formatDateTime, formatRange, formatRelative } from "./format-date";
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
export type { PaneGroup, PaneHeaderProps, PaneItem, PaneListProps, TwoPaneCardProps } from "./TwoPane";
export { CellText, DataTable, TableSkeletonRows } from "./DataTable";
export type { DataTableColumn, DataTableProps } from "./DataTable";
export { DEFAULT_PAGE_SIZE, PAGE_SIZES, TablePagination } from "./TablePagination";
export type { TablePaginationProps } from "./TablePagination";
export { usePersistentColumns, useTableUrlState } from "./table-state";
export type { SortDirection, TableSort, TableUrlOptions, TableUrlState } from "./table-state";
