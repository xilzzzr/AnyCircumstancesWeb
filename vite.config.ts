import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(() => ({
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
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Rollup otherwise emits many sub-kilobyte shared icon chunks when the
        // same icon appears in multiple lazy routes. Merge only very small
        // chunks while preserving the meaningful route boundaries above them.
        experimentalMinChunkSize: 2000,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
