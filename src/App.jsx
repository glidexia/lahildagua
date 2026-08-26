import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Droplet, Droplets, Package, Truck, User, MapPin, Building2, Store,
  CheckCircle2, XCircle, Clock, LayoutDashboard, Users, ChevronRight, ChevronLeft,
  Minus, Plus, CalendarClock, LogOut, BarChart3, Lock, Search, ArrowUpDown,
  ClipboardList, Boxes, Pencil, Save, Sparkles, ArrowLeftRight, TrendingUp, Sun, Moon,
  Loader2, AlertCircle, MessageCircle, Settings, Trash2, KeyRound, DollarSign,
  ImagePlus, Upload, Eye, Landmark, X, FileCheck2
} from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip, Cell } from "recharts";

/* ---------------------------------- API ---------------------------------- */
const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");
const ERROR_GLOBAL_EVENT = "lahilda:error";
const CONFIRM_GLOBAL_EVENT = "lahilda:confirmar";
const AUTH_EXPIRED_EVENT = "lahilda:sesion-vencida";
const AUTH_SESSION_KEY = "lahilda:sesion";
let ultimoErrorGlobal = { mensaje: "", momento: 0 };

function mostrarErrorGlobal(mensaje) {
  if (!mensaje || typeof window === "undefined") return;
  const ahora = Date.now();
  if (ultimoErrorGlobal.mensaje === mensaje && ahora - ultimoErrorGlobal.momento < 800) return;
  ultimoErrorGlobal = { mensaje, momento: ahora };
  window.dispatchEvent(new CustomEvent(ERROR_GLOBAL_EVENT, { detail: { mensaje } }));
}

function confirmarAccion({ titulo, mensaje, textoConfirmar = "Confirmar", textoCancelar = "Cancelar", peligro = true }) {
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise(resolve => {
    window.dispatchEvent(new CustomEvent(CONFIRM_GLOBAL_EVENT, {
      detail: { titulo, mensaje, textoConfirmar, textoCancelar, peligro, resolve },
    }));
  });
}

function mensajeAmigableApi(status, data, path) {
  const detalle = typeof data?.error === "string" ? data.error.trim() : "";
  if (status >= 500) return "Tuvimos un problema interno. Esperá un momento y volvé a intentar.";
  if (status === 401) return path.includes("/auth/") ? "El usuario o la contraseña no son correctos." : "Tu sesión venció. Volvé a iniciar sesión.";
  if (status === 403) return "No tenés permisos para realizar esta acción.";
  if (status === 404) return detalle || "No encontramos la información solicitada.";
  if (status === 409) return detalle || "No pudimos completar la acción porque la información cambió.";
  if (status === 422) return detalle || "No pudimos procesar esos datos. Revisalos e intentá nuevamente.";
  if (status === 400) return detalle || "Revisá los datos ingresados e intentá nuevamente.";
  return "No pudimos completar la acción. Intentá nuevamente.";
}

async function api(path, { method = "GET", body, token } = {}) {
  const esFormulario = typeof FormData !== "undefined" && body instanceof FormData;
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { ...(!esFormulario ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? (esFormulario ? body : JSON.stringify(body)) : undefined,
    });
  } catch {
    const mensaje = "No pudimos conectarnos. Revisá tu conexión e intentá nuevamente.";
    mostrarErrorGlobal(mensaje);
    throw new Error(mensaje);
  }
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const mensaje = mensajeAmigableApi(res.status, data, path);
    if (res.status === 401 && !path.includes("/auth/")) {
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    }
    mostrarErrorGlobal(mensaje);
    throw new Error(mensaje);
  }
  return data;
}

async function apiBlob(path, token) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    const mensaje = "No pudimos descargar el comprobante. Revisá tu conexión.";
    mostrarErrorGlobal(mensaje);
    throw new Error(mensaje);
  }
  if (!res.ok) {
    let data = {};
    try { data = await res.json(); } catch {}
    const mensaje = mensajeAmigableApi(res.status, data, path);
    if (res.status === 401) window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    mostrarErrorGlobal(mensaje);
    throw new Error(mensaje);
  }
  return res.blob();
}
function decodeJwt(token) {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(atob(b64).split("").map(ch => "%" + ch.charCodeAt(0).toString(16).padStart(2, "0")).join("")));
  } catch { return {}; }
}
function leerSesionGuardada() {
  if (typeof window === "undefined") return null;
  try {
    const sesion = JSON.parse(window.sessionStorage.getItem(AUTH_SESSION_KEY));
    if (!sesion?.token || !["admin", "chofer"].includes(sesion.role)) throw new Error("Sesión inválida");
    const payload = decodeJwt(sesion.token);
    if (payload.role !== sesion.role || !payload.exp || payload.exp * 1000 <= Date.now()) throw new Error("Sesión vencida");
    return { ...sesion, camionId: sesion.camionId ?? payload.camionId };
  } catch {
    window.sessionStorage.removeItem(AUTH_SESSION_KEY);
    return null;
  }
}
function guardarSesion(sesion) {
  try { window.sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sesion)); } catch {}
}
function borrarSesionGuardada() {
  try { window.sessionStorage.removeItem(AUTH_SESSION_KEY); } catch {}
}
const PALETA_CAMIONES = ["#4FD1C5", "#F5A623", "#818CF8", "#F472B6", "#6EE7B7", "#FB923C", "#38BDF8", "#C084FC"];
function colorDeCamion(id) { return PALETA_CAMIONES[((id || 1) - 1) % PALETA_CAMIONES.length]; }

/* ---------------------------------- TOKENS ---------------------------------- */
const DARK = {
  bg: "#0E1A2B", bgAlt: "#0A1420", surface: "#16233A", surfaceAlt: "#1D2C47",
  border: "#26364F", borderSoft: "#1E2C42",
  accent: "#4FD1C5", accentSoft: "rgba(79,209,197,0.14)",
  amber: "#F5A623", amberSoft: "rgba(245,166,35,0.14)",
  danger: "#F87171", dangerSoft: "rgba(248,113,113,0.14)",
  success: "#34D399", successSoft: "rgba(52,211,153,0.14)",
  text: "#EAF2F7", textMuted: "#8CA3B7", textFaint: "#5B7089",
};
const LIGHT = {
  bg: "#F3F6F8", bgAlt: "#FFFFFF", surface: "#FFFFFF", surfaceAlt: "#EEF2F5",
  border: "#DCE3E8", borderSoft: "#E6EBEF",
  accent: "#0D9488", accentSoft: "rgba(13,148,136,0.10)",
  amber: "#B45309", amberSoft: "rgba(180,83,9,0.10)",
  danger: "#DC2626", dangerSoft: "rgba(220,38,38,0.10)",
  success: "#059669", successSoft: "rgba(5,150,105,0.10)",
  text: "#0F172A", textMuted: "#5B6B7C", textFaint: "#94A3B0",
};
const ThemeContext = React.createContext(DARK);
function useTheme() { return React.useContext(ThemeContext); }

function BrandLogo({ variant = "word", className = "", style = {} }) {
  const c = useTheme();
  const version = c === DARK ? "white" : "color";
  return (
    <img
      src={`/brand/lahilda-${variant}-${version}.png`}
      alt="La Hilda"
      className={`block object-contain ${className}`}
      style={style}
    />
  );
}

function SystemFooter() {
  const c = useTheme();
  return (
    <footer className="shrink-0 px-4 py-3" style={{ background: c.bgAlt, borderTop: `1px solid ${c.borderSoft}` }}>
      <a
        href="https://www.glidex.com.ar"
        target="_blank"
        rel="noopener noreferrer"
        className="f-body mx-auto flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-[11px] transition-opacity hover:opacity-100"
        style={{ color: c.textFaint, background: c.surface, border: `1px solid ${c.border}`, opacity: 0.82, textDecoration: "none" }}
        title="Visitar Glidex.ar"
      >
        <Sparkles size={12} color={c.accent} />
        <span>Sistema hecho por <strong style={{ color: c.textMuted }}>Glidex.ar</strong></span>
      </a>
    </footer>
  );
}

