import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { Client } from "../../types";
import { PageHeader } from "../common/PageHeader";
import { ClientsTable, type StoreTab } from "./ClientsTable";
import { IconAdd } from "../ui/icons";
import { Button as UiButton } from "../ui";

export interface ClientsPageContentProps {
  clients: Client[];
}

const storeTabs: StoreTab[] = ["all", "live", "trial", "unpaid", "suspended"];

/** Stores page (docs/design/04-super-admin.md §3.3): "Stores" + count, primary "Add store", the shared stores table. */
export function ClientsPageContent({ clients }: ClientsPageContentProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);

  // Home's "Needs attention" links here with ?status=… to open a tab.
  const requested = searchParams.get("status");
  const initialTab = storeTabs.find((tab) => tab === requested) ?? "all";

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 450);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div>
      <PageHeader
        title="Stores"
        count={clients.length}
        actions={
          <UiButton variant="primary" startIcon={<IconAdd aria-hidden />} onPress={() => navigate("/stores/new")}>
            Add store
          </UiButton>
        }
      />

      <ClientsTable key={initialTab} clients={clients} isLoading={loading} allowColumnChoice initialTab={initialTab} />
    </div>
  );
}
