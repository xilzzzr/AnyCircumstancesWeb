import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/auth": {
	target: "http://127.0.0.1:3002",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 3001,
    allowedHosts: [
      "uac.18.217.204.130.sslip.io",
      "anycircumstances.com",
      "www.anycircumstances.com",
    ],
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
