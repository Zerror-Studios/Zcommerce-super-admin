import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/common/PageHeader";
import { FeatureRequestDrawer } from "../components/support/FeatureRequestDrawer";
import {
  FEATURE_AREA_OPTIONS,
  FEATURE_PARAMS,
  FEATURE_SORT_OPTIONS,
  FEATURE_STATUS_LABEL,
  FEATURE_STATUS_TONE,
  FEATURE_TABS,
  FEATURE_TYPE_OPTIONS,
  featureAbilities,
  featureBoardParams,
  featureBoardStateOf,
  featureBoardVariables,
  featureFilterCount,
  featureTabCount,
  lastActivityOf,
  scoreLabel,
  scoreTone,
  type FeatureBoardState,
  type FeatureRequest,
  type FeatureStatusCount,
  type FeatureTab,
} from "../components/support/feature-requests.util";
import {
  Button,
  CellText,
  Chip,
  DataTable,
  EmptyState,
  ErrorState,
  FilterDrawer,
  Switch,
  TablePagination,
  TableToolbar,
  cx,
  formatCount,
  formatDateTime,
  toneTextClasses,
  useTableQuery,
  useTableUrlState,
  type DataTableColumn,
  type FilterGroup,
  type FilterValues,
} from "../components/ui";
import { IconLock, IconTip } from "../components/ui/icons";
import { PLATFORM_FEATURE_REQUESTS } from "../graphql/feature-requests";
import { useUrlSearch } from "../hooks/use-url-search";
import { useAuth } from "../providers/AuthProvider";

const COLUMNS: DataTableColumn<FeatureRequest>[] = [
  { key: "request", label: "Request", mobile: "primary" },
  { key: "store", label: "Posted by", width: 180, mobile: "title" },
  { key: "votes", label: "Votes", width: 150, mobile: "value" },
  { key: "comments", label: "Comments", width: 100, hideWhen: "narrow", mobile: "hide" },
  { key: "status", label: "Status", width: 140, skeleton: "badge", mobile: "badge" },
  { key: "activity", label: "Last activity", width: 170, hideWhen: "narrow", mobile: "meta" },
];

const FILTER_GROUPS: FilterGroup[] = [
  { key: "area", label: "Area", type: "single", options: FEATURE_AREA_OPTIONS },
  { key: "type", label: "Type", type: "single", options: FEATURE_TYPE_OPTIONS },
];

function emptyTitle(tab: FeatureTab): string {
  if (tab === "ALL") return "No feature requests yet";
  return `No ${FEATURE_STATUS_LABEL[tab].toLowerCase()} requests`;
}

/**
 * Super Admin › Support › Feature requests (backend PRD-049 step A3, FR-A29, D13): every store's feature board with
 * the store names. Status tabs with the server's counts (All leaves Merged out), sort (Most votes = score, Newest,
 * Recently updated), area and type filters, search (title, FR number or store) and a Show hidden switch, all in the
 * URL. Rows show the FR number, title, posting store, type and area, ups / downs / score, comments, status and the
 * last activity. A row opens the drawer (`?request=<id>`, which the console feed links to). Reads need
 * platform:support:read or platform:feedback:manage; every change platform:feedback:manage.
 */