const fonts = (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap');
    .f-display{font-family:'Space Grotesk',sans-serif}.f-body{font-family:'Inter',sans-serif}.f-mono{font-family:'JetBrains Mono',monospace}
    .theme-dark input,.theme-dark select{color-scheme:dark}
    .theme-light input,.theme-light select{color-scheme:light}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes wspBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
    @keyframes modalBackdropIn{from{opacity:0}to{opacity:1}}
    @keyframes modalBackdropOut{from{opacity:1}to{opacity:0}}
    @keyframes modalCardIn{from{opacity:0;transform:translateY(-18px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes modalCardOut{from{opacity:1;transform:translateY(0) scale(1)}to{opacity:0;transform:translateY(10px) scale(.97)}}
    .wsp-bounce{animation:wspBounce 1.8s ease-in-out infinite}
    .modal-backdrop-in{animation:modalBackdropIn .2s ease-out both}
    .modal-backdrop-out{animation:modalBackdropOut .16s ease-in both}
    .modal-card-in{animation:modalCardIn .26s cubic-bezier(.2,.8,.2,1) both}
    .modal-card-out{animation:modalCardOut .16s ease-in both}
    @media (prefers-reduced-motion:reduce){.modal-backdrop-in,.modal-backdrop-out,.modal-card-in,.modal-card-out{animation:none}}
  `}</style>
);

const PAGOS = ["Efectivo", "Transferencia"];
const DIAS_SEMANA = [
  { id: 1, label: "Lunes", corto: "Lun" },
  { id: 2, label: "Martes", corto: "Mar" },
  { id: 3, label: "Miércoles", corto: "Mié" },
  { id: 4, label: "Jueves", corto: "Jue" },
  { id: 5, label: "Viernes", corto: "Vie" },
];
const OPCIONES_SEGMENTO = [
  { id: "consumo_personal", label: "Consumo personal", categoria: "consumo_personal", Icon: User, desc: "Agua para tu consumo diario" },
  { id: "dispenser_frio_calor", label: "Dispenser frío/calor", categoria: "dispenser_frio_calor", Icon: Droplets, desc: "Equipos y servicio de dispenser" },
  { id: "comercio_reventa", label: "Comercio/revender nuestros productos", categoria: "comercio_reventa", Icon: Store, desc: "Productos y precios para reventa" },
];
const TIPO_DESTINO_POR_SEGMENTO = { consumo_personal: "casa", dispenser_frio_calor: "oficina", comercio_reventa: "empresa" };
function fmtDate(d) { return d.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "short", day: "numeric", month: "short" }); }
function formatearFechaEntrega(fecha) {
  if (!fecha) return "próximo día hábil";
  const texto = new Date(fecha).toLocaleDateString("es-AR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
function formatearFranja(horaDesde, horaHasta) {
  if (!horaDesde || !horaHasta) return "Horario a coordinar";
  return `${horaDesde} a ${horaHasta} aprox.`;
}
function crearDias(referencia = new Date()) {
  const desplazada = dias => new Date(referencia.getTime() + dias * 24 * 60 * 60 * 1000);
  return {
    ayer: { label: "Ayer", fecha: fmtDate(desplazada(-1)) },
    hoy: { label: "Hoy", fecha: fmtDate(referencia) },
    manana: { label: "Mañana", fecha: fmtDate(desplazada(1)) },
  };
}
function isoDate(d) { return d.toISOString().slice(0, 10); }

/* ---------------------------------- HELPERS UI ---------------------------------- */
function Spinner({ size = 16 }) { const c = useTheme(); return <Loader2 size={size} color={c.textFaint} style={{ animation: "spin 0.9s linear infinite" }} />; }
function Cargando({ label = "Cargando..." }) { const c = useTheme(); return <div className="flex items-center justify-center gap-2 py-10"><Spinner /><span className="f-body text-xs" style={{ color: c.textFaint }}>{label}</span></div>; }
function ErrorBanner({ mensaje }) {
  useEffect(() => { if (mensaje) mostrarErrorGlobal(mensaje); }, [mensaje]);
  return null;
}
function ErrorModal() {
  const c = useTheme();
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    const mostrar = (evento) => setMensaje(evento.detail?.mensaje || "No pudimos completar la acción.");
    const errorInesperado = () => mostrarErrorGlobal("Ocurrió un problema inesperado. Intentá nuevamente.");
    window.addEventListener(ERROR_GLOBAL_EVENT, mostrar);
    window.addEventListener("error", errorInesperado);
    window.addEventListener("unhandledrejection", errorInesperado);
    return () => {
      window.removeEventListener(ERROR_GLOBAL_EVENT, mostrar);
      window.removeEventListener("error", errorInesperado);
      window.removeEventListener("unhandledrejection", errorInesperado);
    };
  }, []);

  useEffect(() => {
    if (!mensaje) return;
    const cerrarConEscape = (evento) => { if (evento.key === "Escape") setMensaje(""); };
    window.addEventListener("keydown", cerrarConEscape);
    return () => window.removeEventListener("keydown", cerrarConEscape);
  }, [mensaje]);

  if (!mensaje) return null;
  return (
    <div role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setMensaje(""); }} className="modal-backdrop-in fixed inset-0 flex items-center justify-center px-4" style={{ zIndex: 1000, background: "rgba(2, 8, 23, 0.72)", backdropFilter: "blur(4px)" }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="error-modal-titulo" aria-describedby="error-modal-mensaje" className="modal-card-in w-full max-w-sm rounded-2xl p-5 shadow-2xl" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: c.dangerSoft }}><AlertCircle size={22} color={c.danger} /></div>
        <h2 id="error-modal-titulo" className="f-display text-lg font-semibold" style={{ color: c.text }}>No pudimos completar la acción</h2>
        <p id="error-modal-mensaje" className="f-body text-sm mt-2 leading-relaxed" style={{ color: c.textMuted }}>{mensaje}</p>
        <button autoFocus onClick={() => setMensaje("")} className="f-body w-full mt-5 py-2.5 rounded-xl text-sm font-medium" style={{ background: c.accent, color: c.bgAlt }}>Entendido</button>
      </div>
    </div>
  );
}
function ConfirmModal() {
  const c = useTheme();
  const [confirmacion, setConfirmacion] = useState(null);
  const [cerrando, setCerrando] = useState(false);

  useEffect(() => {
    const abrir = (evento) => {
      setCerrando(false);
      setConfirmacion(evento.detail);
    };
    window.addEventListener(CONFIRM_GLOBAL_EVENT, abrir);
    return () => window.removeEventListener(CONFIRM_GLOBAL_EVENT, abrir);
  }, []);

  const responder = useCallback((aceptado) => {
    if (!confirmacion || cerrando) return;
    setCerrando(true);
    window.setTimeout(() => {
      confirmacion.resolve(aceptado);
      setConfirmacion(null);
      setCerrando(false);
    }, 160);
  }, [confirmacion, cerrando]);

  useEffect(() => {
    if (!confirmacion) return;
    const cerrarConEscape = (evento) => { if (evento.key === "Escape") responder(false); };
    window.addEventListener("keydown", cerrarConEscape);
    return () => window.removeEventListener("keydown", cerrarConEscape);
  }, [confirmacion, responder]);

  if (!confirmacion) return null;
  const color = confirmacion.peligro ? c.danger : c.accent;
  const fondoIcono = confirmacion.peligro ? c.dangerSoft : c.accentSoft;

  return (
    <div
      role="presentation"
      onMouseDown={e => { if (e.target === e.currentTarget) responder(false); }}
      className={`${cerrando ? "modal-backdrop-out" : "modal-backdrop-in"} fixed inset-0 flex items-center justify-center px-4`}
      style={{ zIndex: 1001, background: "rgba(2, 8, 23, 0.76)", backdropFilter: "blur(6px)" }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-titulo"
        aria-describedby="confirm-modal-mensaje"
        className={`${cerrando ? "modal-card-out" : "modal-card-in"} w-full max-w-md rounded-2xl p-5 shadow-2xl`}
        style={{ background: c.surface, border: `1px solid ${c.border}` }}
      >
        <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: fondoIcono }}>
          {confirmacion.peligro ? <Trash2 size={21} color={color} /> : <CheckCircle2 size={21} color={color} />}
        </div>
        <h2 id="confirm-modal-titulo" className="f-display text-lg font-semibold" style={{ color: c.text }}>{confirmacion.titulo}</h2>
        <p id="confirm-modal-mensaje" className="f-body text-sm mt-2 leading-relaxed" style={{ color: c.textMuted }}>{confirmacion.mensaje}</p>
        <div className="grid grid-cols-2 gap-2.5 mt-6">
          <button onClick={() => responder(false)} className="f-body py-2.5 rounded-xl text-sm font-medium" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.text }}>{confirmacion.textoCancelar}</button>
          <button autoFocus onClick={() => responder(true)} className="f-body py-2.5 rounded-xl text-sm font-semibold" style={{ background: color, color: confirmacion.peligro ? "#FFFFFF" : c.bgAlt }}>{confirmacion.textoConfirmar}</button>
        </div>
      </div>
    </div>
  );
}
function ComprobanteModal({ url, onClose }) {
  const c = useTheme();
  useEffect(() => {
    if (!url) return;
    const cerrar = (evento) => { if (evento.key === "Escape") onClose(); };
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, [url, onClose]);
  if (!url) return null;
  return (
    <div role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }} className="modal-backdrop-in fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 1002, background: "rgba(2, 8, 23, 0.82)", backdropFilter: "blur(6px)" }}>
      <div role="dialog" aria-modal="true" aria-label="Comprobante de transferencia" className="modal-card-in relative w-full max-w-2xl rounded-2xl p-3 shadow-2xl" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
        <div className="flex items-center justify-between px-2 pb-3">
          <div className="flex items-center gap-2"><FileCheck2 size={18} color={c.accent} /><span className="f-display text-base font-semibold" style={{ color: c.text }}>Comprobante de transferencia</span></div>
          <button onClick={onClose} className="p-2 rounded-xl" style={{ background: c.surfaceAlt }} aria-label="Cerrar"><X size={17} color={c.textMuted} /></button>
        </div>
        <img src={url} alt="Comprobante de transferencia" className="block w-full max-h-[75vh] object-contain rounded-xl" style={{ background: c.bg }} />
      </div>
    </div>
  );
}
function EstadoBadge({ estado }) {
  const c = useTheme();
  const map = {
    pendiente: { label: "Pendiente", bg: c.amberSoft, fg: c.amber, Icon: Clock },
    entregado: { label: "Entregado", bg: c.successSoft, fg: c.success, Icon: CheckCircle2 },
    no_atendido: { label: "No había nadie", bg: c.dangerSoft, fg: c.danger, Icon: XCircle },
  };
  const m = map[estado] || map.pendiente;
  return <span className="f-body inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: m.bg, color: m.fg }}><m.Icon size={12} /> {m.label}</span>;
}
function CamionChip({ camion, small }) {
  const c = useTheme();
  if (!camion) return null;
  return <span className="f-body inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: `${camion.color}22`, color: camion.color }}><Truck size={small ? 11 : 13} /> {camion.nombre}</span>;
}
function Input(props) {
  const c = useTheme();
  return <input {...props} className={`f-body w-full px-3.5 py-2.5 rounded-xl text-sm outline-none ${props.className || ""}`} style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.text, ...(props.style || {}) }} />;
}
function Select({ children, ...props }) {
  const c = useTheme();
  return <select {...props} className="f-body px-3 py-2 rounded-lg text-xs outline-none" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.text }}>{children}</select>;
}
// Selector rápido de rango de fechas, reutilizado en Dashboard / Pedidos / Clientes
function RangoFechas({ desde, hasta, setDesde, setHasta }) {
  const c = useTheme();
  const preset = (dias) => {
    const h = new Date();
    const d = new Date();
    d.setDate(d.getDate() - (dias - 1));
    setDesde(isoDate(d)); setHasta(isoDate(h));
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button onClick={() => preset(7)} className="f-body text-[11px] px-2.5 py-1.5 rounded-lg" style={{ background: c.surfaceAlt, color: c.textMuted, border: `1px solid ${c.border}` }}>7 días</button>
      <button onClick={() => preset(30)} className="f-body text-[11px] px-2.5 py-1.5 rounded-lg" style={{ background: c.surfaceAlt, color: c.textMuted, border: `1px solid ${c.border}` }}>30 días</button>
      <button onClick={() => preset(90)} className="f-body text-[11px] px-2.5 py-1.5 rounded-lg" style={{ background: c.surfaceAlt, color: c.textMuted, border: `1px solid ${c.border}` }}>90 días</button>
      <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="f-body text-xs px-2 py-1.5 rounded-lg outline-none" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.text }} />
      <span className="f-body text-[11px]" style={{ color: c.textFaint }}>a</span>
      <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="f-body text-xs px-2 py-1.5 rounded-lg outline-none" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.text }} />
      {(desde || hasta) && <button onClick={() => { setDesde(""); setHasta(""); }} className="f-body text-[11px] underline" style={{ color: c.textFaint }}>Limpiar</button>}
    </div>
  );
}

/* ---------------------------------- ZONE MAP ---------------------------------- */
function DeliveryMap({ barrio, direccion }) {
  const c = useTheme();
  const ubicacion = [direccion, barrio, "Córdoba, Argentina"].filter(Boolean).join(", ");
  const mapaUrl = `https://www.google.com/maps?q=${encodeURIComponent(ubicacion)}&z=15&output=embed`;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: c.bgAlt, border: `1px solid ${c.borderSoft}` }}>
      <div className="flex items-start gap-2.5 p-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: c.accentSoft }}>
          <MapPin size={17} color={c.accent} />
        </div>
        <div>
          <p className="f-body text-[11px] uppercase tracking-wide" style={{ color: c.textFaint }}>Lugar de entrega</p>
          <p className="f-display text-sm font-semibold" style={{ color: c.text }}>{barrio}</p>
          <p className="f-body text-xs mt-0.5" style={{ color: c.textMuted }}>{direccion}</p>
        </div>
      </div>
      <iframe
        title={`Mapa de entrega en ${barrio}`}
        src={mapaUrl}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        style={{ width: "100%", height: 220, border: 0, display: "block" }}
      />
    </div>
  );
}

function ZoneMap({ highlightBarrio, zonas }) {
  const c = useTheme();
  const cells = [
    { barrio: "Alta Córdoba" }, { barrio: "General Paz" }, { barrio: "Colón" },
    { barrio: "Cerro de las Rosas" }, { barrio: "Centro" }, { barrio: "Nueva Córdoba" }, { barrio: "Rogelio Martínez" },
    { barrio: "Villa Belgrano" }, { barrio: "Güemes" }, { barrio: "Providencia" }, { barrio: "Villa Allende" },
    { barrio: "Jardín" }, { barrio: "Alberdi" }, { barrio: "San Vicente" }, { barrio: "Talleres" },
  ];
  const find = (nombreBarrio) => (zonas || []).find(z => z.barrio === nombreBarrio);

  return (
    <div className="rounded-2xl p-4" style={{ background: c.bgAlt, border: `1px solid ${c.borderSoft}` }}>
      <div className="grid grid-cols-4 gap-1.5">
        {cells.map((cell) => {
          const z = find(cell.barrio);
          const active = highlightBarrio === cell.barrio;
          return (
            <div key={cell.barrio} className="f-body relative rounded-lg flex items-end p-1.5 transition-all" style={{ aspectRatio: "1.2", background: z ? `${z.color}${active ? "55" : "20"}` : c.surface, border: `1.5px solid ${active ? z?.color : "transparent"}`, boxShadow: active ? `0 0 0 3px ${z.color}33` : "none" }}>
              <span className="text-[9px] leading-tight" style={{ color: active ? c.text : c.textFaint }}>{cell.barrio}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------- WHATSAPP FLOTANTE ---------------------------------- */
function WhatsAppFlotante() {
  const c = useTheme();
  return (
    <a href="https://wa.me/3515937318" target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-2"
      style={{ position: "fixed", bottom: 68, right: 18, zIndex: 60, textDecoration: "none" }}>
      <span className="f-body text-xs px-3 py-2 rounded-full shadow-lg hidden sm:inline-block" style={{ background: c.surface, color: c.text, border: `1px solid ${c.border}` }}>
        ¿Alguna duda? Escribinos acá 👋
      </span>
      <span className="wsp-bounce" style={{ width: 54, height: 54, borderRadius: "9999px", background: "#25D366", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 20px rgba(0,0,0,0.28)" }}>
        <MessageCircle size={27} color="#fff" fill="#fff" />
      </span>
    </a>
  );
}

/* ---------------------------------- VIDRIERA (CLIENTE) ---------------------------------- */
function ClientePortal({ onAccesoInterno }) {
  const c = useTheme();
  const [productos, setProductos] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0); // 0: segmento, 1: productos, 2: datos, 3: revisión
  const [segmento, setSegmento] = useState(null); // { id, categoria, label }
  const [cant, setCant] = useState({});
  const [form, setForm] = useState({ nombre: "", telefono: "", barrio: "", calle: "", tipo: "casa", pago: "Efectivo", notas: "", fechaEntrega: "", horarioZonaId: "" });
  const [datosTransferencia, setDatosTransferencia] = useState({ titular: "", banco: "", alias: "", cbu: "", cuit: "", configurados: false });
  const [comprobante, setComprobante] = useState(null);
  const [confirmado, setConfirmado] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [disponibilidad, setDisponibilidad] = useState([]);
  const [cargandoDisponibilidad, setCargandoDisponibilidad] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [prods, zs, datosPago] = await Promise.all([api("/public/productos"), api("/public/zonas"), api("/public/configuracion-pago")]);
        setProductos(prods);
        setZonas(zs.map(z => ({ barrio: z.barrio, camionId: z.camionId, nombre: z.camionNombre, color: colorDeCamion(z.camionId), diasEntrega: z.diasEntrega || [] })));
        setDatosTransferencia(datosPago);
      } catch (e) { setError("No pudimos cargar el catálogo. Refrescá la página."); }
      setCargando(false);
    })();
  }, []);

  useEffect(() => {
    if (!form.barrio) {
      setDisponibilidad([]);
      return;
    }
    let vigente = true;
    setCargandoDisponibilidad(true);
    api(`/public/disponibilidad?barrio=${encodeURIComponent(form.barrio)}`)
      .then(data => { if (vigente) setDisponibilidad(data.disponibilidad || []); })
      .catch(() => { if (vigente) setDisponibilidad([]); })
      .finally(() => { if (vigente) setCargandoDisponibilidad(false); });
    return () => { vigente = false; };
  }, [form.barrio]);

  const productosDelSegmento = productos.filter(p => !segmento || p.categoria === segmento.categoria);
  const totalItems = Object.values(cant).reduce((a, b) => a + b, 0);
  const totalPrecio = Object.entries(cant).reduce((sum, [id, q]) => sum + (productos.find(p => p.id === Number(id))?.precio ? Number(productos.find(p => p.id === Number(id)).precio) * q : 0), 0);
  const camionAsignado = useMemo(() => { const z = zonas.find(x => x.barrio === form.barrio); return z ? { id: z.camionId, nombre: z.nombre, color: z.color } : null; }, [form.barrio, zonas]);
  const fechaElegida = disponibilidad.find(d => d.fecha === form.fechaEntrega);
  const horarioElegido = fechaElegida?.horarios.find(h => h.id === Number(form.horarioZonaId));
  const setQty = (id, delta) => setCant(prev => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + delta) }));

  const elegirSegmento = (op) => {
    setSegmento(op);
    setCant({});
    setForm(prev => ({ ...prev, tipo: TIPO_DESTINO_POR_SEGMENTO[op.id] || "casa" }));
    setStep(1);
  };

  const confirmar = async () => {
    setEnviando(true); setError("");
    try {
      const items = Object.entries(cant).filter(([, q]) => q > 0).map(([id, q]) => ({ productoId: Number(id), cantidad: q }));
      const pedido = { nombre: form.nombre, telefono: form.telefono, barrio: form.barrio, calle: form.calle, tipo: form.tipo, segmento: segmento?.categoria || "consumo_personal", pago: form.pago, notas: form.notas, fechaEntrega: form.fechaEntrega, horarioZonaId: Number(form.horarioZonaId), items };
      let body = pedido;
      if (form.pago === "Transferencia") {
        const multipart = new FormData();
        multipart.append("pedido", JSON.stringify(pedido));
        multipart.append("comprobante", comprobante);
        body = multipart;
      }
      const resp = await api("/public/pedidos", { method: "POST", body });
      setConfirmado(resp);
    } catch (e) {
      setError(e.message || "No pudimos registrar el pedido.");
      setStep(2);
      if (form.barrio) {
        api(`/public/disponibilidad?barrio=${encodeURIComponent(form.barrio)}`)
          .then(data => setDisponibilidad(data.disponibilidad || []))
          .catch(() => {});
      }
    }
    setEnviando(false);
  };

  if (cargando) return <div className="flex-1 flex items-center justify-center" style={{ background: c.bg }}><Cargando label="Cargando la tienda..." /></div>;

  return (
    <div className="flex-1 flex flex-col" style={{ background: c.bg }}>
      <div className="sticky top-0 z-10" style={{ background: `${c.bg}E6`, borderBottom: `1px solid ${c.borderSoft}`, backdropFilter: "blur(6px)" }}>
        <div className="max-w-md mx-auto px-4 py-3 flex items-center">
          <BrandLogo variant="word" className="h-8 w-auto max-w-[150px]" />
        </div>
      </div>

      <div className="flex-1">
        {confirmado ? (
          <div className="max-w-md mx-auto text-center py-10 px-4">
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-5" style={{ background: c.successSoft }}><CheckCircle2 size={30} color={c.success} /></div>
            <h2 className="f-display text-2xl font-semibold mb-2" style={{ color: c.text }}>¡Pedido confirmado!</h2>
            <p className="f-body text-sm mb-6" style={{ color: c.textMuted }}>Te llega con {confirmado.camion}. Te avisamos por WhatsApp antes de salir.</p>
            <div className="rounded-2xl p-5 text-left space-y-3" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
              <div className="flex justify-between f-body text-sm"><span style={{ color: c.textMuted }}>Cliente</span><span style={{ color: c.text }}>{form.nombre || "—"}</span></div>
              <div className="flex justify-between f-body text-sm"><span style={{ color: c.textMuted }}>Dirección</span><span style={{ color: c.text }}>{form.calle}, {form.barrio}</span></div>
              <div className="flex justify-between f-body text-sm"><span style={{ color: c.textMuted }}>Entrega</span><span style={{ color: c.text }}>{formatearFechaEntrega(confirmado.fechaEntrega)}</span></div>
              <div className="flex justify-between f-body text-sm"><span style={{ color: c.textMuted }}>Franja</span><span style={{ color: c.text }}>{formatearFranja(confirmado.horaDesde, confirmado.horaHasta)}</span></div>
              <div className="flex justify-between f-body text-sm items-center"><span style={{ color: c.textMuted }}>Camión asignado</span><CamionChip camion={camionAsignado} small /></div>
              {form.notas && <div className="f-body text-sm"><span className="block mb-1" style={{ color: c.textMuted }}>Notas</span><span style={{ color: c.text }}>{form.notas}</span></div>}
              <div className="h-px" style={{ background: c.border }} />
              <div className="flex justify-between f-display text-base font-semibold"><span style={{ color: c.text }}>Total</span><span style={{ color: c.accent }}>${Number(confirmado.total).toLocaleString("es-AR")}</span></div>
            </div>
            <button onClick={() => { setConfirmado(null); setStep(0); setSegmento(null); setCant({}); setDisponibilidad([]); setComprobante(null); setForm({ nombre: "", telefono: "", barrio: "", calle: "", tipo: "casa", pago: "Efectivo", notas: "", fechaEntrega: "", horarioZonaId: "" }); }} className="f-body mt-6 text-sm underline" style={{ color: c.textMuted }}>Hacer otro pedido</button>
          </div>
        ) : (
          <div className="max-w-md mx-auto px-4 py-6">
            <div className="mb-6"><p className="f-body text-xs tracking-wide uppercase" style={{ color: c.accent }}>Pedí online</p><h2 className="f-display text-2xl font-semibold" style={{ color: c.text }}>Agua para tu próxima entrega</h2></div>
            <div className="flex items-center gap-2 mb-6">{[0, 1, 2, 3].map(n => <div key={n} className="flex-1 h-1 rounded-full" style={{ background: step >= n ? c.accent : c.border }} />)}</div>
            <ErrorBanner mensaje={error} />

            {step === 0 && (
              <div className="space-y-3">
                <p className="f-body text-sm mb-1" style={{ color: c.text }}>¿Para qué necesitás pedir?</p>
                <p className="f-body text-xs mb-4" style={{ color: c.textFaint }}>Así te mostramos el catálogo y los precios que corresponden.</p>
                {OPCIONES_SEGMENTO.map(op => (
                  <button key={op.id} onClick={() => elegirSegmento(op)} className="f-body w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-colors" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: c.accentSoft }}><op.Icon size={20} color={c.accent} /></div>
                    <div className="flex-1"><p className="text-sm font-medium" style={{ color: c.text }}>{op.label}</p><p className="text-xs" style={{ color: c.textFaint }}>{op.desc}</p></div>
                    <ChevronRight size={16} color={c.textFaint} />
                  </button>
                ))}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-3">
                <button onClick={() => setStep(0)} className="f-body flex items-center gap-1 text-xs mb-1" style={{ color: c.textFaint }}><ChevronLeft size={13} /> {segmento?.label}</button>
                {productosDelSegmento.map(p => (
                  <div key={p.id} className="rounded-2xl p-4 flex items-center gap-3" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 overflow-hidden" style={{ background: c.accentSoft }}>
                      {p.imagenUrl ? <img src={p.imagenUrl} alt={p.nombre} className="w-full h-full object-cover" loading="lazy" /> : <Droplet size={18} color={c.accent} />}
                    </div>
                    <div className="flex-1 min-w-0"><p className="f-body text-sm font-medium" style={{ color: c.text }}>{p.nombre}</p><p className="f-body text-xs" style={{ color: c.textFaint }}>{p.descripcion}</p><p className="f-mono text-xs mt-0.5" style={{ color: c.accent }}>${Number(p.precio).toLocaleString("es-AR")}</p></div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setQty(p.id, -1)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: c.surfaceAlt }}><Minus size={13} color={c.textMuted} /></button>
                      <span className="f-mono text-sm w-4 text-center" style={{ color: c.text }}>{cant[p.id] || 0}</span>
                      <button onClick={() => setQty(p.id, 1)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: c.accentSoft }}><Plus size={13} color={c.accent} /></button>
                    </div>
                  </div>
                ))}
                {productosDelSegmento.length === 0 && <p className="f-body text-xs text-center py-6" style={{ color: c.textFaint }}>Todavía no hay productos cargados para esta categoría.</p>}
                <button disabled={totalItems === 0} onClick={() => setStep(2)} className="f-body w-full mt-2 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-40" style={{ background: c.accent, color: c.bgAlt }}>Continuar ({totalItems}) <ChevronRight size={15} /></button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <Input placeholder="Nombre y apellido" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
                <Input placeholder="Teléfono" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
                <Input placeholder="Calle y altura" value={form.calle} onChange={e => setForm({ ...form, calle: e.target.value })} />
                <select value={form.barrio} onChange={e => setForm({ ...form, barrio: e.target.value, fechaEntrega: "", horarioZonaId: "" })} className="f-body w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ background: c.surface, border: `1px solid ${c.border}`, color: form.barrio ? c.text : c.textFaint }}>
                  <option value="">Barrio (define tu zona de reparto)</option>
                  {zonas.map(z => <option key={z.barrio} value={z.barrio}>{z.barrio}</option>)}
                </select>
                {form.barrio && <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: c.accentSoft }}><MapPin size={14} color={c.accent} /><span className="f-body text-xs" style={{ color: c.text }}>Tu zona corresponde a</span><CamionChip camion={camionAsignado} small /></div>}
                {form.barrio && (
                  <div className="rounded-2xl p-3.5 space-y-3" style={{ background: c.bgAlt, border: `1px solid ${c.border}` }}>
                    <div>
                      <p className="f-body text-xs font-medium" style={{ color: c.text }}>Elegí el día de entrega</p>
                      <p className="f-body text-[11px] mt-0.5" style={{ color: c.textFaint }}>Estas son las próximas fechas disponibles para tu zona.</p>
                    </div>
                    {cargandoDisponibilidad ? <div className="flex items-center gap-2 py-2"><Spinner size={13} /><span className="f-body text-[11px]" style={{ color: c.textFaint }}>Buscando próximos turnos...</span></div> : disponibilidad.length > 0 ? (
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {disponibilidad.slice(0, 10).map(d => (
                          <button key={d.fecha} onClick={() => setForm({ ...form, fechaEntrega: d.fecha, horarioZonaId: "" })} className="f-body shrink-0 rounded-xl px-3 py-2 text-left" style={{ background: form.fechaEntrega === d.fecha ? c.accentSoft : c.surface, border: `1px solid ${form.fechaEntrega === d.fecha ? c.accent : c.border}` }}>
                            <span className="block text-xs font-medium" style={{ color: form.fechaEntrega === d.fecha ? c.accent : c.text }}>{new Date(`${d.fecha}T00:00:00Z`).toLocaleDateString("es-AR", { timeZone: "UTC", weekday: "short", day: "numeric" })}</span>
                            <span className="block text-[10px] mt-0.5" style={{ color: c.textFaint }}>{new Date(`${d.fecha}T00:00:00Z`).toLocaleDateString("es-AR", { timeZone: "UTC", month: "short" })}</span>
                          </button>
                        ))}
                      </div>
                    ) : <p className="f-body text-[11px] px-3 py-2 rounded-lg" style={{ color: c.amber, background: c.amberSoft }}>No hay turnos disponibles para este barrio. Escribinos para coordinar.</p>}
                    {fechaElegida && (
                      <div>
                        <p className="f-body text-xs mb-1.5" style={{ color: c.textMuted }}>Franja horaria aproximada</p>
                        <div className="flex flex-wrap gap-2">
                          {fechaElegida.horarios.map(h => (
                            <button key={h.id} onClick={() => setForm({ ...form, horarioZonaId: h.id })} className="f-body px-3 py-2 rounded-lg text-xs" style={{ background: Number(form.horarioZonaId) === h.id ? c.accentSoft : c.surface, border: `1px solid ${Number(form.horarioZonaId) === h.id ? c.accent : c.border}`, color: Number(form.horarioZonaId) === h.id ? c.accent : c.textMuted }}>
                              {formatearFranja(h.horaDesde, h.horaHasta)}{h.cupoDisponible <= 2 ? ` · ${h.cupoDisponible} cupo${h.cupoDisponible === 1 ? "" : "s"}` : ""}
                            </button>
                          ))}
                        </div>
                        <p className="f-body text-[11px] mt-1.5" style={{ color: c.textFaint }}>La hora es aproximada: el chofer organiza el recorrido dentro de esta franja.</p>
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <p className="f-body text-xs mb-1.5" style={{ color: c.textMuted }}>Tipo de destino</p>
                  <div className="f-body w-full px-4 py-3 rounded-xl text-sm flex items-center justify-between" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
                    <span style={{ color: c.text }}>{segmento?.label || "—"}</span>
                    <span className="text-[11px]" style={{ color: c.textFaint }}>Elegido al inicio</span>
                  </div>
                </div>
                <div><p className="f-body text-xs mb-1.5" style={{ color: c.textMuted }}>Cómo vas a pagar</p><div className="flex gap-2 flex-wrap">{PAGOS.map(p => <button key={p} onClick={() => { setForm({ ...form, pago: p }); if (p !== "Transferencia") setComprobante(null); }} className="f-body px-3 py-2 rounded-lg text-xs" style={{ background: form.pago === p ? c.accentSoft : c.surface, border: `1px solid ${form.pago === p ? c.accent : c.border}`, color: form.pago === p ? c.accent : c.textMuted }}>{p}</button>)}</div><p className="f-body text-[11px] mt-1.5" style={{ color: c.textFaint }}>{form.pago === "Transferencia" ? "Transferí el total y adjuntá la captura para que podamos verificarla." : "El pago en efectivo se coordina con el chofer."}</p></div>
                {form.pago === "Transferencia" && (
                  <div className="rounded-2xl p-4 space-y-3" style={{ background: c.accentSoft, border: `1px solid ${c.accent}44` }}>
                    <div className="flex items-center gap-2"><Landmark size={17} color={c.accent} /><p className="f-body text-sm font-medium" style={{ color: c.text }}>Datos para transferir</p></div>
                    {datosTransferencia.configurados ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {datosTransferencia.titular && <div><span className="block" style={{ color: c.textFaint }}>Titular</span><span className="f-body" style={{ color: c.text }}>{datosTransferencia.titular}</span></div>}
                        {datosTransferencia.banco && <div><span className="block" style={{ color: c.textFaint }}>Banco</span><span className="f-body" style={{ color: c.text }}>{datosTransferencia.banco}</span></div>}
                        {datosTransferencia.alias && <div><span className="block" style={{ color: c.textFaint }}>Alias</span><span className="f-mono" style={{ color: c.text }}>{datosTransferencia.alias}</span></div>}
                        {datosTransferencia.cbu && <div><span className="block" style={{ color: c.textFaint }}>CBU/CVU</span><span className="f-mono break-all" style={{ color: c.text }}>{datosTransferencia.cbu}</span></div>}
                        {datosTransferencia.cuit && <div><span className="block" style={{ color: c.textFaint }}>CUIT</span><span className="f-mono" style={{ color: c.text }}>{datosTransferencia.cuit}</span></div>}
                      </div>
                    ) : <p className="f-body text-xs" style={{ color: c.amber }}>Los datos todavía no están publicados. Escribinos por WhatsApp antes de confirmar.</p>}
                    <label className="f-body flex items-center justify-center gap-2 w-full px-3 py-3 rounded-xl text-xs font-medium cursor-pointer" style={{ background: c.surface, border: `1px dashed ${comprobante ? c.success : c.accent}`, color: comprobante ? c.success : c.accent }}>
                      {comprobante ? <FileCheck2 size={16} /> : <Upload size={16} />}
                      <span className="truncate">{comprobante ? comprobante.name : "Subir captura del pago"}</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => setComprobante(e.target.files?.[0] || null)} />
                    </label>
                    <p className="f-body text-[10px]" style={{ color: c.textFaint }}>JPG, PNG o WebP · máximo 5 MB.</p>
                  </div>
                )}
                <div>
                  <p className="f-body text-xs mb-1.5" style={{ color: c.textMuted }}>Notas para la entrega <span style={{ color: c.textFaint }}>(opcional)</span></p>
                  <textarea value={form.notas} maxLength={500} onChange={e => setForm({ ...form, notas: e.target.value })} rows={3} placeholder="Ej.: tocar timbre 2, portón negro, llamar antes de llegar..." className="f-body w-full px-4 py-3 rounded-xl text-sm outline-none resize-none" style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.text }} />
                  <p className="f-body text-[10px] text-right mt-0.5" style={{ color: c.textFaint }}>{form.notas.length}/500</p>
                </div>
                <div className="flex gap-2 pt-1"><button onClick={() => setStep(1)} className="f-body py-3 px-4 rounded-xl text-sm" style={{ background: c.surface, color: c.textMuted, border: `1px solid ${c.border}` }}><ChevronLeft size={15} /></button><button disabled={!form.nombre || !form.telefono || !form.barrio || !form.calle || !form.fechaEntrega || !form.horarioZonaId || (form.pago === "Transferencia" && (!datosTransferencia.configurados || !comprobante))} onClick={() => setStep(3)} className="f-body flex-1 py-3 rounded-xl text-sm font-medium disabled:opacity-40" style={{ background: c.accent, color: c.bgAlt }}>Revisar pedido</button></div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <DeliveryMap barrio={form.barrio} direccion={form.calle} />
                <div className="rounded-2xl p-4 space-y-2" style={{ background: c.accentSoft, border: `1px solid ${c.accent}33` }}>
                  <div className="flex items-start gap-2"><CalendarClock size={16} color={c.accent} className="mt-0.5 shrink-0" /><div><p className="f-body text-sm font-medium" style={{ color: c.text }}>{formatearFechaEntrega(form.fechaEntrega)}</p><p className="f-body text-xs mt-0.5" style={{ color: c.textMuted }}>{formatearFranja(horarioElegido?.horaDesde, horarioElegido?.horaHasta)} · horario aproximado</p></div></div>
                  {form.notas && <div className="f-body text-xs pt-2" style={{ borderTop: `1px solid ${c.borderSoft}`, color: c.textMuted }}><b style={{ color: c.text }}>Notas:</b> {form.notas}</div>}
                </div>
                <div className="rounded-2xl p-4 space-y-2.5" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
                  {Object.entries(cant).filter(([, q]) => q > 0).map(([id, q]) => { const p = productos.find(x => x.id === Number(id)); if (!p) return null; return <div key={id} className="flex justify-between f-body text-sm"><span style={{ color: c.text }}>{q}× {p.nombre}</span><span className="f-mono" style={{ color: c.textMuted }}>${(Number(p.precio) * q).toLocaleString("es-AR")}</span></div>; })}
                  <div className="h-px my-1" style={{ background: c.border }} />
                  <div className="flex justify-between f-display text-base font-semibold"><span style={{ color: c.text }}>Total</span><span style={{ color: c.accent }}>${totalPrecio.toLocaleString("es-AR")}</span></div>
                  <div className="flex justify-between f-body text-xs pt-1"><span style={{ color: c.textMuted }}>Pago</span><span style={{ color: c.text }}>{form.pago}{form.pago === "Transferencia" ? " · comprobante adjunto" : ""}</span></div>
                </div>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: c.amberSoft }}><Clock size={15} color={c.amber} /><span className="f-body text-xs" style={{ color: c.text }}>El chofer organiza su recorrido dentro de la franja elegida; te avisaremos antes de llegar.</span></div>
                <div className="flex gap-2"><button onClick={() => setStep(2)} className="f-body py-3 px-4 rounded-xl text-sm" style={{ background: c.surface, color: c.textMuted, border: `1px solid ${c.border}` }}><ChevronLeft size={15} /></button><button disabled={enviando} onClick={confirmar} className="f-body flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: c.accent, color: c.bgAlt }}>{enviando && <Spinner size={14} />} Confirmar pedido</button></div>
              </div>
            )}
          </div>
        )}
      </div>

      <button onClick={onAccesoInterno} className="f-body flex items-center justify-center gap-1.5 py-4 text-[11px] opacity-60 hover:opacity-100 transition-opacity" style={{ color: c.textFaint }}>
        <Lock size={11} /> Acceso interno
      </button>
      <WhatsAppFlotante />
    </div>
  );
}

