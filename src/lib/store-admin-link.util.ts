/**
 * The "Log in to store" link when the API sends no `adminUrl` (PRD-014 UX-26)
 *
 * The backend builds `adminUrl` from `PLATFORM_TENANT_ADMIN_URL_TEMPLATE`;
 * without it the console used to copy only `#impersonation=…`, which an
 * operator had to paste after an address they had to know. This builds the
 * same full address from the console's template, the same shape as the
 * backend's `adminUrlFor`. Like `isSafeAdminUrl`, only an https address is
 * built; `http:` is accepted for a loopback host in dev only (W2V-C-06).
 */

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** `https://…/store/<slug>/#impersonation=<token>`, or `null` if it can't be built. */
export function storeAdminLink(
  slug: string | null | undefined,
  token: string,
  template: string,
  allowLoopbackHttp: boolean = import.meta.env.DEV,
): string | null {
  const trimmed = template.trim();
  if (!trimmed || !token) return null;
  const perStore = trimmed.includes("{slug}");
  if (perStore && !slug) return null;
  const base = (
    perStore ? trimmed.replace("{slug}", encodeURIComponent(slug!)) : trimmed
  ).replace(/\/+$/, "");
  try {
    const { protocol, hostname } = new URL(base);
    const isLoopbackHttp =
      allowLoopbackHttp && protocol === "http:" && LOOPBACK_HOSTS.has(hostname);
    if (protocol !== "https:" && !isLoopbackHttp) return null;
  } catch {
    return null;
  }
  return `${base}/#impersonation=${encodeURIComponent(token)}`;
}
