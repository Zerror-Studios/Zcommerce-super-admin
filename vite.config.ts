import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

/**
 * True when `url` is an absolute https URL with a host. A production bundle
 * is served from a static host with no proxy, so a relative gateway path
 * (or the "/v1/graphql" fallback in src/config/data-source.ts) makes every
 * API call hit that host (301, then 404) instead of the API.
 */
function isAbsoluteHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.host !== "";
  } catch {
    return false;
  }
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // ADR-004: the deployed console must call the API host directly. A local
  // build against the dev proxy can use `vite build --mode development`.
  if (
    command === "build" &&
    mode === "production" &&
    !isAbsoluteHttpsUrl(env.VITE_GATEWAY_URL ?? "")
  ) {
    throw new Error(
      "VITE_GATEWAY_URL must be an absolute https URL for a production " +
        "build, e.g. https://api.zerrorstudios.com/v1/graphql. A relative " +
        "path or an unset value only works with the dev proxy.",
    );
  }

  // PRD-024 FR-1.5 (P-06): the shell shows the build's version, not a
  // hard-coded one: package version plus the commit when the host gives it.
  const commit = (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7);
  const version = process.env.npm_package_version ?? "dev";
  const appVersion = commit ? `${version}+${commit}` : version;

  return {
    plugins: [react(), tailwindcss()],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    server: {
      // PRD-005 FR-11.1: same-origin `/v1/graphql` in dev, so the HttpOnly
      // refresh cookie is first-party. API_GATEWAY_URL is the backend
      // gateway (default http://localhost:4000).
      proxy: {
        "/v1/graphql": {
          target: env.API_GATEWAY_URL || "http://localhost:4000",
          changeOrigin: true,
        },
      },
    },
    build: {
      // Review C-L11: the two heaviest dependencies get their own chunks so
      // a page edit never invalidates them (Vite 8 / rolldown).
      rolldownOptions: {
        output: {
          advancedChunks: {
            groups: [
              { name: "recharts", test: /node_modules[\\/]recharts/ },
              { name: "apollo", test: /node_modules[\\/]@apollo[\\/]client/ },
            ],
          },
        },
      },
    },
  };
});
