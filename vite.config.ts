import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backend = process.env.HAWKEYE_API ?? "http://localhost:8010";
const proxied = ["/api", "/_allauth", "/accounts", "/oauth", "/admin", "/static"];

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5190,
    proxy: Object.fromEntries(
      proxied.map((p) => [p, { target: backend, changeOrigin: false }]),
    ),
  },
});
