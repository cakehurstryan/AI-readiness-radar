import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Served from the custom subdomain radar.cakehurstryan.com (root),
  // so assets resolve from "/".
  plugins: [react()],
});