/* ---------------------------------- CANDADO PREVIO AL ACCESO INTERNO ---------------------------------- */
function AccesoPrivadoGate({ onDesbloqueado, onVolver }) {
  const c = useTheme();
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const validar = async () => {
    setCargando(true); setError("");
    try {
      const resp = await api("/public/area-privada/verificar", { method: "POST", body: { clave } });
      if (resp.ok) onDesbloqueado();
      else { setError("Contraseña incorrecta."); mostrarErrorGlobal("La contraseña del área privada no es correcta."); }
    } catch (e) { setError("No pudimos verificar la clave. Probá de nuevo."); }
    setCargando(false);
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4" style={{ background: c.bgAlt }}>
      <div className="w-full max-w-sm">
        <button onClick={onVolver} className="f-body flex items-center gap-1 text-xs mb-6" style={{ color: c.textFaint }}><ChevronLeft size={13} /> Volver a la tienda</button>
        <div className="text-center mb-6">
          <BrandLogo variant="full" className="h-28 w-auto max-w-[160px] mx-auto mb-5" />
          <h2 className="f-display text-lg font-semibold" style={{ color: c.text }}>Área privada</h2>
          <p className="f-body text-xs mt-1" style={{ color: c.textFaint }}>Ingresá la contraseña del apartado para continuar</p>
        </div>
        <div className="space-y-2.5">
          <Input placeholder="Contraseña de acceso" type="password" value={clave} onChange={e => { setClave(e.target.value); setError(""); }} onKeyDown={e => e.key === "Enter" && validar()} style={error ? { borderColor: c.danger } : {}} />
          <ErrorBanner mensaje={error} />
          <button onClick={validar} disabled={cargando} className="f-body w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-70" style={{ background: c.accent, color: c.bgAlt }}>{cargando && <Spinner size={14} />} Continuar</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- LOGIN GATE ---------------------------------- */
function LoginGate({ onLogin, onVolver }) {
  const c = useTheme();
  const [role, setRole] = useState("admin");
  const [usuario, setUsuario] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const cambiarRole = (r) => { setRole(r); setUsuario(""); setPass(""); setError(""); };

  const ingresar = async () => {
    if (!usuario.trim() || !pass.trim()) {
      const mensaje = "Completá usuario y contraseña.";
      setError(mensaje); mostrarErrorGlobal(mensaje); return;
    }
    setCargando(true); setError("");
    try {
      const resp = await api(`/auth/${role}/login`, { method: "POST", body: { usuario: usuario.trim(), password: pass } });
      const payload = decodeJwt(resp.token);
      onLogin({ role, token: resp.token, nombre: resp.nombre, camion: resp.camion, camionId: payload.camionId });
    } catch (e) { setError(e.message || "Usuario o contraseña incorrectos."); }
    setCargando(false);
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4" style={{ background: c.bgAlt }}>
      <div className="w-full max-w-sm">
        <button onClick={onVolver} className="f-body flex items-center gap-1 text-xs mb-6" style={{ color: c.textFaint }}><ChevronLeft size={13} /> Volver a la tienda</button>
        <div className="text-center mb-6">
          <BrandLogo variant="full" className="h-28 w-auto max-w-[160px] mx-auto mb-5" />
          <h2 className="f-display text-lg font-semibold" style={{ color: c.text }}>Acceso interno</h2>
        </div>
        <div className="flex rounded-xl p-1 mb-5" style={{ background: c.surface }}>
          {[{ id: "admin", label: "Administrador" }, { id: "chofer", label: "Chofer" }].map(r => (
            <button key={r.id} onClick={() => cambiarRole(r.id)} className="f-body flex-1 py-2 rounded-lg text-xs font-medium" style={{ background: role === r.id ? c.accent : "transparent", color: role === r.id ? c.bgAlt : c.textMuted }}>{r.label}</button>
          ))}
        </div>
        <div className="space-y-2.5">
          <Input placeholder="Usuario" value={usuario} onChange={e => { setUsuario(e.target.value); setError(""); }} />
          <Input placeholder="Contraseña" type="password" value={pass} onChange={e => { setPass(e.target.value); setError(""); }} onKeyDown={e => e.key === "Enter" && ingresar()} style={error ? { borderColor: c.danger } : {}} />
          <ErrorBanner mensaje={error} />
          <button onClick={ingresar} disabled={cargando} className="f-body w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-70" style={{ background: c.accent, color: c.bgAlt }}>{cargando && <Spinner size={14} />} Ingresar</button>
        </div>
        <p className="f-body text-[11px] text-center mt-4" style={{ color: c.textFaint }}>{role === "chofer" ? "El usuario y contraseña de cada camión los define el administrador desde su panel." : "Se valida contra la base de datos real."}</p>
      </div>
    </div>
  );
}

/* ---------------------------------- CHOFER PANEL ---------------------------------- */
function ChoferPanel({ session, onLogout }) {
  const c = useTheme();
  const [dia, setDia] = useState("hoy");
  const [dias, setDias] = useState(() => crearDias());
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [confirmandoPago, setConfirmandoPago] = useState(null); // id del pedido al que le estoy pidiendo el método de pago
  const camionColor = colorDeCamion(session.camionId);
  const diaEditable = dia !== "manana";

  const cargar = useCallback(async (mostrarSpinner) => {
    if (mostrarSpinner) setCargando(true);
    try { setPedidos(await api(`/chofer/pedidos?dia=${dia}`, { token: session.token })); setError(""); }
    catch (e) { setError("No pudimos cargar tu ruta."); }
    if (mostrarSpinner) setCargando(false);
  }, [dia, session.token]);

  useEffect(() => { cargar(true); }, [cargar]);
  useEffect(() => { const t = setInterval(() => cargar(false), 8000); return () => clearInterval(t); }, [cargar]);
  useEffect(() => {
    const actualizarFechas = () => setDias(crearDias());
    const t = setInterval(actualizarFechas, 60000);
    return () => clearInterval(t);
  }, []);

  const hoyPend = dia === "hoy" ? pedidos.filter(o => o.estado === "pendiente").length : null;
  const hoyEnt = dia === "hoy" ? pedidos.filter(o => o.estado === "entregado").length : null;

  const marcar = async (id, estado, pagoConfirmado) => {
    setConfirmandoPago(null);
    setPedidos(prev => prev.map(o => o.id === id ? { ...o, estado, pagoConfirmado: pagoConfirmado || null } : o)); // optimista
    try { await api(`/chofer/pedidos/${id}/estado`, { method: "PATCH", token: session.token, body: { estado, pagoConfirmado } }); }
    catch (e) { setError(e.message || "No pudimos actualizar el pedido."); cargar(false); } // si falla, recargo de verdad
  };

  return (
    <div className="flex-1" style={{ background: c.bg }}>
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5">
          <BrandLogo variant="word" className="h-8 w-auto max-w-[150px]" />
          <button onClick={onLogout} className="f-body flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs" style={{ background: c.surface, color: c.textMuted }}><LogOut size={14} /> Salir</button>
        </div>
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${camionColor}22` }}><Truck size={16} color={camionColor} /></div>
            <div><p className="f-display text-sm font-semibold" style={{ color: c.text }}>{session.camion || "Tu camión"}</p><p className="f-body text-[11px]" style={{ color: c.textFaint }}>{session.nombre}</p></div>
          </div>
        </div>

        {dia === "hoy" && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="rounded-xl p-3" style={{ background: c.amberSoft }}><p className="f-display text-xl font-semibold" style={{ color: c.amber }}>{hoyPend}</p><p className="f-body text-xs" style={{ color: c.textMuted }}>Pendientes hoy</p></div>
            <div className="rounded-xl p-3" style={{ background: c.successSoft }}><p className="f-display text-xl font-semibold" style={{ color: c.success }}>{hoyEnt}</p><p className="f-body text-xs" style={{ color: c.textMuted }}>Entregados hoy</p></div>
          </div>
        )}

        <div className="flex rounded-xl p-1 mb-4" style={{ background: c.surface }}>
          {Object.entries(dias).map(([k, v]) => (
            <button key={k} onClick={() => { setDia(k); setConfirmandoPago(null); }} className="f-body flex-1 py-2 rounded-lg text-xs" style={{ background: dia === k ? c.accentSoft : "transparent", color: dia === k ? c.accent : c.textMuted, fontWeight: dia === k ? 600 : 400 }}>{v.label}<span className="block text-[10px] opacity-70">{v.fecha}</span></button>
          ))}
        </div>

        {dia === "ayer" && pedidos.some(o => o.estado === "pendiente") && (
          <p className="f-body text-[11px] mb-3 px-3 py-2 rounded-lg" style={{ background: c.amberSoft, color: c.amber }}>Los pendientes de ayer todavía se pueden completar.</p>
        )}

        <ErrorBanner mensaje={error} />
        {cargando ? <Cargando /> : (
          <>
            <p className="f-body text-[11px] mb-3 flex items-center gap-1.5" style={{ color: c.textFaint }}><MapPin size={11} /> Orden de parada según tu ruta</p>
            <div className="space-y-2.5">
              {pedidos.map((o) => (
                <div key={o.id} className="rounded-2xl p-4" style={{ background: c.surface, border: `1px solid ${c.border}`, opacity: dia === "manana" ? 0.75 : 1 }}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-start gap-2.5">
                      <span className="f-mono text-[11px] font-medium shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5" style={{ background: `${camionColor}22`, color: camionColor }}>{o.parada}</span>
                      <div><p className="f-body text-sm font-medium" style={{ color: c.text }}>{o.cliente}</p><p className="f-body text-xs flex items-center gap-1 mt-0.5" style={{ color: c.textFaint }}><MapPin size={11} /> {o.direccion}</p>{o.horaDesde && <p className="f-body text-[11px] flex items-center gap-1 mt-1" style={{ color: c.accent }}><Clock size={11} /> {formatearFranja(o.horaDesde, o.horaHasta)}</p>}</div>
                    </div>
                    <EstadoBadge estado={o.estado} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    {(o.productos || []).map(p => <span key={p} className="f-body text-[11px] px-2 py-0.5 rounded-full" style={{ background: c.surfaceAlt, color: c.textMuted }}>{p}</span>)}
                    <span className="f-body text-[11px] px-2 py-0.5 rounded-full" style={{ background: c.surfaceAlt, color: c.textMuted }}>Declaró: {o.pago}</span>
                    {o.total != null && <span className="f-mono text-[11px] px-2 py-0.5 rounded-full ml-auto font-medium" style={{ background: c.accentSoft, color: c.accent }}>${Number(o.total).toLocaleString("es-AR")}</span>}
                  </div>
                  {o.estado === "entregado" && o.pagoConfirmado && (
                    <p className="f-body text-[11px] mb-2 flex items-center gap-1" style={{ color: c.success }}><DollarSign size={11} /> Cobrado con: {o.pagoConfirmado}</p>
                  )}
                  {o.notas && <p className="f-body text-[11px] mb-3 px-2.5 py-2 rounded-lg" style={{ background: c.amberSoft, color: c.text }}><b>Nota:</b> {o.notas}</p>}

                  {diaEditable && o.estado === "pendiente" && confirmandoPago !== o.id && (
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmandoPago(o.id)} className="f-body flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1" style={{ background: c.successSoft, color: c.success }}><CheckCircle2 size={13} /> Entregado</button>
                      <button onClick={() => marcar(o.id, "no_atendido")} className="f-body flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1" style={{ background: c.dangerSoft, color: c.danger }}><XCircle size={13} /> No había nadie</button>
                    </div>
                  )}
                  {diaEditable && confirmandoPago === o.id && (
                    <div className="rounded-xl p-2.5" style={{ background: c.accentSoft }}>
                      <p className="f-body text-[11px] mb-2" style={{ color: c.text }}>¿Con qué te pagó?</p>
                      <div className="flex flex-wrap gap-1.5">
                        {PAGOS.map(p => <button key={p} onClick={() => marcar(o.id, "entregado", p)} className="f-body text-xs px-2.5 py-1.5 rounded-lg font-medium" style={{ background: c.surface, color: c.accent, border: `1px solid ${c.accent}` }}>{p}</button>)}
                        <button onClick={() => setConfirmandoPago(null)} className="f-body text-xs px-2.5 py-1.5 rounded-lg" style={{ color: c.textFaint }}>Cancelar</button>
                      </div>
                    </div>
                  )}
                  {diaEditable && o.estado !== "pendiente" && <button onClick={() => marcar(o.id, "pendiente")} className="f-body text-[11px] underline" style={{ color: c.textFaint }}>Revertir a pendiente</button>}
                  {dia === "manana" && <p className="f-body text-[11px]" style={{ color: c.textFaint }}>Programado — todavía no se puede marcar</p>}
                </div>
              ))}
              {pedidos.length === 0 && <p className="f-body text-xs text-center py-8" style={{ color: c.textFaint }}>Sin pedidos para este día.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- ADMIN: DASHBOARD ---------------------------------- */
function AdminDashboard({ token }) {
  const c = useTheme();
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [d, setD] = useState(null);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      setD(await api(`/admin/dashboard?${params.toString()}`, { token }));
      setError("");
    } catch (e) { setError("No pudimos cargar el dashboard."); }
  }, [token, desde, hasta]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { const t = setInterval(cargar, 15000); return () => clearInterval(t); }, [cargar]);

  if (error) return <ErrorBanner mensaje={error} />;
  if (!d) return <Cargando />;

  const porCamion = (d.porCamion || []).map(x => ({ nombre: x.camion.replace("Camión ", ""), pedidos: x.pedidos, color: x.color }));
  const serie = (d.serieDiaria || []).map(x => ({ ...x, fechaCorta: new Date(x.fecha + "T00:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" }) }));

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-2" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
        <p className="f-body text-xs" style={{ color: c.textMuted }}>Período del dashboard {!desde && !hasta && "(últimos 30 días por defecto)"}</p>
        <RangoFechas desde={desde} hasta={hasta} setDesde={setDesde} setHasta={setHasta} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Clientes totales", val: d.clientesTotales, color: c.text, Icon: Users },
          { label: "Clientes nuevos (período)", val: d.clientesNuevosPeriodo, color: c.accent, Icon: User },
          { label: "Pedidos del período", val: d.pedidosPeriodo, color: c.text, Icon: ClipboardList },
          { label: "Pedidos de hoy", val: d.pedidosHoy, color: c.accent, Icon: CalendarClock },
          { label: "Facturación del período", val: `$${Number(d.ingresosPeriodo).toLocaleString("es-AR")}`, color: c.amber, Icon: TrendingUp },
          { label: "Entrega efectiva", val: `${d.tasaEntrega}%`, color: c.success, Icon: CheckCircle2 },
        ].map(k => (
          <div key={k.label} className="rounded-2xl p-4" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
            <k.Icon size={15} color={c.textFaint} className="mb-2" />
            <p className="f-display text-xl font-semibold" style={{ color: k.color }}>{k.val}</p>
            <p className="f-body text-[11px] mt-0.5" style={{ color: c.textFaint }}>{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl p-4" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
          <p className="f-body text-xs font-medium mb-3 flex items-center gap-1.5" style={{ color: c.textMuted }}><BarChart3 size={13} /> Pedidos por camión (en el período)</p>
          <div style={{ height: 200 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={porCamion}><CartesianGrid strokeDasharray="3 3" stroke={c.borderSoft} vertical={false} /><XAxis dataKey="nombre" tick={{ fill: c.textFaint, fontSize: 11 }} axisLine={{ stroke: c.border }} tickLine={false} /><YAxis tick={{ fill: c.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip contentStyle={{ background: c.bgAlt, border: `1px solid ${c.border}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: c.text }} /><Bar dataKey="pedidos" radius={[6, 6, 0, 0]}>{porCamion.map((e, i) => <Cell key={i} fill={e.color} />)}</Bar></BarChart></ResponsiveContainer></div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
          <p className="f-body text-xs font-medium mb-3 flex items-center gap-1.5" style={{ color: c.textMuted }}><TrendingUp size={13} /> Ingresos por día</p>
          <div style={{ height: 200 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={serie}><CartesianGrid strokeDasharray="3 3" stroke={c.borderSoft} vertical={false} /><XAxis dataKey="fechaCorta" tick={{ fill: c.textFaint, fontSize: 10 }} axisLine={{ stroke: c.border }} tickLine={false} /><YAxis tick={{ fill: c.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: c.bgAlt, border: `1px solid ${c.border}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: c.text }} formatter={(v) => [`$${Number(v).toLocaleString("es-AR")}`, "Ingresos"]} /><Line type="monotone" dataKey="ingresos" stroke={c.accent} strokeWidth={2.5} dot={{ fill: c.accent, r: 3 }} /></LineChart></ResponsiveContainer></div>
        </div>
      </div>

      <div className="rounded-2xl p-4" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
        <p className="f-body text-xs font-medium mb-3 flex items-center gap-1.5" style={{ color: c.textMuted }}><Package size={13} /> Top 5 productos más vendidos (en el período)</p>
        <div className="space-y-2">
          {(d.topProductos || []).map((p, i) => (
            <div key={p.nombre} className="flex items-center gap-3">
              <span className="f-mono text-xs w-5 shrink-0" style={{ color: c.textFaint }}>#{i + 1}</span>
              <span className="f-body text-sm flex-1" style={{ color: c.text }}>{p.nombre}</span>
              <span className="f-mono text-xs shrink-0" style={{ color: c.textMuted }}>{p.cantidad} un.</span>
              <span className="f-mono text-xs shrink-0 font-medium" style={{ color: c.accent }}>${Number(p.total).toLocaleString("es-AR")}</span>
            </div>
          ))}
          {(!d.topProductos || d.topProductos.length === 0) && <p className="f-body text-xs" style={{ color: c.textFaint }}>Sin ventas en este período.</p>}
        </div>
      </div>
      <p className="f-body text-[11px]" style={{ color: c.textFaint }}>Se actualiza solo cada 15 segundos.</p>
    </div>
  );
}

/* ---------------------------------- ADMIN: PEDIDOS ---------------------------------- */
function AdminPedidos({ token, camiones }) {
  const c = useTheme();
  const [q, setQ] = useState(""); const [fCamion, setFCamion] = useState("todos"); const [fEstado, setFEstado] = useState("todos"); const [fDia, setFDia] = useState("hoy");
  const [desde, setDesde] = useState(""); const [hasta, setHasta] = useState("");
  const [grupos, setGrupos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [comprobanteUrl, setComprobanteUrl] = useState("");
  const [abriendoComprobante, setAbriendoComprobante] = useState(null);

  const cerrarComprobante = useCallback(() => {
    setComprobanteUrl(actual => { if (actual) URL.revokeObjectURL(actual); return ""; });
  }, []);
  useEffect(() => () => cerrarComprobante(), [cerrarComprobante]);

  const abrirComprobante = async (id) => {
    setAbriendoComprobante(id);
    try {
      const blob = await apiBlob(`/admin/pedidos/${id}/comprobante`, token);
      cerrarComprobante();
      setComprobanteUrl(URL.createObjectURL(blob));
    } finally { setAbriendoComprobante(null); }
  };

  const cargar = useCallback(async (mostrarSpinner) => {
    if (mostrarSpinner) setCargando(true);
    try {
      const params = new URLSearchParams();
      if (desde || hasta) {
        if (desde) params.set("desde", desde);
        if (hasta) params.set("hasta", hasta);
      } else if (fDia !== "todos") {
        params.set("dia", fDia);
      }
      if (fCamion !== "todos") params.set("camionId", fCamion);
      if (fEstado !== "todos") params.set("estado", fEstado);
      if (q) params.set("q", q);
      setGrupos(await api(`/admin/pedidos?${params.toString()}`, { token }));
      setError("");
    } catch (e) { setError("No pudimos cargar los pedidos."); }
    if (mostrarSpinner) setCargando(false);
  }, [token, fDia, fCamion, fEstado, q, desde, hasta]);

  useEffect(() => { cargar(true); }, [cargar]);
  useEffect(() => { const t = setInterval(() => cargar(false), 10000); return () => clearInterval(t); }, [cargar]);

  const reasignar = async (id, newCamionId) => {
    try { await api(`/admin/pedidos/${id}/camion`, { method: "PATCH", token, body: { camionId: Number(newCamionId) } }); cargar(false); }
    catch (e) { setError("No se pudo reasignar el pedido."); }
  };

  return (
    <div className="space-y-4">
      <ComprobanteModal url={comprobanteUrl} onClose={cerrarComprobante} />
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: c.accentSoft }}>
        <ArrowLeftRight size={14} color={c.accent} />
        <p className="f-body text-xs" style={{ color: c.text }}>Los pedidos vienen agrupados por camión y ordenados como hoja de ruta desde el servidor. Reasignalos desde el selector de cada fila.</p>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px]"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" color={c.textFaint} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar cliente..." className="f-body w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.text }} /></div>
        <Select value={fDia} onChange={e => setFDia(e.target.value)} disabled={Boolean(desde || hasta)}><option value="todos">Todos los días</option><option value="ayer">Ayer</option><option value="hoy">Hoy</option><option value="manana">Mañana</option></Select>
        <Select value={fCamion} onChange={e => setFCamion(e.target.value)}><option value="todos">Todos los camiones</option>{camiones.map(cm => <option key={cm.id} value={cm.id}>{cm.nombre}</option>)}</Select>
        <Select value={fEstado} onChange={e => setFEstado(e.target.value)}><option value="todos">Todos los estados</option><option value="pendiente">Pendiente</option><option value="entregado">Entregado</option><option value="no_atendido">No había nadie</option></Select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="f-body text-[11px]" style={{ color: c.textFaint }}>O por rango de fechas (anula el filtro de día):</span>
        <RangoFechas desde={desde} hasta={hasta} setDesde={setDesde} setHasta={setHasta} />
      </div>

      <ErrorBanner mensaje={error} />
      {cargando ? <Cargando /> : (
        <>
          {grupos.length === 0 && <div className="rounded-2xl py-10 text-center" style={{ background: c.surface, border: `1px solid ${c.border}` }}><p className="f-body text-xs" style={{ color: c.textFaint }}>Sin resultados para estos filtros.</p></div>}
          <div className="space-y-3">
            {grupos.map(({ camion: cm, pedidos: items }) => (
              <div key={cm.id} className="rounded-2xl overflow-hidden" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
                <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: `${cm.color}14`, borderBottom: `1px solid ${c.borderSoft}` }}>
                  <Truck size={13} color={cm.color} /><span className="f-body text-xs font-medium" style={{ color: cm.color }}>{cm.nombre}</span>
                  <span className="f-mono text-[11px] ml-auto" style={{ color: c.textFaint }}>{items.length} pedido{items.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full f-body text-xs">
                    <thead><tr>{["Parada", "Cliente", "Barrio", "Día", "Horario", "Notas", "Pago", "Total", "Camión", "Estado"].map(h => <th key={h} className="text-left px-4 py-2 font-medium whitespace-nowrap" style={{ color: c.textFaint, borderBottom: `1px solid ${c.borderSoft}` }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {items.map(o => (
                        <tr key={o.id} style={{ borderTop: `1px solid ${c.borderSoft}` }}>
                          <td className="px-4 py-2.5"><span className="f-mono text-[11px] w-5 h-5 rounded-full inline-flex items-center justify-center" style={{ background: `${cm.color}22`, color: cm.color }}>{o.parada}</span></td>
                          <td className="px-4 py-2.5" style={{ color: c.text }}>{o.cliente}</td>
                          <td className="px-4 py-2.5" style={{ color: c.textMuted }}>{o.barrio}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: c.textMuted }}>{new Date(o.fechaEntrega).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: o.horaDesde ? c.accent : c.textFaint }}>{formatearFranja(o.horaDesde, o.horaHasta)}</td>
                          <td className="px-4 py-2.5 max-w-[220px]" style={{ color: c.textMuted }}><span className="line-clamp-2" title={o.notas || ""}>{o.notas || "—"}</span></td>
                          <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: c.textMuted }}><div className="flex items-center gap-2"><span>{o.pagoConfirmado ? <span style={{ color: c.success }}>{o.pagoConfirmado} ✓</span> : (o.pago || "—")}</span>{o.tieneComprobante && <button onClick={() => abrirComprobante(o.id)} disabled={abriendoComprobante === o.id} className="f-body inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium disabled:opacity-60" style={{ background: c.accentSoft, color: c.accent }} title="Ver captura del pago">{abriendoComprobante === o.id ? <Spinner size={11} /> : <Eye size={11} />} Ver</button>}</div></td>
                          <td className="f-mono px-4 py-2.5" style={{ color: c.accent }}>${Number(o.total || 0).toLocaleString("es-AR")}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <select value={o.camionId} onChange={e => reasignar(o.id, e.target.value)} className="f-body text-[11px] rounded-md px-1.5 py-1 outline-none" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: camiones.find(x => x.id === o.camionId)?.color }}>
                                {camiones.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                              </select>
                              {o.reasignadoManual && <span className="f-body text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: c.amberSoft, color: c.amber }}>manual</span>}
                            </div>
                          </td>
                          <td className="px-4 py-2.5"><EstadoBadge estado={o.estado} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------------------------- ADMIN: CLIENTES ---------------------------------- */
function AdminClientes({ token }) {
  const c = useTheme();
  const [q, setQ] = useState(""); const [desde, setDesde] = useState(""); const [hasta, setHasta] = useState(""); const [orden, setOrden] = useState("desc");
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [comprobanteUrl, setComprobanteUrl] = useState("");
  const [abriendoComprobante, setAbriendoComprobante] = useState(null);

  const cerrarComprobante = useCallback(() => {
    setComprobanteUrl(actual => { if (actual) URL.revokeObjectURL(actual); return ""; });
  }, []);
  useEffect(() => () => cerrarComprobante(), [cerrarComprobante]);

  const abrirComprobante = async (pedidoId) => {
    setAbriendoComprobante(pedidoId);
    try {
      const blob = await apiBlob(`/admin/pedidos/${pedidoId}/comprobante`, token);
      cerrarComprobante();
      setComprobanteUrl(URL.createObjectURL(blob));
    } finally { setAbriendoComprobante(null); }
  };

  useEffect(() => {
    setCargando(true);
    const params = new URLSearchParams({ orden });
    if (q) params.set("q", q);
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    api(`/admin/clientes?${params.toString()}`, { token })
      .then(d => { setLista(d); setError(""); })
      .catch(() => setError("No pudimos cargar los clientes."))
      .finally(() => setCargando(false));
  }, [token, q, desde, hasta, orden]);

  return (
    <div className="space-y-4">
      <ComprobanteModal url={comprobanteUrl} onClose={cerrarComprobante} />
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px]"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" color={c.textFaint} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre..." className="f-body w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.text }} /></div>
        <button onClick={() => setOrden(orden === "desc" ? "asc" : "desc")} className="f-body flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg" style={{ background: c.surfaceAlt, color: c.textMuted, border: `1px solid ${c.border}` }}><ArrowUpDown size={12} /> Consumo</button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="f-body text-[11px]" style={{ color: c.textFaint }}>Rango de último pedido:</span>
        <RangoFechas desde={desde} hasta={hasta} setDesde={setDesde} setHasta={setHasta} />
      </div>
      <ErrorBanner mensaje={error} />
      {cargando ? <Cargando /> : (
        <div className="rounded-2xl overflow-hidden" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
          <div className="overflow-x-auto">
            <table className="w-full f-body text-xs">
              <thead><tr>{["Cliente", "Barrio", "Teléfono", "Tipo", "Pedidos", "Gasto total", "Último pedido", "Pago"].map(h => <th key={h} className="text-left px-4 py-2.5 font-medium whitespace-nowrap" style={{ color: c.textFaint, borderBottom: `1px solid ${c.borderSoft}` }}>{h}</th>)}</tr></thead>
              <tbody>
                {lista.map(cl => (
                  <tr key={cl.id} style={{ borderTop: `1px solid ${c.borderSoft}` }}>
                    <td className="px-4 py-2.5 font-medium whitespace-nowrap" style={{ color: c.text }}>{cl.nombre}</td>
                    <td className="px-4 py-2.5" style={{ color: c.textMuted }}>{cl.barrio}</td>
                    <td className="f-mono px-4 py-2.5" style={{ color: c.textFaint }}>{cl.telefono}</td>
                    <td className="px-4 py-2.5" style={{ color: c.textMuted }}>{cl.tipo}</td>
                    <td className="f-mono px-4 py-2.5" style={{ color: c.text }}>{cl.cantidadPedidos}</td>
                    <td className="f-mono px-4 py-2.5" style={{ color: c.accent }}>${Number(cl.totalGastado).toLocaleString("es-AR")}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: c.textMuted }}>{cl.ultimoPedido ? new Date(cl.ultimoPedido).toLocaleDateString("es-AR") : "—"}</td>
                    <td className="px-4 py-2.5" style={{ color: c.textMuted }}><div className="flex items-center gap-2 whitespace-nowrap"><span>{cl.pago}</span>{cl.tieneComprobante && <button onClick={() => abrirComprobante(cl.ultimoPedidoId)} disabled={abriendoComprobante === cl.ultimoPedidoId} className="f-body inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium disabled:opacity-60" style={{ background: c.accentSoft, color: c.accent }}>{abriendoComprobante === cl.ultimoPedidoId ? <Spinner size={11} /> : <Eye size={11} />} Ver comprobante</button>}</div></td>
                  </tr>
                ))}
                {lista.length === 0 && <tr><td colSpan={8} className="text-center py-8" style={{ color: c.textFaint }}>Sin clientes que coincidan con la búsqueda.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- ADMIN: CATÁLOGO (3 catálogos separados) ---------------------------------- */
function ListaProductos({ productos, onEditarPrecio, onToggleActivo, onEliminar, onSubirImagen, onEliminarImagen, subiendoImagen }) {
  const c = useTheme();
  return (
    <div className="space-y-2">
      {productos.map(p => (
        <div key={p.id} className="rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center gap-3" style={{ background: c.surface, border: `1px solid ${c.border}`, opacity: p.activo ? 1 : 0.5 }}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <label className="group relative w-14 h-14 rounded-xl flex items-center justify-center shrink-0 overflow-hidden cursor-pointer" style={{ background: c.accentSoft, border: `1px dashed ${c.accent}66` }} title="Elegir o reemplazar imagen">
              {p.imagenUrl ? <img src={p.imagenUrl} alt={p.nombre} className="w-full h-full object-cover" /> : <Package size={18} color={c.accent} />}
              <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(2,8,23,.58)" }}><ImagePlus size={18} color="#fff" /></span>
              {subiendoImagen === p.id && <span className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(2,8,23,.58)" }}><Spinner size={16} /></span>}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={subiendoImagen === p.id} onChange={e => { const archivo = e.target.files?.[0]; if (archivo) onSubirImagen(p.id, archivo); e.target.value = ""; }} />
            </label>
            <div className="flex-1 min-w-0"><p className="f-body text-sm font-medium" style={{ color: c.text }}>{p.nombre}</p><p className="f-body text-[11px]" style={{ color: c.textFaint }}>{p.descripcion || "—"}</p></div>
          </div>
          <div className="flex items-center gap-2 justify-between sm:justify-end shrink-0">
            <div className="flex items-center gap-1"><span className="f-mono text-xs" style={{ color: c.textFaint }}>$</span><input type="number" defaultValue={p.precio} onBlur={e => onEditarPrecio(p.id, e.target.value)} className="f-mono text-xs w-20 px-2 py-1.5 rounded-lg outline-none" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.text }} /></div>
            <button onClick={() => onToggleActivo(p.id, p.activo)} className="f-body text-[11px] px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap" style={{ background: p.activo ? c.successSoft : c.dangerSoft, color: p.activo ? c.success : c.danger }}>{p.activo ? "Activo" : "Oculto"}</button>
            {p.imagenUrl && <button onClick={() => onEliminarImagen(p)} className="p-1.5 rounded-lg" style={{ background: c.surfaceAlt }} title={`Quitar foto de ${p.nombre}`} aria-label={`Quitar foto de ${p.nombre}`}><X size={13} color={c.textMuted} /></button>}
            <button onClick={() => onEliminar(p)} className="p-1.5 rounded-lg" style={{ background: c.dangerSoft }} title={`Eliminar definitivamente ${p.nombre}`} aria-label={`Eliminar definitivamente ${p.nombre}`}><Trash2 size={13} color={c.danger} /></button>
          </div>
        </div>
      ))}
      {productos.length === 0 && <p className="f-body text-xs py-4" style={{ color: c.textFaint }}>Sin productos en esta categoría todavía.</p>}
    </div>
  );
}

function AdminCatalogo({ token }) {
  const c = useTheme();
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [subiendoImagen, setSubiendoImagen] = useState(null);
  const [tab, setTab] = useState("consumo_personal");
  const [nuevo, setNuevo] = useState({ nombre: "", precio: "", descripcion: "" });

  const cargar = useCallback(() => api("/admin/productos", { token }).then(setProductos).catch(() => setError("No pudimos cargar el catálogo.")).finally(() => setCargando(false)), [token]);
  useEffect(() => { cargar(); }, [cargar]);

  const editarPrecio = async (id, precio) => {
    setProductos(prev => prev.map(p => p.id === id ? { ...p, precio } : p));
    try { await api(`/admin/productos/${id}`, { method: "PATCH", token, body: { precio: Number(precio) || 0 } }); } catch { cargar(); }
  };
  const toggleActivo = async (id, activo) => {
    setProductos(prev => prev.map(p => p.id === id ? { ...p, activo: !activo } : p));
    try { await api(`/admin/productos/${id}`, { method: "PATCH", token, body: { activo: !activo } }); } catch { cargar(); }
  };
  const eliminar = async (producto) => {
    const confirmado = await confirmarAccion({
      titulo: `¿Eliminar "${producto.nombre}"?`,
      mensaje: "Se eliminará definitivamente del catálogo. Los pedidos anteriores conservarán el nombre y el precio que tenían al comprarse.",
      textoConfirmar: "Sí, eliminar",
    });
    if (!confirmado) return;

    setError("");
    setMensaje("");
    try {
      await api(`/admin/productos/${producto.id}`, { method: "DELETE", token });
      setProductos(prev => prev.filter(p => p.id !== producto.id));
      setMensaje(`"${producto.nombre}" fue eliminado definitivamente.`);
    } catch (e) {
      setError(e.message || "No se pudo eliminar el producto.");
    }
  };
  const subirImagen = async (id, archivo) => {
    setSubiendoImagen(id); setError(""); setMensaje("");
    try {
      const body = new FormData();
      body.append("imagen", archivo);
      const actualizado = await api(`/admin/productos/${id}/imagen`, { method: "PUT", token, body });
      setProductos(prev => prev.map(p => p.id === id ? actualizado : p));
      setMensaje("Imagen del producto actualizada.");
    } catch (e) { setError(e.message || "No se pudo subir la imagen."); }
    setSubiendoImagen(null);
  };
  const eliminarImagen = async (producto) => {
    const confirmado = await confirmarAccion({ titulo: `¿Quitar la foto de "${producto.nombre}"?`, mensaje: "El producto seguirá activo y volverá a mostrar el ícono predeterminado.", textoConfirmar: "Quitar foto", peligro: false });
    if (!confirmado) return;
    try {
      await api(`/admin/productos/${producto.id}/imagen`, { method: "DELETE", token });
      setProductos(prev => prev.map(p => p.id === producto.id ? { ...p, imagenUrl: null } : p));
      setMensaje("Imagen eliminada.");
    } catch (e) { setError(e.message || "No se pudo quitar la imagen."); }
  };
  const agregar = async () => {
    if (!nuevo.nombre || !nuevo.precio) return;
    try { await api("/admin/productos", { method: "POST", token, body: { nombre: nuevo.nombre, descripcion: nuevo.descripcion, precio: Number(nuevo.precio), categoria: tab } }); setNuevo({ nombre: "", precio: "", descripcion: "" }); cargar(); }
    catch (e) { setError(e.message || "No se pudo crear el producto."); }
  };

  if (cargando) return <Cargando />;
  const delTab = productos.filter(p => p.categoria === tab);
  const catalogoActivo = OPCIONES_SEGMENTO.find(op => op.categoria === tab);

  return (
    <div className="space-y-4">
      <p className="f-body text-xs" style={{ color: c.textMuted }}>Cada catálogo se ve por separado en la vidriera, según lo que el cliente elija al empezar su pedido.</p>
      <div className="flex flex-wrap rounded-xl p-1 gap-1" style={{ background: c.surface, width: "fit-content" }}>
        {OPCIONES_SEGMENTO.map(op => (
          <button key={op.categoria} onClick={() => setTab(op.categoria)} className="f-body px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5" style={{ background: tab === op.categoria ? c.accentSoft : "transparent", color: tab === op.categoria ? c.accent : c.textMuted }}>
            <op.Icon size={13} /> {op.label}
          </button>
        ))}
      </div>
      <ErrorBanner mensaje={error} />
      {mensaje && <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: c.successSoft }}><CheckCircle2 size={14} color={c.success} /><span className="f-body text-xs" style={{ color: c.success }}>{mensaje}</span></div>}

      <ListaProductos productos={delTab} onEditarPrecio={editarPrecio} onToggleActivo={toggleActivo} onEliminar={eliminar} onSubirImagen={subirImagen} onEliminarImagen={eliminarImagen} subiendoImagen={subiendoImagen} />

      <div className="rounded-2xl p-3.5 flex flex-col gap-2" style={{ background: c.bgAlt, border: `1px dashed ${c.border}` }}>
        <p className="f-body text-xs font-medium" style={{ color: c.textMuted }}>Agregar producto a {catalogoActivo?.label}</p>
        <Input placeholder="Nombre del producto" value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} />
        <Input placeholder="Descripción (opcional)" value={nuevo.descripcion} onChange={e => setNuevo({ ...nuevo, descripcion: e.target.value })} />
        <div className="flex gap-2">
          <input type="number" placeholder="Precio" value={nuevo.precio} onChange={e => setNuevo({ ...nuevo, precio: e.target.value })} className="f-body flex-1 px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.text }} />
          <button onClick={agregar} className="f-body px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center gap-1 shrink-0" style={{ background: c.accent, color: c.bgAlt }}><Plus size={14} /> Agregar</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- ADMIN: DÍAS NO HÁBILES ---------------------------------- */
function AdminCalendario({ token }) {
  const c = useTheme();
  const [dias, setDias] = useState([]);
  const [fecha, setFecha] = useState("");
  const [motivo, setMotivo] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(async () => {
    try {
      setDias(await api("/admin/calendario", { token }));
      setError("");
    } catch (e) {
      setError(e.message || "No pudimos cargar los días no hábiles.");
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);

  const agregar = async () => {
    if (!fecha) { setError("Elegí una fecha."); mostrarErrorGlobal("Elegí una fecha para continuar."); return; }
    setError(""); setMensaje("");
    try {
      await api("/admin/calendario", { method: "POST", token, body: { fecha, motivo } });
      setFecha(""); setMotivo(""); setMensaje("Día no hábil agregado.");
      await cargar();
    } catch (e) { setError(e.message || "No se pudo agregar la fecha."); }
  };

  const quitar = async (dia) => {
    const confirmado = await confirmarAccion({
      titulo: "¿Habilitar nuevamente esta fecha?",
      mensaje: `${formatearFechaEntrega(dia.fecha)} volverá a estar disponible para entregas.`,
      textoConfirmar: "Sí, habilitar",
      peligro: false,
    });
    if (!confirmado) return;
    setError(""); setMensaje("");
    try {
      await api(`/admin/calendario/${dia.id}`, { method: "DELETE", token });
      setDias(prev => prev.filter(d => d.id !== dia.id));
      setMensaje("La fecha volvió a quedar habilitada para entregas.");
    } catch (e) { setError(e.message || "No se pudo quitar la fecha."); }
  };

  if (cargando) return <Cargando />;
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl" style={{ background: c.accentSoft }}>
        <CalendarClock size={15} color={c.accent} className="mt-0.5 shrink-0" />
        <p className="f-body text-xs" style={{ color: c.text }}>Sábados y domingos ya se excluyen automáticamente. Agregá acá feriados u otros días sin reparto; los pedidos pasarán al siguiente día hábil.</p>
      </div>
      <ErrorBanner mensaje={error} />
      {mensaje && <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: c.successSoft }}><CheckCircle2 size={14} color={c.success} /><span className="f-body text-xs" style={{ color: c.success }}>{mensaje}</span></div>}

      <div className="rounded-2xl p-4" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
        <p className="f-body text-sm font-medium mb-3" style={{ color: c.text }}>Agregar día sin reparto</p>
        <div className="grid sm:grid-cols-[180px_1fr_auto] gap-2">
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="f-body px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.text }} />
          <Input placeholder="Motivo (ej. Feriado nacional)" value={motivo} onChange={e => setMotivo(e.target.value)} />
          <button onClick={agregar} className="f-body px-4 py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5" style={{ background: c.accent, color: c.bgAlt }}><Plus size={14} /> Agregar</button>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
        {dias.length === 0 && <p className="f-body text-xs p-4" style={{ color: c.textFaint }}>No hay feriados ni días adicionales cargados.</p>}
        {dias.map((dia, index) => (
          <div key={dia.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: index ? `1px solid ${c.borderSoft}` : "none" }}>
            <CalendarClock size={15} color={c.accent} />
            <div className="flex-1 min-w-0"><p className="f-body text-sm font-medium" style={{ color: c.text }}>{formatearFechaEntrega(dia.fecha)}</p><p className="f-body text-[11px]" style={{ color: c.textFaint }}>{dia.motivo || "Sin motivo"}</p></div>
            <button onClick={() => quitar(dia)} className="p-2 rounded-lg" style={{ background: c.dangerSoft }} title="Quitar día no hábil" aria-label={`Quitar ${formatearFechaEntrega(dia.fecha)}`}><Trash2 size={13} color={c.danger} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------- ADMIN: CAMIONES ---------------------------------- */
function CamionCard({ cm, zonas, onGuardar, onEliminar, onAsignarZona, onQuitarZona }) {
  const c = useTheme();
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(cm.nombre);
  const [choferNombre, setChoferNombre] = useState(cm.chofer?.nombre || "");
  const [choferUsuario, setChoferUsuario] = useState(cm.chofer?.usuario || "");
  const [choferPassword, setChoferPassword] = useState("");

  const misZonas = zonas.filter(z => z.camionId === cm.id);
  const disponibles = zonas.filter(z => z.camionId !== cm.id).map(z => ({ id: z.id, label: z.camionId ? `${z.barrio} — ya en ${z.camionNombre}` : z.barrio }));

  const guardar = () => {
    const cambios = { nombre: nombre.trim(), choferNombre: choferNombre.trim(), choferUsuario: choferUsuario.trim() };
    if (choferPassword.trim()) cambios.choferPassword = choferPassword.trim();
    onGuardar(cm.id, cambios);
    setChoferPassword("");
    setEditando(false);
  };
  const cancelar = () => { setNombre(cm.nombre); setChoferNombre(cm.chofer?.nombre || ""); setChoferUsuario(cm.chofer?.usuario || ""); setChoferPassword(""); setEditando(false); };

  return (
    <div className="rounded-2xl p-4" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
      <div className="flex items-start gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${cm.color}22` }}><Truck size={16} color={cm.color} /></div>
        <div className="flex-1 min-w-0">
          {editando ? (
            <div className="space-y-1.5">
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del camión" className="f-body w-full text-sm px-2 py-1.5 rounded-lg outline-none" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.text }} />
              <input value={choferNombre} onChange={e => setChoferNombre(e.target.value)} placeholder="Nombre del chofer" className="f-body w-full text-xs px-2 py-1.5 rounded-lg outline-none" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.text }} />
            </div>
          ) : (
            <div><p className="f-body text-sm font-medium truncate" style={{ color: c.text }}>{cm.nombre}</p><p className="f-body text-[11px] truncate" style={{ color: c.textFaint }}>{cm.chofer?.nombre || "Sin chofer"}</p></div>
          )}
        </div>
        {!editando && (
          <div className="flex gap-1 shrink-0">
            <button onClick={() => setEditando(true)} className="p-1.5 rounded-lg" style={{ background: c.surfaceAlt }}><Pencil size={13} color={c.textMuted} /></button>
            <button onClick={() => onEliminar(cm.id)} className="p-1.5 rounded-lg" style={{ background: c.dangerSoft }} title="Eliminar camión"><Trash2 size={13} color={c.danger} /></button>
          </div>
        )}
      </div>

      {editando ? (
        <div className="space-y-1.5 mb-3 p-2.5 rounded-lg" style={{ background: c.surfaceAlt }}>
          <p className="f-body text-[11px] flex items-center gap-1" style={{ color: c.textFaint }}><KeyRound size={11} /> Acceso del chofer</p>
          <input value={choferUsuario} onChange={e => setChoferUsuario(e.target.value)} placeholder="Usuario" className="f-body w-full text-xs px-2 py-1.5 rounded-lg outline-none" style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.text }} />
          <input value={choferPassword} onChange={e => setChoferPassword(e.target.value)} placeholder="Nueva contraseña (dejar vacío para no cambiarla)" type="password" className="f-body w-full text-xs px-2 py-1.5 rounded-lg outline-none" style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.text }} />
        </div>
      ) : (
        cm.chofer && <p className="f-mono text-[11px] mb-3 px-2.5 py-1.5 rounded-lg" style={{ background: c.surfaceAlt, color: c.textMuted }}>usuario: {cm.chofer.usuario}</p>
      )}

      <p className="f-body text-[11px] mb-1.5" style={{ color: c.textFaint }}>Zonas / barrios que cubre</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {misZonas.length === 0 && <span className="f-body text-[11px]" style={{ color: c.textFaint }}>Sin zonas asignadas todavía</span>}
        {misZonas.map(z => (
          <span key={z.id} className="f-body inline-flex items-center gap-1 text-[10px] pl-2 pr-1 py-0.5 rounded-full" style={{ background: `${cm.color}18`, color: cm.color }}>
            {z.barrio}
            <button onClick={() => onQuitarZona(z.id)} className="rounded-full w-3.5 h-3.5 flex items-center justify-center" style={{ background: `${cm.color}33` }} title="Quitar de este camión"><XCircle size={10} /></button>
          </span>
        ))}
      </div>
      <select value="" onChange={e => e.target.value && onAsignarZona(Number(e.target.value), cm.id)} disabled={disponibles.length === 0} className="f-body w-full text-xs px-2.5 py-2 rounded-lg outline-none mb-3 disabled:opacity-50" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.textMuted }}>
        <option value="">{disponibles.length === 0 ? "No hay zonas disponibles" : "+ Asignar zona a este camión..."}</option>
        {disponibles.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
      </select>

      {editando && (
        <div className="flex gap-2">
          <button onClick={guardar} className="f-body flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1" style={{ background: c.successSoft, color: c.success }}><Save size={12} /> Guardar</button>
          <button onClick={cancelar} className="f-body flex-1 py-2 rounded-lg text-xs" style={{ background: c.surfaceAlt, color: c.textMuted }}>Cancelar</button>
        </div>
      )}
    </div>
  );
}

