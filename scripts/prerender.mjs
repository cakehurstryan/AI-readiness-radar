// Runs after the client build. Renders <App/> to a static HTML string
// (via a throwaway SSR build of src/entry-server.jsx) and injects it into
// dist/index.html so the file GitHub Pages serves already contains real
// content, not just an empty mount point. The browser then hydrates on top
// of this markup - see hydrateRoot() in src/main.jsx.
import { build } from "vite";
import { readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ssrOutDir = path.join(root, "dist-ssr");

await build({
  root,
  build: {
    ssr: path.join(root, "src/entry-server.jsx"),
    outDir: "dist-ssr",
    emptyOutDir: true,
  },
  logLevel: "warn",
});

const { render } = await import(path.join(ssrOutDir, "entry-server.js"));
const appHtml = render();

const indexPath = path.join(root, "dist/index.html");
const html = await readFile(indexPath, "utf-8");
const withContent = html.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`);
await writeFile(indexPath, withContent);

await rm(ssrOutDir, { recursive: true, force: true });

console.log("Prerendered app content injected into dist/index.html");
