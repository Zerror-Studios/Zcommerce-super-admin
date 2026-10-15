import type { Client } from "../../types";
import { ClientsTable } from "../clients/ClientsTable";

export interface TopClientsTableProps {
  clients: Client[];
  isLoading?: boolean;
}

/**
 * LEGACY name kept for existing imports. Home now shows the same stores table as the Stores page
 * (first 10 rows + "View all stores"), docs/design/04-super-admin.md §3.1.
 */
export function TopClientsTable({ clients, isLoading }: TopClientsTableProps) {
  return <ClientsTable clients={clients} isLoading={isLoading} previewLimit={10} />;
}