function ZonasOperativas({ zonas, onAgregar, onRenombrar, onEliminar }) {
  const c = useTheme();
  const [nueva, setNueva] = useState("");
  const [editando, setEditando] = useState(null);
  const [valorEdit, setValorEdit] = useState("");

  const agregar = () => { if (!nueva.trim()) return; onAgregar(nueva.trim()); setNueva(""); };
  const empezar = (z) => { setEditando(z.id); setValorEdit(z.barrio); };
  const guardar = () => { if (valorEdit.trim() && valorEdit.trim() !== zonas.find(z => z.id === editando)?.barrio) onRenombrar(editando, valorEdit.trim()); setEditando(null); };

  return (
    <div className="rounded-2xl p-4" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
      <p className="f-body text-sm font-medium mb-1" style={{ color: c.text }}>Zonas operativas de la empresa</p>
      <p className="f-body text-[11px] mb-3" style={{ color: c.textFaint }}>Agregalas, renombralas o eliminalas acá — después asignás cada una a un camión desde su tarjeta.</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {zonas.length === 0 && <span className="f-body text-[11px]" style={{ color: c.textFaint }}>Todavía no hay zonas cargadas.</span>}
        {zonas.map(z => editando === z.id ? (
          <span key={z.id} className="inline-flex items-center gap-1 rounded-full pl-2 pr-1 py-0.5" style={{ background: c.surfaceAlt, border: `1px solid ${c.accent}` }}>
            <input autoFocus value={valorEdit} onChange={e => setValorEdit(e.target.value)} onKeyDown={e => { if (e.key === "Enter") guardar(); if (e.key === "Escape") setEditando(null); }} onBlur={guardar} className="f-body text-[11px] outline-none w-24" style={{ background: "transparent", color: c.text }} />
          </span>
        ) : (
          <span key={z.id} className="f-body inline-flex items-center gap-1.5 text-[11px] pl-2.5 pr-1 py-1 rounded-full" style={{ background: z.camionId ? `${z.color}18` : c.surfaceAlt, color: z.camionId ? z.color : c.textMuted }}>
            {z.barrio}{!z.camionId && <span className="text-[9px] opacity-70">(sin asignar)</span>}
            <button onClick={() => empezar(z)} className="rounded-full w-4 h-4 flex items-center justify-center" style={{ background: z.camionId ? `${z.color}33` : c.border }}><Pencil size={9} /></button>
            <button onClick={() => onEliminar(z.id)} className="rounded-full w-4 h-4 flex items-center justify-center" style={{ background: z.camionId ? `${z.color}33` : c.border }}><XCircle size={10} /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input value={nueva} onChange={e => setNueva(e.target.value)} onKeyDown={e => e.key === "Enter" && agregar()} placeholder="Nombre del barrio nuevo..." className="f-body flex-1 text-xs px-2.5 py-2 rounded-lg outline-none" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.text }} />
        <button onClick={agregar} className="f-body px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1 shrink-0" style={{ background: c.accentSoft, color: c.accent }}><Plus size={13} /> Agregar</button>
      </div>
    </div>
  );
}

function AgendaZonas({ zonas, onAgregarHorario, onEliminarHorario }) {
  const c = useTheme();
  const [zonaId, setZonaId] = useState("");
  const [nuevo, setNuevo] = useState({ diaSemana: "2", horaDesde: "18:00", horaHasta: "20:00", cupoMaximo: "6" });

  useEffect(() => {
    if (!zonas.length) return setZonaId("");
    if (!zonas.some(z => String(z.id) === String(zonaId))) setZonaId(String(zonas[0].id));
  }, [zonas, zonaId]);

  const zona = zonas.find(z => String(z.id) === String(zonaId));
  const agregar = () => {
    if (!zona) return;
    onAgregarHorario(zona.id, {
      diaSemana: Number(nuevo.diaSemana),
      horaDesde: nuevo.horaDesde,
      horaHasta: nuevo.horaHasta,
      cupoMaximo: Number(nuevo.cupoMaximo),
    });
  };

  return (
    <div className="rounded-2xl p-4" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
      <div className="flex items-start gap-2 mb-3">
        <CalendarClock size={16} color={c.accent} className="mt-0.5 shrink-0" />
        <div><p className="f-body text-sm font-medium" style={{ color: c.text }}>Días y franjas de entrega por barrio</p><p className="f-body text-[11px] mt-0.5" style={{ color: c.textFaint }}>El cliente solo podrá elegir estas opciones. Cada franja es aproximada y tiene un cupo máximo para cuidar la ruta.</p></div>
      </div>
      {zonas.length === 0 ? <p className="f-body text-xs" style={{ color: c.textFaint }}>Primero agregá una zona operativa.</p> : (
        <div className="space-y-3">
          <select value={zonaId} onChange={e => setZonaId(e.target.value)} className="f-body w-full px-3 py-2.5 rounded-xl text-xs outline-none" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.text }}>
            {zonas.map(z => <option key={z.id} value={z.id}>{z.barrio}{z.camionNombre ? ` · ${z.camionNombre}` : " · sin camión"}</option>)}
          </select>
          <div className="space-y-1.5">
            {(zona?.horarios || []).map(h => (
              <div key={h.id} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: c.bgAlt, border: `1px solid ${c.borderSoft}` }}>
                <span className="f-body text-xs font-medium min-w-[64px]" style={{ color: c.text }}>{DIAS_SEMANA.find(d => d.id === h.diaSemana)?.label}</span>
                <span className="f-body text-xs" style={{ color: c.accent }}>{formatearFranja(h.horaDesde, h.horaHasta)}</span>
                <span className="f-body text-[10px] ml-auto whitespace-nowrap" style={{ color: c.textFaint }}>hasta {h.cupoMaximo} pedidos</span>
                <button onClick={() => onEliminarHorario(h.id)} className="p-1.5 rounded-lg shrink-0" style={{ background: c.dangerSoft }} title="Quitar franja"><Trash2 size={12} color={c.danger} /></button>
              </div>
            ))}
            {(zona?.horarios || []).length === 0 && <p className="f-body text-[11px] px-3 py-2 rounded-lg" style={{ background: c.amberSoft, color: c.amber }}>Este barrio todavía no tiene días de entrega.</p>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 rounded-xl" style={{ background: c.bgAlt, border: `1px dashed ${c.border}` }}>
            <select value={nuevo.diaSemana} onChange={e => setNuevo({ ...nuevo, diaSemana: e.target.value })} className="f-body px-2.5 py-2 rounded-lg text-xs outline-none" style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.text }}>
              {DIAS_SEMANA.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
            <input type="time" value={nuevo.horaDesde} onChange={e => setNuevo({ ...nuevo, horaDesde: e.target.value })} className="f-body px-2.5 py-2 rounded-lg text-xs outline-none" style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.text }} title="Hora desde" />
            <input type="time" value={nuevo.horaHasta} onChange={e => setNuevo({ ...nuevo, horaHasta: e.target.value })} className="f-body px-2.5 py-2 rounded-lg text-xs outline-none" style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.text }} title="Hora hasta" />
            <input type="number" min="1" max="100" value={nuevo.cupoMaximo} onChange={e => setNuevo({ ...nuevo, cupoMaximo: e.target.value })} className="f-body px-2.5 py-2 rounded-lg text-xs outline-none" style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.text }} placeholder="Cupo" title="Cupo máximo" />
            <button onClick={agregar} className="f-body px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1" style={{ background: c.accent, color: c.bgAlt }}><Plus size={13} /> Agregar</button>
          </div>
          <p className="f-body text-[10px]" style={{ color: c.textFaint }}>Ejemplo: martes de 18:00 a 20:00 con cupo 6 permite organizar hasta seis domicilios dentro de esa franja, sin prometer una hora exacta.</p>
        </div>
      )}
    </div>
  );
}

