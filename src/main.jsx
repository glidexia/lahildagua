import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

const DOMINIO_OFICIAL = "aguaslahilda.com";
const DOMINIOS_ANTERIORES = new Set([
  "lahildagua-production.up.railway.app",
]);

if (DOMINIOS_ANTERIORES.has(window.location.hostname)) {
  const destino = new URL(window.location.href);
  destino.protocol = "https:";
  destino.hostname = DOMINIO_OFICIAL;
  destino.port = "";
  window.location.replace(destino.toString());
} else {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