export function SupportFeatureRequests() {
  const { can } = useAuth();
  const abilities = featureAbilities(can);
  const [params, setParams] = useSearchParams();
  const table = useTableUrlState({ ignore: [FEATURE_PARAMS.request] });
  const [search, setSearch] = useUrlSearch(table.search, table.setSearch);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const board = featureBoardStateOf(table.filters);
  const openId = params.get(FEATURE_PARAMS.request);

  const { data, error, refetch, isInitialLoading, isReloading } = useTableQuery(PLATFORM_FEATURE_REQUESTS, {
    variables: featureBoardVariables(board, table.search, table.pageSize, table.offset),
    tabKey: board.tab,
    skip: !abilities.read,
  });
  const rows: FeatureRequest[] = data?.platformFeatureRequests?.items ?? [];
  // The counts come with the list; while another tab loads, the last counts stay on the tabs.
  const freshCounts: FeatureStatusCount[] | undefined = data?.platformFeatureRequests?.counts;
  const [lastCounts, setLastCounts] = useState<FeatureStatusCount[] | undefined>(undefined);
  if (freshCounts && freshCounts !== lastCounts) setLastCounts(freshCounts);
  const counts = freshCounts ?? lastCounts;

  const update = (patch: Partial<FeatureBoardState>) => table.setParams(featureBoardParams({ ...board, ...patch }));

  const tabs = FEATURE_TABS.map((item) => ({ value: item.value, label: item.label, count: featureTabCount(counts, item.value) }));

  const filterValues: FilterValues = { area: board.area ?? undefined, type: board.type ?? undefined };
  const filtered = !!table.search.trim() || featureFilterCount(board) > 0 || board.includeHidden;

  const setOpen = (id: string | null) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (id) next.set(FEATURE_PARAMS.request, id);
        else next.delete(FEATURE_PARAMS.request);
        return next;
      },
      { replace: true },
    );
  const index = rows.findIndex((row) => row.id === openId);

  const renderCell = (row: FeatureRequest, key: string) => {
    switch (key) {
      case "request":
        return (
          <div className="min-w-0">
            <p className="truncate text-body font-medium text-fg">{row.title}</p>
            <p className="font-mono text-label text-fg-muted">
              {row.ref} · {row.typeLabel} · {row.areaLabel}
              {row.hidden ? " · hidden" : ""}
            </p>
          </div>
        );
      case "store":
        return (
          <CellText className={row.storeId ? undefined : "text-fg-muted"}>
            {row.storeId ? row.storeName || row.storeSlug || "A store" : "ZCommerce team"}
          </CellText>
        );
      case "votes":
        return (
          <span className="text-body num">
            <span className={cx("font-medium", toneTextClasses[scoreTone(row.score)])}>{scoreLabel(row.score)}</span>
            <span className="text-label text-fg-muted">
              {" "}
              · {formatCount(row.upVotes)} up · {formatCount(row.downVotes)} down
            </span>
          </span>
        );
      case "comments":
        return <span className="text-body num">{formatCount(row.commentCount)}</span>;
      case "status":
        return <Chip tone={FEATURE_STATUS_TONE[row.status]}>{FEATURE_STATUS_LABEL[row.status]}</Chip>;
      case "activity":
        return <CellText className="text-fg-muted">{formatDateTime(lastActivityOf(row))}</CellText>;
      default:
        return null;
    }
  };

  const header = (
    <PageHeader title="Feature requests" eyebrow="Support" description="What stores ask ZCommerce to build, with their votes" />
  );

  if (!abilities.read) {
    return (
      <>
        {header}
        <EmptyState icon={IconLock} title="Feature requests aren't available to your role" description="Ask a platform owner for support access." />
      </>
    );
  }

  return (
    <>
      {header}

      <div className="space-y-4">
        <TableToolbar<FeatureTab>
          tabs={tabs}
          tab={board.tab}
          onTabChange={(tab) => update({ tab })}
          tabsLabel="Request status"
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Title, FR number or store"
          onOpenFilters={() => setFiltersOpen(true)}
          filterCount={featureFilterCount(board)}
          sort={{
            label: "Sort requests",
            options: FEATURE_SORT_OPTIONS,
            value: board.sort,
            onChange: (key) => update({ sort: key as FeatureBoardState["sort"] }),
          }}
        >
          <Switch isSelected={board.includeHidden} onValueChange={(includeHidden) => update({ includeHidden })}>
            Show hidden
          </Switch>
        </TableToolbar>

        {error && !rows.length ? (
          <ErrorState title="Couldn't load feature requests." onRetry={() => void refetch()} />
        ) : (
          <DataTable<FeatureRequest>
            aria-label="Feature requests"
            columns={COLUMNS}
            rows={rows}
            getRowKey={(row) => row.id}
            renderCell={renderCell}
            isLoading={isInitialLoading}
            isReloading={isReloading}
            tabKey={board.tab}
            onRowAction={(row) => setOpen(row.id)}
            rowHeight="tall"
            footer={
              rows.length > 0 || table.page > 1 ? (
                <TablePagination
                  page={table.page}
                  pageSize={table.pageSize}
                  total={data?.platformFeatureRequests?.totalCount ?? rows.length}
                  onPageChange={table.setPage}
                  onPageSizeChange={table.setPageSize}
                  isDisabled={isReloading}
                />
              ) : null
            }
            emptyContent={
              filtered ? (
                <EmptyState
                  kind="no-results"
                  icon={IconTip}
                  title="No requests match"
                  description="Search by title, FR number or store, or change the filters."
                  action={
                    <Button
                      variant="secondary"
                      size="sm"
                      onPress={() => {
                        setSearch("");
                        table.setParams({ q: undefined, ...featureBoardParams({ ...board, area: null, type: null, includeHidden: false }) });
                      }}
                    >
                      Clear search and filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState icon={IconTip} title={emptyTitle(board.tab)} description="Requests stores post from Help › Feature requests show here." />
              )
            }
          />
        )}
      </div>

      <FilterDrawer
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        groups={FILTER_GROUPS}
        value={filterValues}
        onApply={(values) =>
          update({
            area: typeof values.area === "string" && values.area ? values.area : null,
            type: typeof values.type === "string" && values.type ? (values.type as FeatureBoardState["type"]) : null,
          })
        }
        onClear={() => update({ area: null, type: null })}
        title="Filter requests"
      />

      <FeatureRequestDrawer
        requestId={openId}
        onClose={() => setOpen(null)}
        onOpen={(id) => setOpen(id)}
        onPrev={index > 0 ? () => setOpen(rows[index - 1].id) : undefined}
        onNext={index >= 0 && index < rows.length - 1 ? () => setOpen(rows[index + 1].id) : undefined}
        prevDisabled={index <= 0}
        nextDisabled={index < 0 || index >= rows.length - 1}
      />
    </>
  );
}
