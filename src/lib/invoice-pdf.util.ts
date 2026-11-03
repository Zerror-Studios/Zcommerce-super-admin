/**
 * Interim invoice PDF (backend PRD-030 FR-10): the file save and the copy
 * for a refused download. The PDF itself is the server's ("not a tax
 * invoice"); PRD-019 FR-B7's stored document replaces it.
 */

import type { PlatformInvoiceIssuer } from "../types/platform-api";
import { errorReasonOf } from "./apollo-client";

// ─── Constants ────────────────────────────────────────────────────────────

/** Revoking synchronously can cancel the download in some browsers. */
const PDF_REVOKE_DELAY_MS = 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────

/** The base64 the server sent, as bytes. */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function downloadBase64File(filename: string, base64: string, contentType: string): void {
  const blob = new Blob([base64ToBytes(base64) as BlobPart], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), PDF_REVOKE_DELAY_MS);
}

/** FR-7 / FR-6: the toast for a refused download. */
export function invoicePdfErrorCopy(error: unknown): string {
  switch (errorReasonOf(error)) {
    case "INVOICE_ISSUER_MISSING":
      return "Add the invoice issuer in Settings › Billing rules before downloading invoice PDFs.";
    case "RATE_LIMITED":
      return "Too many downloads. Try again in a minute.";
    default:
      return "Couldn't create the PDF. Try again.";
  }
}

// ─── Issuer form (FR-8) ───────────────────────────────────────────────────

export interface IssuerDraft {
  legalName: string;
  address: string;
  email: string;
  phone: string;
  website: string;
}

export function issuerDraftOf(issuer: PlatformInvoiceIssuer | null | undefined): IssuerDraft {
  return {
    legalName: issuer?.legalName ?? "",
    address: (issuer?.addressLines ?? []).join("\n"),
    email: issuer?.email ?? "",
    phone: issuer?.phone ?? "",
    website: issuer?.website ?? "",
  };
}

/** The draft as the server input; blank optional fields are sent as null. */
export function issuerInputOf(draft: IssuerDraft): PlatformInvoiceIssuer {
  const optional = (value: string) => value.trim() || null;
  return {
    legalName: draft.legalName.trim(),
    addressLines: draft.address
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
    email: optional(draft.email),
    phone: optional(draft.phone),
    website: optional(draft.website),
  };
}
