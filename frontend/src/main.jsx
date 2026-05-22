import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "bootstrap/dist/css/bootstrap.min.css";
import "./styles.css";
import App from "./App.jsx";
import { AuthProvider } from "./auth.jsx";

// GitHub Pages serves the app under a subpath (/expenser/) so React Router
// needs the matching basename. Vite injects BASE_URL from vite.config.js.
const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

// 404.html bounced a deep link here as ?p=expenses/123 — restore the real path.
(function () {
  var params = new URLSearchParams(window.location.search);
  var p = params.get("p");
  if (p) {
    params.delete("p");
    var remaining = params.toString();
    var newPath = import.meta.env.BASE_URL + p + (remaining ? "?" + remaining : "") + window.location.hash;
    window.history.replaceState(null, "", newPath);
  }
})();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
