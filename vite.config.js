import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Hosted on GitHub Pages as a project site, so assets resolve under
  // the repo-name path: https://cakehurstryan.github.io/AI-readiness-radar/
  base: "/AI-readiness-radar/",
  plugins: [react()],
});
