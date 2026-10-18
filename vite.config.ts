import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), tailwindcss()],
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
