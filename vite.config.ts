import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const proxied = ["/api", "/_allauth", "/accounts", "/oauth", "/admin", "/static"];

export default defineConfig(({ mode }) => {
  // The empty prefix lets a plain HAWKEYE_API in .env work, not just VITE_-prefixed names.
  const env = loadEnv(mode, process.cwd(), "");
  const backend = env.HAWKEYE_API || "http://localhost:8010";
  return {
    plugins: [react()],
    server: {
      port: 5190,
      proxy: Object.fromEntries(proxied.map((p) => [p, { target: backend, changeOrigin: false }])),
    },
  };
});
