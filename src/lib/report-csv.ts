/**
 * CSV export for the report tables (PRD-002 SA-6): formula-safe cells,
 * RFC 4180 quoting and a download that survives URL revocation.
 */

const CSV_FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Delay before revoking a download URL, so the browser can start it. */
export const CSV_REVOKE_DELAY_MS = 1000;

/** Neutralise formula injection, then quote per RFC 4180 when needed. */
export function escapeCsvCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  let cell = String(value);
  if (CSV_FORMULA_PREFIX.test(cell)) cell = `'${cell}`;
  if (/[",\n\r]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;

  return cell;
}

export function rowsToCsv(rows: Record<string, unknown>[], columns: { key: string; label: string }[]): string {
  const header = columns.map((c) => escapeCsvCell(c.label)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escapeCsvCell(row[c.key])).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), CSV_REVOKE_DELAY_MS);
}
