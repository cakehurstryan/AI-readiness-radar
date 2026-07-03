import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const container = document.getElementById("root");
const app = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// dist/index.html has prerendered markup injected by scripts/prerender.mjs,
// so hydrate onto it in production. In dev the container starts empty -
// hydrating an empty node throws, so mount fresh there instead.
if (container.hasChildNodes()) {
  ReactDOM.hydrateRoot(container, app);
} else {
  ReactDOM.createRoot(container).render(app);
}