function AdminCamiones({ token }) {
  const c = useTheme();
  const [camiones, setCamiones] = useState([]);
  const [zonasRaw, setZonasRaw] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [nuevo, setNuevo] = useState({ nombre: "", choferNombre: "", usuario: "", password: "" });

  const cargar = useCallback(async (mostrarSpinner) => {
    if (mostrarSpinner) setCargando(true);
    try { const [cms, zs] = await Promise.all([api("/admin/camiones", { token }), api("/admin/zonas", { token })]); setCamiones(cms); setZonasRaw(zs); setError(""); }
    catch (e) { setError("No pudimos cargar camiones y zonas."); }
    if (mostrarSpinner) setCargando(false);
  }, [token]);
  useEffect(() => { cargar(true); }, [cargar]);

  const zonas = zonasRaw.map(z => ({ ...z, color: z.camionId ? camiones.find(cm => cm.id === z.camionId)?.color : null }));

  const guardarCamion = async (id, cambios) => { try { await api(`/admin/camiones/${id}`, { method: "PATCH", token, body: cambios }); cargar(false); } catch (e) { setError(e.message || "No se pudo guardar el camión."); } };
  const eliminarCamion = async (id) => {
    const confirmado = await confirmarAccion({
      titulo: "¿Eliminar este camión?",
      mensaje: "Solo se podrá eliminar si no tiene pedidos en su historial.",
      textoConfirmar: "Sí, eliminar",
    });
    if (!confirmado) return;
    try { await api(`/admin/camiones/${id}`, { method: "DELETE", token }); cargar(false); } catch (e) { setError(e.message || "No se pudo eliminar el camión."); }
  };
  const asignarZona = async (zonaId, camionId) => { try { await api(`/admin/zonas/${zonaId}/camion`, { method: "PATCH", token, body: { camionId } }); cargar(false); } catch { setError("No se pudo asignar la zona."); } };
  const quitarZona = async (zonaId) => { try { await api(`/admin/zonas/${zonaId}/camion`, { method: "PATCH", token, body: { camionId: null } }); cargar(false); } catch { setError("No se pudo soltar la zona."); } };
  const agregarZona = async (barrio) => { try { await api("/admin/zonas", { method: "POST", token, body: { barrio } }); cargar(false); } catch (e) { setError(e.message || "No se pudo crear la zona."); } };
  const renombrarZona = async (id, barrio) => { try { await api(`/admin/zonas/${id}`, { method: "PATCH", token, body: { barrio } }); cargar(false); } catch (e) { setError(e.message || "No se pudo renombrar."); } };
  const eliminarZona = async (id) => { try { await api(`/admin/zonas/${id}`, { method: "DELETE", token }); cargar(false); } catch { setError("No se pudo eliminar la zona."); } };
  const agregarHorario = async (zonaId, datos) => { try { await api(`/admin/zonas/${zonaId}/horarios`, { method: "POST", token, body: datos }); cargar(false); } catch (e) { setError(e.message || "No se pudo agregar la franja."); } };
  const eliminarHorario = async (id) => {
    const confirmado = await confirmarAccion({ titulo: "¿Quitar esta franja?", mensaje: "Los pedidos ya confirmados conservarán la fecha y el horario aproximado. La opción dejará de aparecer para pedidos nuevos.", textoConfirmar: "Sí, quitar" });
    if (!confirmado) return;
    try { await api(`/admin/horarios/${id}`, { method: "DELETE", token }); cargar(false); } catch (e) { setError(e.message || "No se pudo quitar la franja."); }
  };

  const agregarCamion = async () => {
    if (!nuevo.nombre.trim() || !nuevo.choferNombre.trim() || !nuevo.usuario.trim() || !nuevo.password.trim()) {
      const mensaje = "Completá todos los campos del camión nuevo.";
      setError(mensaje); mostrarErrorGlobal(mensaje); return;
    }
    try { await api("/admin/camiones", { method: "POST", token, body: { nombre: nuevo.nombre.trim(), choferNombre: nuevo.choferNombre.trim(), usuario: nuevo.usuario.trim(), password: nuevo.password.trim() } }); setNuevo({ nombre: "", choferNombre: "", usuario: "", password: "" }); cargar(false); }
    catch (e) { setError(e.message || "No se pudo crear el camión."); }
  };

  if (cargando) return <Cargando />;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: c.accentSoft }}>
        <MapPin size={14} color={c.accent} />
        <p className="f-body text-xs" style={{ color: c.text }}>Zonas, nombre y credenciales de cada camión son editables. La asignación automática de pedidos se actualiza al instante.</p>
      </div>
      <ErrorBanner mensaje={error} />

      <ZonasOperativas zonas={zonas} onAgregar={agregarZona} onRenombrar={renombrarZona} onEliminar={eliminarZona} />
      <AgendaZonas zonas={zonas} onAgregarHorario={agregarHorario} onEliminarHorario={eliminarHorario} />

      <div className="grid sm:grid-cols-2 gap-3">
        {camiones.map(cm => <CamionCard key={cm.id} cm={cm} zonas={zonas} onGuardar={guardarCamion} onEliminar={eliminarCamion} onAsignarZona={asignarZona} onQuitarZona={quitarZona} />)}
      </div>

      <div className="rounded-2xl p-3.5" style={{ background: c.bgAlt, border: `1px dashed ${c.border}` }}>
        <p className="f-body text-xs font-medium mb-2.5 flex items-center gap-1.5" style={{ color: c.textMuted }}><Plus size={13} /> Agregar camión</p>
        <div className="grid sm:grid-cols-2 gap-2">
          <Input placeholder="Nombre (ej. Camión 6)" value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} />
          <Input placeholder="Nombre del chofer" value={nuevo.choferNombre} onChange={e => setNuevo({ ...nuevo, choferNombre: e.target.value })} />
          <Input placeholder="Usuario de acceso" value={nuevo.usuario} onChange={e => setNuevo({ ...nuevo, usuario: e.target.value })} />
          <Input placeholder="Contraseña" value={nuevo.password} onChange={e => setNuevo({ ...nuevo, password: e.target.value })} />
        </div>
        <button onClick={agregarCamion} className="f-body w-full mt-2 py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-1" style={{ background: c.accent, color: c.bgAlt }}><Plus size={14} /> Agregar camión</button>
        <p className="f-body text-[11px] mt-2" style={{ color: c.textFaint }}>Nace sin zonas — asignáselas desde su tarjeta una vez creado.</p>
      </div>

      <div className="rounded-2xl p-4" style={{ background: c.surface, border: `1px solid ${c.border}` }}><ZoneMap zonas={zonas} /></div>
    </div>
  );
}

