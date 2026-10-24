import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

const DOMINIO_OFICIAL = "aguaslahilda.com";
const DOMINIOS_ANTERIORES = new Set([
  "lahildagua-production.up.railway.app",
]);
const BUILD_ID = __APP_BUILD_ID__;

function vigilarNuevaVersion() {
  let consultando = false;

  const comprobar = async () => {
    if (consultando || document.visibilityState === "hidden") return;
    consultando = true;
    try {
      const respuesta = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
      if (!respuesta.ok) return;
      const version = await respuesta.json();
      if (version.buildId && version.buildId !== BUILD_ID) window.location.reload();
    } catch {
      // Si no hay conexión, se vuelve a intentar cuando la pestaña recupere el foco.
    } finally {
      consultando = false;
    }
  };

  window.addEventListener("pageshow", comprobar);
  window.addEventListener("focus", comprobar);
  document.addEventListener("visibilitychange", comprobar);
  window.setInterval(comprobar, 60_000);
}

if (DOMINIOS_ANTERIORES.has(window.location.hostname)) {
  const destino = new URL(window.location.href);
  destino.protocol = "https:";
  destino.hostname = DOMINIO_OFICIAL;
  destino.port = "";
  window.location.replace(destino.toString());
} else {
  vigilarNuevaVersion();
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
