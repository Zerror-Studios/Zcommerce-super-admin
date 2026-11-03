/**
 * `platformInvoicePdf` (backend PRD-030 FR-5, FR-10; billing:read,
 * audited): downloads any invoice as the interim PDF through the one
 * Apollo client, never cached.
 */

import { useApolloClient } from "@apollo/client";
import { useCallback, useState } from "react";

import { toastError } from "../components/ui";
import { PLATFORM_INVOICE_PDF } from "../graphql/billing";
import { downloadBase64File, invoicePdfErrorCopy } from "../lib/invoice-pdf.util";
import { PLATFORM_PERMISSIONS } from "../lib/permissions";
import { useAuth } from "../providers/AuthProvider";
import type { PlatformInvoicePdf } from "../types/platform-api";

export function useInvoicePdf() {
  const client = useApolloClient();
  const { can } = useAuth();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const download = useCallback(
    async (invoiceId: string) => {
      setDownloadingId(invoiceId);
      try {
        const result = await client.query<{ platformInvoicePdf: PlatformInvoicePdf }>({
          query: PLATFORM_INVOICE_PDF,
          variables: { id: invoiceId },
          fetchPolicy: "no-cache",
        });
        const file = result.data?.platformInvoicePdf;
        if (!file) throw new Error("No PDF returned");
        downloadBase64File(file.filename, file.base64, file.contentType);
      } catch (error) {
        toastError(invoicePdfErrorCopy(error));
      } finally {
        setDownloadingId(null);
      }
    },
    [client],
  );

  return { canDownload: can(PLATFORM_PERMISSIONS.BILLING_READ), download, downloadingId };
}