/* ---------------------------------- ADMIN: MI CUENTA Y CONFIGURACIÓN ---------------------------------- */
function AdminConfiguracion({ token, onNombreActualizado }) {
  const c = useTheme();
  const [perfil, setPerfil] = useState(null);
  const [nombre, setNombre] = useState(""); const [usuario, setUsuario] = useState("");
  const [passActual, setPassActual] = useState(""); const [passNueva, setPassNueva] = useState("");
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [okPerfil, setOkPerfil] = useState(""); const [errorPerfil, setErrorPerfil] = useState("");

  const [areaPrivadaConfigurada, setAreaPrivadaConfigurada] = useState(false);
  const [claveArea, setClaveArea] = useState("");
  const [guardandoArea, setGuardandoArea] = useState(false);
  const [okArea, setOkArea] = useState(""); const [errorArea, setErrorArea] = useState("");
  const [datosBanco, setDatosBanco] = useState({ titular: "", banco: "", alias: "", cbu: "", cuit: "" });
  const [guardandoBanco, setGuardandoBanco] = useState(false);
  const [okBanco, setOkBanco] = useState(""); const [errorBanco, setErrorBanco] = useState("");

  useEffect(() => {
    api("/admin/perfil", { token }).then(p => { setPerfil(p); setNombre(p.nombre); setUsuario(p.usuario); });
    api("/admin/configuracion", { token }).then(d => { setAreaPrivadaConfigurada(d.areaPrivadaConfigurada); setDatosBanco(d.transferencia || { titular: "", banco: "", alias: "", cbu: "", cuit: "" }); });
  }, [token]);

  const guardarPerfil = async () => {
    setGuardandoPerfil(true); setOkPerfil(""); setErrorPerfil("");
    try {
      const body = { nombre, usuario };
      if (passNueva) { body.passwordActual = passActual; body.passwordNueva = passNueva; }
      const actualizado = await api("/admin/perfil", { method: "PATCH", token, body });
      setOkPerfil("Guardado."); setPassActual(""); setPassNueva("");
      onNombreActualizado && onNombreActualizado(actualizado.nombre);
    } catch (e) { setErrorPerfil(e.message || "No se pudo guardar."); }
    setGuardandoPerfil(false);
  };

  const guardarArea = async () => {
    setGuardandoArea(true); setOkArea(""); setErrorArea("");
    try {
      const d = await api("/admin/configuracion", { method: "PATCH", token, body: { claveAreaPrivada: claveArea } });
      setAreaPrivadaConfigurada(d.areaPrivadaConfigurada); setClaveArea(""); setOkArea("Guardado.");
    } catch (e) { setErrorArea(e.message || "No se pudo guardar."); }
    setGuardandoArea(false);
  };

  const guardarBanco = async () => {
    setGuardandoBanco(true); setOkBanco(""); setErrorBanco("");
    try {
      const d = await api("/admin/configuracion", { method: "PATCH", token, body: { transferencia: datosBanco } });
      setDatosBanco(d.transferencia); setOkBanco("Datos de transferencia guardados.");
    } catch (e) { setErrorBanco(e.message || "No se pudieron guardar los datos bancarios."); }
    setGuardandoBanco(false);
  };

  if (!perfil) return <Cargando />;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
        <p className="f-body text-sm font-medium mb-1 flex items-center gap-1.5" style={{ color: c.text }}><User size={14} /> Mi cuenta</p>
        <p className="f-body text-[11px] mb-3" style={{ color: c.textFaint }}>Tu nombre, usuario y contraseña de acceso al panel admin.</p>
        <div className="space-y-2.5 max-w-sm">
          <Input placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} />
          <Input placeholder="Usuario" value={usuario} onChange={e => setUsuario(e.target.value)} />
          <div className="h-px my-1" style={{ background: c.border }} />
          <p className="f-body text-[11px]" style={{ color: c.textFaint }}>Para cambiar la contraseña, completá los dos campos:</p>
          <Input placeholder="Contraseña actual" type="password" value={passActual} onChange={e => setPassActual(e.target.value)} />
          <Input placeholder="Contraseña nueva" type="password" value={passNueva} onChange={e => setPassNueva(e.target.value)} />
          <ErrorBanner mensaje={errorPerfil} />
          {okPerfil && <p className="f-body text-[11px]" style={{ color: c.success }}>{okPerfil}</p>}
          <button onClick={guardarPerfil} disabled={guardandoPerfil} className="f-body px-4 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2 disabled:opacity-70" style={{ background: c.accent, color: c.bgAlt }}>{guardandoPerfil && <Spinner size={13} />} Guardar cambios</button>
        </div>
      </div>

      <div className="rounded-2xl p-4" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
        <p className="f-body text-sm font-medium mb-1 flex items-center gap-1.5" style={{ color: c.text }}><Landmark size={15} /> Datos para transferencias</p>
        <p className="f-body text-[11px] mb-3" style={{ color: c.textFaint }}>Estos datos se muestran al cliente cuando elige Transferencia. Para habilitar esa opción, completá al menos el alias o el CBU/CVU.</p>
        <div className="grid sm:grid-cols-2 gap-2.5 max-w-2xl">
          <Input placeholder="Titular de la cuenta" value={datosBanco.titular} onChange={e => setDatosBanco({ ...datosBanco, titular: e.target.value })} />
          <Input placeholder="Banco o billetera" value={datosBanco.banco} onChange={e => setDatosBanco({ ...datosBanco, banco: e.target.value })} />
          <Input placeholder="Alias" value={datosBanco.alias} onChange={e => setDatosBanco({ ...datosBanco, alias: e.target.value })} />
          <Input placeholder="CBU / CVU" value={datosBanco.cbu} onChange={e => setDatosBanco({ ...datosBanco, cbu: e.target.value })} />
          <Input placeholder="CUIT (opcional)" value={datosBanco.cuit} onChange={e => setDatosBanco({ ...datosBanco, cuit: e.target.value })} />
        </div>
        <ErrorBanner mensaje={errorBanco} />
        {okBanco && <p className="f-body text-[11px] mt-2" style={{ color: c.success }}>{okBanco}</p>}
        <button onClick={guardarBanco} disabled={guardandoBanco} className="f-body mt-3 px-4 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2 disabled:opacity-70" style={{ background: c.accent, color: c.bgAlt }}>{guardandoBanco && <Spinner size={13} />} Guardar datos bancarios</button>
      </div>

      <div className="rounded-2xl p-4" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
        <p className="f-body text-sm font-medium mb-1 flex items-center gap-1.5" style={{ color: c.text }}><Lock size={14} /> Clave del Área Privada</p>
        <p className="f-body text-[11px] mb-3" style={{ color: c.textFaint }}>Es el primer candado que se ve al tocar "Acceso interno" en la vidriera, antes del login real. {areaPrivadaConfigurada ? "Ahora mismo hay una clave configurada." : "Ahora mismo NO hay clave configurada — cualquiera puede pasar ese primer paso."}</p>
        <div className="flex flex-wrap gap-2 max-w-sm">
          <Input placeholder="Nueva clave (dejar vacío para desactivarla)" type="password" value={claveArea} onChange={e => setClaveArea(e.target.value)} />
          <button onClick={guardarArea} disabled={guardandoArea} className="f-body px-4 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2 disabled:opacity-70 shrink-0" style={{ background: c.accent, color: c.bgAlt }}>{guardandoArea && <Spinner size={13} />} Guardar</button>
        </div>
        <ErrorBanner mensaje={errorArea} />
        {okArea && <p className="f-body text-[11px] mt-1.5" style={{ color: c.success }}>{okArea}</p>}
      </div>
    </div>
  );
}

