import Raven from "raven-js";
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { config } from "./config";
import "./index.scss";
import { BrowserRouter } from "react-router-dom";

if (config.SENTRY_URI) {
  Raven.config(config.SENTRY_URI).install();
}

Raven.context(function() {
  const container = document.getElementById("root") as HTMLElement;
  const root = createRoot(container);
  root.render(
    <BrowserRouter basename={config.BASENAME()}>
      <App />
    </BrowserRouter>
  );
});
