import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "bootstrap/dist/css/bootstrap.min.css";
import "./styles.css";
import App from "./App.jsx";

const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

// 404.html bounced a deep link here as ?p=add — restore the real path so
// react-router can match it.
(function () {
  const params = new URLSearchParams(window.location.search);
  const p = params.get("p");
  if (p) {
    params.delete("p");
    const rest = params.toString();
    const newPath = import.meta.env.BASE_URL + p + (rest ? "?" + rest : "") + window.location.hash;
    window.history.replaceState(null, "", newPath);
  }
})();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
