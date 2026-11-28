/**
 * Console › Messaging › Accounts, "Moving WhatsApp installs" (backend
 * PRD-051 FR-13, Q5): each store still sending WhatsApp through its own
 * MSG91 install, with the number's last four digits, its WhatsApp
 * templates, its sub-account's WhatsApp and what the move needs. Read only
 * (platform:messaging:read): the move is the owner-run CLI
 * `messaging-whatsapp-move --apply --store <slug> --yes`, one store at a
 * time with the owner's yes.
 */
import { useQuery } from "@apollo/client";
import { CellText, Chip, DataTable, EmptyState, ErrorState, type DataTableColumn } from "../ui";
import { IconWhatsApp } from "../ui/icons";
import { PLATFORM_WHATSAPP_MOVE_REPORT } from "../../graphql/messaging";

interface WhatsAppMoveRow {
  slug: string;
  tenantId: string;
  sample: boolean;
  moved: boolean;
  needs: string[];
  install: { authKey: boolean; numberLast4: string | null };
  templates: { total: number; approved: number; builder: number } | null;
  account: {
    state: string | null;
    authKey: boolean;
    kyc: string | null;
    whatsappStatus: string;
    whatsappNumberLast4: string | null;
    sameNumber: boolean;
    movedFromInstallAt: string | null;
  } | null;
}

type ReportData = { platformWhatsAppMoveReport: WhatsAppMoveRow[] };

const columns: DataTableColumn<WhatsAppMoveRow>[] = [
  { key: "store", label: "Store", mobile: "title" },
  { key: "install", label: "Install", width: 170, mobile: "meta" },
  { key: "account", label: "Sub-account", width: 190, hideWhen: "narrow", mobile: "meta" },
  { key: "status", label: "Move", width: 120, skeleton: "badge", mobile: "badge" },
];

export function WhatsAppMoveReportCard() {
  const { data, loading, error, refetch } = useQuery<ReportData>(PLATFORM_WHATSAPP_MOVE_REPORT, {
    fetchPolicy: "cache-and-network",
  });
  const rows = data?.platformWhatsAppMoveReport ?? [];

  const renderCell = (row: WhatsAppMoveRow, key: string) => {
    switch (key) {
      case "store":
        return (
          <div className="min-w-0">
            <p className="truncate text-body font-medium text-fg">{row.slug}</p>
            <p className="line-clamp-2 text-label text-fg-muted">{row.needs.join("; ")}</p>
          </div>
        );
      case "install":
        return (
          <div className="min-w-0">
            <CellText className="text-fg">
              {row.install.numberLast4 ? `Number ending ${row.install.numberLast4}` : "No number"}
            </CellText>
            <p className="text-label text-fg-muted">
              {row.install.authKey ? "Key set" : "No key"}
              {row.templates ? ` · ${row.templates.approved}/${row.templates.total} templates approved` : ""}
            </p>
          </div>
        );
      case "account":
        return row.account ? (
          <div className="min-w-0">
            <CellText className="text-fg">{row.account.state ?? "—"}</CellText>
            <p className="text-label text-fg-muted">
              WhatsApp {row.account.whatsappStatus.toLowerCase()}
              {row.account.whatsappNumberLast4 ? ` · ending ${row.account.whatsappNumberLast4}` : ""}
            </p>
          </div>
        ) : (
          <CellText className="text-fg-muted">No account</CellText>
        );
      case "status":
        return row.sample ? (
          <Chip tone="neutral">Sample</Chip>
        ) : row.moved ? (
          <Chip tone="success">Moved</Chip>
        ) : (
          <Chip tone="warning">On install</Chip>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-title-3 font-semibold text-fg">Moving WhatsApp installs</h2>
        <p className="text-label text-fg-muted">
          Stores still sending WhatsApp through their own MSG91 install. The move is the owner-run CLI
          (messaging-whatsapp-move), one store at a time, after the number is under the store&apos;s sub-account at MSG91.
        </p>
      </div>
      {error && !data ? (
        <ErrorState title="Couldn't load the WhatsApp move report." onRetry={() => void refetch()} />
      ) : (
        <DataTable<WhatsAppMoveRow>
          aria-label="Moving WhatsApp installs"
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.tenantId}
          renderCell={renderCell}
          isLoading={loading && !data}
          isReloading={loading && !!data}
          tabKey="whatsapp-move"
          rowHeight="tall"
          emptyContent={
            <EmptyState
              icon={IconWhatsApp}
              title="No store sends WhatsApp through its own MSG91 install"
              description="Stores whose WhatsApp number is in their MSG91 install show here until it moves to their sub-account."
            />
          }
        />
      )}
    </div>
  );
}