/* ---------------------------------- ADMIN PANEL (sidebar) ---------------------------------- */
function AdminPanel({ session, onLogout, modo, setModo }) {
  const c = useTheme();
  const [view, setView] = useState("dashboard");
  const [camiones, setCamiones] = useState([]);
  const [nombreAdmin, setNombreAdmin] = useState(session.nombre);

  useEffect(() => { api("/admin/camiones", { token: session.token }).then(setCamiones).catch(() => {}); }, [session.token, view]);

  const NAV = [
    { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { id: "pedidos", label: "Pedidos", Icon: ClipboardList },
    { id: "clientes", label: "Clientes", Icon: Users },
    { id: "catalogo", label: "Catálogo", Icon: Boxes },
    { id: "camiones", label: "Camiones", Icon: Truck },
    { id: "calendario", label: "Días no hábiles", Icon: CalendarClock },
    { id: "configuracion", label: "Mi cuenta", Icon: Settings },
  ];
  const titles = { dashboard: "Dashboard general", pedidos: "Pedidos", clientes: "Base de clientes", catalogo: "Catálogo de productos", camiones: "Camiones y zonas", calendario: "Días no hábiles", configuracion: "Mi cuenta y configuración" };

  return (
    <div className="flex-1 flex flex-col md:flex-row" style={{ background: c.bg }}>
      <div className="hidden md:flex w-56 shrink-0 flex-col" style={{ background: c.bgAlt, borderRight: `1px solid ${c.borderSoft}` }}>
        <div className="px-4 py-4"><BrandLogo variant="word" className="h-8 w-auto max-w-[145px]" /></div>
        <p className="f-body text-[11px] px-4 mb-2" style={{ color: c.textFaint }}>{nombreAdmin}</p>
        <nav className="flex-1 px-2 space-y-0.5">
          {NAV.map(n => (
            <button key={n.id} onClick={() => setView(n.id)} className="f-body w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors" style={{ background: view === n.id ? c.accentSoft : "transparent", color: view === n.id ? c.accent : c.textMuted }}>
              <n.Icon size={15} /> {n.label}
            </button>
          ))}
        </nav>
        <button onClick={() => setModo(modo === "dark" ? "light" : "dark")} className="f-body flex items-center gap-2.5 px-3 py-2.5 mx-2 mb-1 rounded-xl text-xs" style={{ color: c.textFaint }}>{modo === "dark" ? <Sun size={14} /> : <Moon size={14} />} Modo {modo === "dark" ? "claro" : "oscuro"}</button>
        <button onClick={onLogout} className="f-body flex items-center gap-2.5 px-3 py-2.5 mx-2 mb-3 rounded-xl text-xs" style={{ color: c.textFaint }}><LogOut size={14} /> Cerrar sesión</button>
      </div>

      <div className="md:hidden sticky top-0 z-10" style={{ background: c.bgAlt, borderBottom: `1px solid ${c.borderSoft}` }}>
        <div className="flex items-center justify-between px-4 py-3">
          <BrandLogo variant="word" className="h-8 w-auto max-w-[145px]" />
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => setModo(modo === "dark" ? "light" : "dark")} className="p-2 rounded-lg" style={{ background: c.surface }}>{modo === "dark" ? <Sun size={14} color={c.textMuted} /> : <Moon size={14} color={c.textMuted} />}</button>
            <button onClick={onLogout} className="p-2 rounded-lg" style={{ background: c.surface }}><LogOut size={14} color={c.textMuted} /></button>
          </div>
        </div>
        <nav className="flex gap-1.5 px-3 pb-3 overflow-x-auto">
          {NAV.map(n => (
            <button key={n.id} onClick={() => setView(n.id)} className="f-body shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap" style={{ background: view === n.id ? c.accentSoft : c.surface, color: view === n.id ? c.accent : c.textMuted, border: `1px solid ${view === n.id ? "transparent" : c.border}` }}>
              <n.Icon size={13} /> {n.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-5 md:py-6">
          <div className="flex items-center gap-2 mb-5"><Sparkles size={15} color={c.accent} className="shrink-0" /><h1 className="f-display text-lg font-semibold" style={{ color: c.text }}>{titles[view]}</h1></div>
          {view === "dashboard" && <AdminDashboard token={session.token} />}
          {view === "pedidos" && <AdminPedidos token={session.token} camiones={camiones} />}
          {view === "clientes" && <AdminClientes token={session.token} />}
          {view === "catalogo" && <AdminCatalogo token={session.token} />}
          {view === "camiones" && <AdminCamiones token={session.token} />}
          {view === "calendario" && <AdminCalendario token={session.token} />}
          {view === "configuracion" && <AdminConfiguracion token={session.token} onNombreActualizado={setNombreAdmin} />}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- APP ---------------------------------- */
function ThemeToggleFlotante({ modo, setModo, c }) {
  return (
    <button onClick={() => setModo(modo === "dark" ? "light" : "dark")} className="f-body flex items-center justify-center w-10 h-10 rounded-full shadow-lg" style={{ position: "fixed", top: 14, right: 14, zIndex: 50, background: c.surface, border: `1px solid ${c.border}` }} title={modo === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}>
      {modo === "dark" ? <Sun size={16} color={c.amber} /> : <Moon size={16} color={c.accent} />}
    </button>
  );
}

export default function App() {
  const [session, setSession] = useState(leerSesionGuardada);
  const [view, setView] = useState(() => session?.role || "vidriera");
  const [modo, setModo] = useState("light");
  const c = modo === "dark" ? DARK : LIGHT;

  const login = (s) => { guardarSesion(s); setSession(s); setView(s.role); };
  const logout = () => { borrarSesionGuardada(); setSession(null); setView("vidriera"); };

  useEffect(() => {
    const sesionVencida = () => { borrarSesionGuardada(); setSession(null); setView("login"); };
    window.addEventListener(AUTH_EXPIRED_EVENT, sesionVencida);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, sesionVencida);
  }, []);

  let contenido;
  if (view === "gate") contenido = <AccesoPrivadoGate onDesbloqueado={() => setView("login")} onVolver={() => setView("vidriera")} />;
  else if (view === "login") contenido = <LoginGate onLogin={login} onVolver={() => setView("vidriera")} />;
  else if (view === "admin" && session) contenido = <AdminPanel session={session} onLogout={logout} modo={modo} setModo={setModo} />;
  else if (view === "chofer" && session) contenido = <ChoferPanel session={session} onLogout={logout} />;
  else contenido = <ClientePortal onAccesoInterno={() => setView("gate")} />;

  return (
    <ThemeContext.Provider value={c}>
      <div className={`f-body min-h-screen flex flex-col ${modo === "dark" ? "theme-dark" : "theme-light"}`} style={{ background: c.bg }}>
        {fonts}
        <ErrorModal />
        <ConfirmModal />
        {view !== "admin" && <ThemeToggleFlotante modo={modo} setModo={setModo} c={c} />}
        <main className="flex-1 flex flex-col">{contenido}</main>
        <SystemFooter />
      </div>
    </ThemeContext.Provider>
  );
}
