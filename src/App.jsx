import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Droplet, Droplets, Package, Truck, User, MapPin, Building2, Store,
  CheckCircle2, XCircle, Clock, LayoutDashboard, Users, ChevronRight, ChevronLeft,
  Minus, Plus, CalendarClock, LogOut, BarChart3, Lock, Search, ArrowUpDown,
  ClipboardList, Boxes, Pencil, Save, Sparkles, ArrowLeftRight, TrendingUp, Sun, Moon,
  Loader2, AlertCircle, MessageCircle, Settings, Trash2, KeyRound, DollarSign,
  ImagePlus, Upload, Eye, EyeOff, Landmark, X, FileCheck2, RefreshCw, ArrowLeft, Wallet, Download, ChevronDown,
  Navigation, ExternalLink, Radio, LocateFixed
} from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip, Cell } from "recharts";

/* ---------------------------------- API ---------------------------------- */
const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");
const ERROR_GLOBAL_EVENT = "lahilda:error";
const CONFIRM_GLOBAL_EVENT = "lahilda:confirmar";
const AUTH_EXPIRED_EVENT = "lahilda:sesion-vencida";
const AUTH_SESSION_KEY = "lahilda:sesion";
const CLIENTE_DATA_KEY = "lahilda:datos-cliente";
let ultimoErrorGlobal = { mensaje: "", momento: 0 };

const FORM_CLIENTE_VACIO = { nombre: "", telefono: "", barrio: "", calle: "", detalleDireccion: "", tipo: "casa", pago: "Efectivo", notas: "", fechaEntrega: "", horarioZonaId: "" };
function leerDatosClienteGuardados() {
  if (typeof window === "undefined") return {};
  try {
    const datos = JSON.parse(window.localStorage.getItem(CLIENTE_DATA_KEY) || "{}");
    return {
      nombre: typeof datos.nombre === "string" ? datos.nombre : "",
      telefono: typeof datos.telefono === "string" ? datos.telefono : "",
      barrio: typeof datos.barrio === "string" ? datos.barrio : "",
      calle: typeof datos.calle === "string" ? datos.calle : "",
      detalleDireccion: typeof datos.detalleDireccion === "string" ? datos.detalleDireccion : "",
      pago: PAGOS?.includes(datos.pago) ? datos.pago : "Efectivo",
    };
  } catch { return {}; }
}
function formularioInicialCliente() {
  return { ...FORM_CLIENTE_VACIO, ...leerDatosClienteGuardados() };
}
function guardarDatosCliente(form) {
  try {
    window.localStorage.setItem(CLIENTE_DATA_KEY, JSON.stringify({
      nombre: form.nombre.trim(),
      telefono: form.telefono.trim(),
      barrio: form.barrio,
      calle: form.calle.trim(),
      detalleDireccion: form.detalleDireccion.trim(),
      pago: form.pago,
    }));
  } catch {}
}

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

async function api(path, { method = "GET", body, token, silencioso = false } = {}) {
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
    if (!silencioso) mostrarErrorGlobal(mensaje);
    throw new Error(mensaje);
  }
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const mensaje = mensajeAmigableApi(res.status, data, path);
    if (res.status === 401 && !path.includes("/auth/")) {
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    }
    if (!silencioso) mostrarErrorGlobal(mensaje);
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
const COBROS_CHOFER = ["Efectivo", "Transferencia", "Remito"];
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
function generarFranjasVista(horaDesde, horaHasta) {
  const aMinutos = (hora) => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora || "")) return null;
    const [h, m] = hora.split(":").map(Number);
    return h * 60 + m;
  };
  const desde = aMinutos(horaDesde);
  const hasta = aMinutos(horaHasta);
  if (desde === null || hasta === null || hasta <= desde) return [];
  return [{ horaDesde, horaHasta }];
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
function fechaIsoBuenosAires(desplazamiento = 0) {
  const fecha = new Date(Date.now() + desplazamiento * 24 * 60 * 60 * 1000);
  const partes = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(fecha).filter(parte => parte.type !== "literal").map(parte => [parte.type, parte.value]));
  return `${partes.year}-${partes.month}-${partes.day}`;
}
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
      <div role="dialog" aria-modal="true" aria-label="Comprobante de pago o remito" className="modal-card-in relative w-full max-w-2xl rounded-2xl p-3 shadow-2xl" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
        <div className="flex items-center justify-between px-2 pb-3">
          <div className="flex items-center gap-2"><FileCheck2 size={18} color={c.accent} /><span className="f-display text-base font-semibold" style={{ color: c.text }}>Comprobante de pago / remito</span></div>
          <button onClick={onClose} className="p-2 rounded-xl" style={{ background: c.surfaceAlt }} aria-label="Cerrar"><X size={17} color={c.textMuted} /></button>
        </div>
        <img src={url} alt="Comprobante de pago o remito" className="block w-full max-h-[75vh] object-contain rounded-xl" style={{ background: c.bg }} />
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
  const [visible, setVisible] = useState(false);
  const esPassword = props.type === "password";
  const input = <input {...props} type={esPassword && visible ? "text" : props.type} className={`f-body w-full px-3.5 py-2.5 ${esPassword ? "pr-11" : ""} rounded-xl text-sm outline-none ${props.className || ""}`} style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.text, ...(props.style || {}) }} />;
  if (!esPassword) return input;
  return <div className="relative w-full">{input}<button type="button" onClick={() => setVisible(actual => !actual)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg" aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}>{visible ? <EyeOff size={16} color={c.textMuted} /> : <Eye size={16} color={c.textMuted} />}</button></div>;
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

const PASOS_CLIENTE = ["Tipo de pedido", "Productos", "Datos y entrega", "Confirmación"];

function ProgresoPedido({ step, color }) {
  const c = useTheme();
  return (
    <div className="mt-7 mb-8">
      <div className="flex items-center justify-between gap-4 mb-3">
        <span className="f-body text-xs font-medium" style={{ color: c.text }}>Paso {step + 1} de 4</span>
        <span className="f-body text-xs" style={{ color: c.textFaint }}>{PASOS_CLIENTE[step]}</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map(numero => (
          <div key={numero} className="h-1.5 rounded-full transition-colors" style={{ background: step >= numero ? color : c.border }} />
        ))}
      </div>
    </div>
  );
}

function VisualCategoria({ imagenUrl, nombre, Icon, color }) {
  if (!imagenUrl) return (
    <div className="w-28 h-24 shrink-0 rounded-2xl flex items-center justify-center" style={{ background: `${color}10` }}>
      <Icon size={42} color={color} strokeWidth={1.5} />
    </div>
  );
  return (
    <div className="w-28 h-24 shrink-0 flex items-center justify-center overflow-hidden" aria-hidden="true">
      <img src={imagenUrl} alt={nombre || ""} loading="lazy" className="w-full h-full object-contain" />
    </div>
  );
}

function AyudaCliente() {
  const c = useTheme();
  return (
    <a href="https://wa.me/3515937318" target="_blank" rel="noopener noreferrer" className="f-body mx-auto mt-8 mb-3 flex w-fit items-center gap-3 rounded-full px-4 py-2.5 text-xs no-underline shadow-sm" style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.text }}>
      <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#25D366" }}><MessageCircle size={17} color="#fff" fill="#fff" /></span>
      <span>¿Necesitás ayuda?</span>
    </a>
  );
}

function normalizarBusqueda(texto) {
  return String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function SelectorBarrio({ zonas, valor, onChange, color, invalido }) {
  const c = useTheme();
  const contenedor = useRef(null);
  const [consulta, setConsulta] = useState(valor || "");
  const [abierto, setAbierto] = useState(false);
  const [indiceActivo, setIndiceActivo] = useState(0);

  useEffect(() => { setConsulta(valor || ""); }, [valor]);
  useEffect(() => {
    const cerrar = evento => { if (!contenedor.current?.contains(evento.target)) setAbierto(false); };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, []);

  const opciones = useMemo(() => {
    const busqueda = normalizarBusqueda(consulta);
    return zonas.filter(zona => !busqueda || normalizarBusqueda(zona.barrio).includes(busqueda));
  }, [consulta, zonas]);

  const elegir = barrio => {
    setConsulta(barrio);
    setAbierto(false);
    setIndiceActivo(0);
    onChange(barrio);
  };

  const escribir = evento => {
    const siguiente = evento.target.value;
    setConsulta(siguiente);
    setAbierto(true);
    setIndiceActivo(0);
    if (valor && normalizarBusqueda(siguiente) !== normalizarBusqueda(valor)) onChange("");
  };

  const manejarTecla = evento => {
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setAbierto(true);
      setIndiceActivo(actual => Math.min(actual + 1, Math.max(opciones.length - 1, 0)));
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setIndiceActivo(actual => Math.max(actual - 1, 0));
    } else if (evento.key === "Enter" && abierto && opciones[indiceActivo]) {
      evento.preventDefault();
      elegir(opciones[indiceActivo].barrio);
    } else if (evento.key === "Escape") setAbierto(false);
  };

  return (
    <div ref={contenedor} className="relative">
      <Search size={17} color={c.textFaint} className="absolute left-4 top-[18px] z-10 pointer-events-none" />
      <input
        type="search"
        name="address-level3"
        autoComplete="off"
        value={consulta}
        onChange={escribir}
        onFocus={() => setAbierto(true)}
        onKeyDown={manejarTecla}
        placeholder="Escribí tu barrio o localidad"
        role="combobox"
        aria-label="Barrio o localidad"
        aria-expanded={abierto}
        aria-controls="opciones-barrio"
        aria-autocomplete="list"
        aria-invalid={invalido || undefined}
        className="f-body w-full min-h-[52px] pl-11 pr-11 py-3 rounded-xl text-sm outline-none"
        style={{ background: c.surface, border: `1px solid ${invalido ? c.danger : c.border}`, color: consulta ? c.text : c.textFaint }}
      />
      {consulta && <button type="button" onClick={() => { setConsulta(""); setAbierto(true); setIndiceActivo(0); onChange(""); }} className="absolute right-3 top-3.5 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: c.surfaceAlt }} aria-label="Limpiar barrio"><X size={13} color={c.textMuted} /></button>}
      {abierto && <div id="opciones-barrio" role="listbox" className="absolute z-30 left-0 right-0 mt-1.5 max-h-64 overflow-y-auto rounded-2xl p-1.5 shadow-xl" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
        {opciones.length ? opciones.map((zona, indice) => <button key={zona.barrio} type="button" role="option" aria-selected={valor === zona.barrio} onMouseDown={evento => evento.preventDefault()} onClick={() => elegir(zona.barrio)} className="f-body w-full flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs" style={{ background: indice === indiceActivo || valor === zona.barrio ? `${color}12` : "transparent", color: valor === zona.barrio ? color : c.text }}><MapPin size={14} color={valor === zona.barrio ? color : c.textFaint} className="mt-0.5 shrink-0" /><span>{zona.barrio}</span></button>) : <p className="f-body px-3 py-4 text-center text-xs" style={{ color: c.textFaint }}>No encontramos un barrio con ese nombre.</p>}
      </div>}
    </div>
  );
}

/* ---------------------------------- VIDRIERA (CLIENTE) ---------------------------------- */
function ClientePortal({ onAccesoInterno, modo, setModo }) {
  const c = useTheme();
  const [productos, setProductos] = useState([]);
  const [portadasCatalogo, setPortadasCatalogo] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0); // 0: segmento, 1: productos, 2: datos, 3: revisión
  const [segmento, setSegmento] = useState(null); // { id, categoria, label }
  const [cant, setCant] = useState({});
  const [variantesElegidas, setVariantesElegidas] = useState({});
  const [productosAbiertos, setProductosAbiertos] = useState({});
  const [form, setForm] = useState(formularioInicialCliente);
  const [datosTransferencia, setDatosTransferencia] = useState({ titular: "", banco: "", alias: "", cbu: "", cuit: "", configurados: false });
  const [comprobante, setComprobante] = useState(null);
  const [confirmado, setConfirmado] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [disponibilidad, setDisponibilidad] = useState([]);
  const [cargandoDisponibilidad, setCargandoDisponibilidad] = useState(false);
  const [intentoRevision, setIntentoRevision] = useState(false);
  const [detectandoBarrio, setDetectandoBarrio] = useState(false);
  const [avisoBarrio, setAvisoBarrio] = useState(null);
  const barrioAutomatico = useRef(false);
  const consultaBarrio = useRef(0);
  const temporizadorBarrio = useRef(null);
  const direccionEnCurso = useRef("");
  const ultimaDireccionDetectada = useRef("");

  useEffect(() => {
    (async () => {
      try {
        const [prods, portadas, zs, datosPago] = await Promise.all([api("/public/productos"), api("/public/portadas-catalogo"), api("/public/zonas"), api("/public/configuracion-pago")]);
        setProductos(prods);
        setPortadasCatalogo(portadas);
        const zonasNormalizadas = zs.map(z => ({ barrio: z.barrio, camionId: z.camionId, nombre: z.camionNombre, color: colorDeCamion(z.camionId), diasEntrega: z.diasEntrega || [] }));
        setZonas(zonasNormalizadas);
        setForm(actual => actual.barrio && !zonasNormalizadas.some(z => z.barrio === actual.barrio) ? { ...actual, barrio: "", fechaEntrega: "", horarioZonaId: "" } : actual);
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

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [step, confirmado]);

  useEffect(() => () => clearTimeout(temporizadorBarrio.current), []);

  const productosDelSegmento = productos.filter(p => !segmento || p.categoria === segmento.categoria);
  const totalItems = Object.values(cant).reduce((a, b) => a + b, 0);
  const varianteElegida = (producto) => (producto.variantes || []).find(variante => variante.id === variantesElegidas[producto.id]);
  const precioUnitarioElegido = (producto) => Number(varianteElegida(producto)?.precioUnitario ?? producto.precio ?? 0);
  const totalPrecio = Object.entries(cant).reduce((sum, [id, q]) => {
    const producto = productos.find(p => p.id === Number(id));
    return sum + (producto ? precioUnitarioElegido(producto) * q : 0);
  }, 0);
  const camionAsignado = useMemo(() => { const z = zonas.find(x => x.barrio === form.barrio); return z ? { id: z.camionId, nombre: z.nombre, color: z.color } : null; }, [form.barrio, zonas]);
  const fechaElegida = disponibilidad.find(d => d.fecha === form.fechaEntrega);
  const horarioElegido = fechaElegida?.horarios.find(h => h.id === Number(form.horarioZonaId));
  const requisitosEntrega = [
    { id: "nombre", label: "nombre y apellido", incompleto: !form.nombre.trim() },
    { id: "telefono", label: "teléfono", incompleto: !form.telefono.trim() },
    { id: "calle", label: "calle y altura", incompleto: !form.calle.trim() },
    { id: "barrio", label: "barrio o localidad", incompleto: !form.barrio },
    { id: "fechaEntrega", label: "día de entrega", incompleto: !form.fechaEntrega },
    { id: "horarioZonaId", label: "franja horaria", incompleto: !form.horarioZonaId },
  ];
  const faltantesEntrega = requisitosEntrega.filter(requisito => requisito.incompleto);
  const campoInvalido = id => intentoRevision && faltantesEntrega.some(requisito => requisito.id === id);
  const setQty = (id, delta) => setCant(prev => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + delta) }));
  const elegirVariante = (producto, variante) => {
    const yaElegida = variantesElegidas[producto.id] === variante.id;
    setVariantesElegidas(prev => {
      const siguiente = { ...prev };
      if (yaElegida) delete siguiente[producto.id]; else siguiente[producto.id] = variante.id;
      return siguiente;
    });
    setCant(prev => ({ ...prev, [producto.id]: yaElegida ? 0 : variante.cantidad }));
  };
  const cambiarCantidadSuelta = (producto, delta) => {
    setVariantesElegidas(prev => {
      const siguiente = { ...prev };
      delete siguiente[producto.id];
      return siguiente;
    });
    setCant(prev => ({ ...prev, [producto.id]: Math.max(0, (variantesElegidas[producto.id] ? 0 : (prev[producto.id] || 0)) + delta) }));
  };

  const elegirSegmento = (op) => {
    setSegmento(op);
    setCant({});
    setVariantesElegidas({});
    setProductosAbiertos({});
    setForm(prev => ({ ...prev, tipo: TIPO_DESTINO_POR_SEGMENTO[op.id] || "casa" }));
    setStep(1);
  };

  const cambiarCalle = calle => {
    consultaBarrio.current += 1;
    clearTimeout(temporizadorBarrio.current);
    direccionEnCurso.current = "";
    ultimaDireccionDetectada.current = "";
    setDetectandoBarrio(false);
    setAvisoBarrio(null);
    barrioAutomatico.current = false;
    setForm(prev => ({ ...prev, calle, barrio: "", fechaEntrega: "", horarioZonaId: "" }));
    const direccion = calle.trim().replace(/\s+/g, " ");
    if (direccion.length >= 5 && /\d/.test(direccion)) {
      temporizadorBarrio.current = setTimeout(() => detectarBarrioDesdeCalle(direccion), 700);
    }
  };
  const cambiarBarrio = barrio => {
    consultaBarrio.current += 1;
    clearTimeout(temporizadorBarrio.current);
    direccionEnCurso.current = "";
    barrioAutomatico.current = false;
    setDetectandoBarrio(false);
    setAvisoBarrio(null);
    setForm(prev => ({ ...prev, barrio, fechaEntrega: "", horarioZonaId: "" }));
  };
  const detectarBarrioDesdeCalle = async calleIngresada => {
    clearTimeout(temporizadorBarrio.current);
    const calle = String(calleIngresada ?? form.calle).trim().replace(/\s+/g, " ");
    if (calle.length < 5 || !/\d/.test(calle)) {
      consultaBarrio.current += 1;
      direccionEnCurso.current = "";
      setDetectandoBarrio(false);
      setAvisoBarrio(calle ? { tipo: "aviso", texto: "Agregá la altura para que podamos detectar el barrio." } : null);
      return;
    }
    if (direccionEnCurso.current === calle || (ultimaDireccionDetectada.current === calle && barrioAutomatico.current)) return;
    const consulta = ++consultaBarrio.current;
    direccionEnCurso.current = calle;
    setDetectandoBarrio(true);
    setAvisoBarrio(null);
    try {
      const data = await api("/public/detectar-zona", { method: "POST", body: { calle } });
      if (consulta !== consultaBarrio.current) return;
      ultimaDireccionDetectada.current = calle;
      if (data.barrio && zonas.some(zona => zona.barrio === data.barrio)) {
        barrioAutomatico.current = true;
        setForm(prev => ({ ...prev, barrio: data.barrio, fechaEntrega: "", horarioZonaId: "" }));
        setAvisoBarrio({ tipo: "ok", texto: `Barrio detectado: ${data.barrio}. Podés cambiarlo si no coincide.` });
      } else {
        barrioAutomatico.current = false;
        setAvisoBarrio({ tipo: "aviso", texto: "No pudimos identificar el barrio con seguridad. Elegilo abajo." });
      }
    } catch {
      if (consulta === consultaBarrio.current) setAvisoBarrio({ tipo: "aviso", texto: "No pudimos detectar el barrio. Elegilo abajo." });
    } finally {
      if (consulta === consultaBarrio.current) {
        direccionEnCurso.current = "";
        setDetectandoBarrio(false);
      }
    }
  };
  const elegirFechaEntrega = dia => {
    const unicoHorario = dia.horarios?.length === 1 ? dia.horarios[0].id : "";
    setForm(prev => ({ ...prev, fechaEntrega: dia.fecha, horarioZonaId: unicoHorario }));
  };
  const revisarPedido = () => {
    setIntentoRevision(true);
    if (faltantesEntrega.length) {
      requestAnimationFrame(() => document.getElementById("datos-faltantes")?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    setIntentoRevision(false);
    setStep(3);
  };

  const confirmar = async () => {
    setEnviando(true); setError("");
    try {
      const items = Object.entries(cant).filter(([, q]) => q > 0).map(([id, q]) => ({ productoId: Number(id), cantidad: q, ...(variantesElegidas[id] ? { varianteId: variantesElegidas[id] } : {}) }));
      const pedido = { nombre: form.nombre, telefono: form.telefono, barrio: form.barrio, calle: form.calle, detalleDireccion: form.detalleDireccion, tipo: form.tipo, segmento: segmento?.categoria || "consumo_personal", pago: form.pago, notas: form.notas, fechaEntrega: form.fechaEntrega, horarioZonaId: Number(form.horarioZonaId), items };
      let body = pedido;
      if (form.pago === "Transferencia" && comprobante) {
        const multipart = new FormData();
        multipart.append("pedido", JSON.stringify(pedido));
        multipart.append("comprobante", comprobante);
        body = multipart;
      }
      const resp = await api("/public/pedidos", { method: "POST", body });
      guardarDatosCliente(form);
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

  const azulCliente = modo === "dark" ? "#38BDF8" : "#087FC3";
  const azulSuave = modo === "dark" ? "rgba(56,189,248,.12)" : "#EAF6FD";
  const volverAEmpezar = () => { setConfirmado(null); setStep(0); setSegmento(null); setCant({}); setVariantesElegidas({}); setProductosAbiertos({}); setDisponibilidad([]); setComprobante(null); setForm(formularioInicialCliente()); };
  const botonPrincipal = { background: azulCliente, color: "#FFFFFF", boxShadow: `0 10px 24px ${azulCliente}24` };

  return (
    <div className="flex-1 flex flex-col" style={{ background: c.bg }}>
      <header className="sticky top-0 z-20" style={{ background: `${c.bg}F2`, borderBottom: `1px solid ${c.borderSoft}`, backdropFilter: "blur(10px)" }}>
        <div className="max-w-xl mx-auto px-5 py-3 flex items-center justify-between gap-4">
          <BrandLogo variant="full" className="h-16 sm:h-[72px] w-auto max-w-[150px] object-contain" />
          <button onClick={() => setModo(modo === "dark" ? "light" : "dark")} className="w-11 h-11 rounded-full flex items-center justify-center shadow-sm shrink-0" style={{ background: c.surface, border: `1px solid ${c.border}` }} aria-label={modo === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}>
            {modo === "dark" ? <Sun size={18} color={c.amber} /> : <Moon size={18} color={azulCliente} />}
          </button>
        </div>
      </header>

      <div className="flex-1">
        {confirmado ? (
          <div className="max-w-xl mx-auto px-5 py-10 sm:py-14 text-center">
            <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-6" style={{ background: c.successSoft }}><CheckCircle2 size={38} color={c.success} /></div>
            <p className="f-body text-xs tracking-[.16em] uppercase mb-2" style={{ color: azulCliente }}>Pedido registrado</p>
            <h1 className="f-display text-3xl sm:text-4xl font-bold mb-3" style={{ color: c.text }}>¡Listo, {form.nombre.split(" ")[0]}!</h1>
            <p className="f-body text-sm leading-relaxed mb-8 max-w-sm mx-auto" style={{ color: c.textMuted }}>Tu pedido quedó confirmado. Te avisaremos por WhatsApp antes de que salga el reparto.</p>
            <div className="rounded-[22px] p-5 sm:p-6 text-left space-y-4 shadow-sm" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
              <div className="flex items-start gap-3"><MapPin size={19} color={azulCliente} className="mt-0.5 shrink-0" /><div><p className="f-body text-[11px] uppercase tracking-wide" style={{ color: c.textFaint }}>Entrega</p><p className="f-body text-sm font-medium" style={{ color: c.text }}>{form.calle}{form.detalleDireccion ? ` · ${form.detalleDireccion}` : ""}, {form.barrio}</p></div></div>
              <div className="flex items-start gap-3"><CalendarClock size={19} color={azulCliente} className="mt-0.5 shrink-0" /><div><p className="f-body text-[11px] uppercase tracking-wide" style={{ color: c.textFaint }}>Día y horario</p><p className="f-body text-sm font-medium" style={{ color: c.text }}>{formatearFechaEntrega(confirmado.fechaEntrega)}</p><p className="f-body text-xs mt-0.5" style={{ color: c.textMuted }}>{formatearFranja(confirmado.horaDesde, confirmado.horaHasta)}</p></div></div>
              <div className="h-px" style={{ background: c.border }} />
              <div className="flex justify-between items-center"><span className="f-display text-base font-semibold" style={{ color: c.text }}>Total</span><span className="f-display text-xl font-bold" style={{ color: azulCliente }}>${Number(confirmado.total).toLocaleString("es-AR")}</span></div>
            </div>
            <button onClick={volverAEmpezar} className="f-body w-full mt-5 py-3.5 rounded-2xl text-sm font-semibold" style={botonPrincipal}>Hacer otro pedido</button>
            <AyudaCliente />
          </div>
        ) : (
          <main className="max-w-xl mx-auto px-5 py-7 sm:py-9">
            <div>
              <p className="f-body text-xs font-semibold tracking-[.15em] uppercase mb-1.5" style={{ color: azulCliente }}>Pedidos online</p>
              <h1 className="f-display text-[32px] sm:text-4xl leading-[1.08] font-bold tracking-[-.025em]" style={{ color: c.text }}>Hacé tu pedido</h1>
              <p className="f-body text-sm sm:text-base mt-2" style={{ color: c.textMuted }}>Elegí qué necesitás y coordinamos tu entrega.</p>
            </div>
            <ProgresoPedido step={step} color={azulCliente} />
            <ErrorBanner mensaje={error} />

            {step === 0 && (
              <section>
                <h2 className="f-display text-2xl font-bold mb-5" style={{ color: c.text }}>¿Qué necesitás?</h2>
                <div className="space-y-3.5">
                  {OPCIONES_SEGMENTO.map(op => (
                    <button key={op.id} onClick={() => elegirSegmento(op)} className="f-body w-full min-h-[122px] flex items-center gap-3 rounded-[20px] px-3 sm:px-4 py-3 text-left transition-transform hover:-translate-y-0.5" style={{ background: c.surface, border: `1px solid ${modo === "dark" ? c.border : "#D7E5EE"}`, boxShadow: modo === "dark" ? "none" : "0 8px 22px rgba(15,23,42,.035)" }}>
                      <VisualCategoria imagenUrl={portadasCatalogo.find(portada => portada.categoria === op.categoria)?.imagenUrl} nombre={op.label} Icon={op.Icon} color={azulCliente} />
                      <div className="flex-1 min-w-0"><p className="text-base font-semibold leading-tight" style={{ color: c.text }}>{op.label}</p><p className="text-xs sm:text-sm mt-1 leading-snug" style={{ color: c.textMuted }}>{op.desc}</p></div>
                      <ChevronRight size={23} color={azulCliente} strokeWidth={1.8} className="shrink-0" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {step === 1 && (
              <section>
                <button onClick={() => setStep(0)} className="f-body flex items-center gap-2 text-xs font-medium mb-4" style={{ color: azulCliente }}><ArrowLeft size={17} /> Volver a elegir categoría</button>
                <h2 className="f-display text-2xl font-bold" style={{ color: c.text }}>Elegí tus productos</h2>
                <p className="f-body text-sm mt-1 mb-5" style={{ color: c.textMuted }}>{segmento?.label}</p>
                <div className="space-y-3.5">
                  {productosDelSegmento.map(p => {
                    const esMayorista = segmento?.categoria === "comercio_reventa" && (p.variantes || []).length > 0;
                    const elegida = varianteElegida(p);
                    const cantidadSuelta = elegida ? 0 : (cant[p.id] || 0);
                    if (esMayorista) return (
                      <article key={p.id} className="rounded-[20px] overflow-hidden shadow-sm" style={{ background: c.surface, border: `1px solid ${elegida || cantidadSuelta ? azulCliente : c.border}` }}>
                        <button onClick={() => setProductosAbiertos(prev => ({ ...prev, [p.id]: !prev[p.id] }))} className="w-full p-4 flex items-center gap-4 text-left">
                          <div className="w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden" style={{ background: c.bgAlt }}>{p.imagenUrl ? <img src={p.imagenUrl} alt={p.nombre} className="w-full h-full object-contain p-1" loading="lazy" /> : <Droplet size={25} color={azulCliente} />}</div>
                          <div className="flex-1 min-w-0"><p className="f-body text-base font-semibold" style={{ color: c.text }}>{p.nombre}</p><p className="f-body text-xs mt-1 leading-snug" style={{ color: c.textMuted }}>{elegida ? `${elegida.nombre} · ${elegida.cantidad} unidades` : cantidadSuelta ? `Compra unidad · ${cantidadSuelta} unidad${cantidadSuelta === 1 ? "" : "es"}` : (p.descripcion || "Ver cantidades y precios mayoristas")}</p>{(elegida || cantidadSuelta > 0) && <p className="f-mono text-sm font-semibold mt-1.5" style={{ color: azulCliente }}>${(precioUnitarioElegido(p) * (cant[p.id] || 0)).toLocaleString("es-AR")} total</p>}</div>
                          <ChevronDown size={20} color={azulCliente} className={`shrink-0 transition-transform ${productosAbiertos[p.id] ? "rotate-180" : ""}`} />
                        </button>
                        {productosAbiertos[p.id] && <div className="px-4 pb-4 space-y-2.5" style={{ borderTop: `1px solid ${c.borderSoft}` }}>
                          <p className="f-body text-xs pt-4" style={{ color: c.textMuted }}>Elegí la cantidad que querés comprar</p>
                          <div className="w-full rounded-2xl p-3.5 flex items-center justify-between gap-3" style={{ background: cantidadSuelta ? azulSuave : c.surfaceAlt, border: `1px solid ${cantidadSuelta ? azulCliente : c.borderSoft}` }}>
                            <div><p className="f-body text-sm font-semibold" style={{ color: cantidadSuelta ? azulCliente : c.text }}>Compra unidad</p><p className="f-body text-[11px] mt-0.5" style={{ color: c.textFaint }}>${Number(p.precio).toLocaleString("es-AR")} por unidad</p></div>
                            <div className="flex items-center gap-2"><button onClick={() => cambiarCantidadSuelta(p, -1)} disabled={!cantidadSuelta} className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-35" style={{ background: c.surface }}><Minus size={14} color={c.textMuted} /></button><span className="f-mono text-sm min-w-6 text-center" style={{ color: c.text }}>{cantidadSuelta}</span><button onClick={() => cambiarCantidadSuelta(p, 1)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: c.surface }}><Plus size={14} color={azulCliente} /></button></div>
                          </div>
                          {p.variantes.map(variante => { const seleccionada = elegida?.id === variante.id; return <button key={variante.id} onClick={() => elegirVariante(p, variante)} className="w-full rounded-2xl p-3.5 flex items-center justify-between gap-3 text-left" style={{ background: seleccionada ? azulSuave : c.surfaceAlt, border: `1px solid ${seleccionada ? azulCliente : c.borderSoft}` }}><div><p className="f-body text-sm font-semibold" style={{ color: seleccionada ? azulCliente : c.text }}>{variante.nombre}</p><p className="f-body text-[11px] mt-0.5" style={{ color: c.textFaint }}>{variante.cantidad} unidades · ${Number(variante.precioUnitario).toLocaleString("es-AR")} c/u</p></div><span className="f-mono text-sm font-semibold whitespace-nowrap" style={{ color: seleccionada ? azulCliente : c.text }}>${(Number(variante.precioUnitario) * variante.cantidad).toLocaleString("es-AR")}</span></button>; })}
                        </div>}
                      </article>
                    );
                    return (
                      <article key={p.id} className="rounded-[20px] p-4 flex items-center gap-4 shadow-sm" style={{ background: c.surface, border: `1px solid ${(cant[p.id] || 0) ? azulCliente : c.border}` }}>
                        <div className="w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden" style={{ background: c.bgAlt }}>{p.imagenUrl ? <img src={p.imagenUrl} alt={p.nombre} className="w-full h-full object-contain p-1" loading="lazy" /> : <Droplet size={25} color={azulCliente} />}</div>
                        <div className="flex-1 min-w-0"><p className="f-body text-base font-semibold" style={{ color: c.text }}>{p.nombre}</p>{p.descripcion && <p className="f-body text-xs mt-1" style={{ color: c.textMuted }}>{p.descripcion}</p>}<p className="f-mono text-sm font-semibold mt-1" style={{ color: azulCliente }}>${Number(p.precio).toLocaleString("es-AR")}</p></div>
                        <div className="flex items-center gap-2"><button onClick={() => setQty(p.id, -1)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: c.surfaceAlt }}><Minus size={14} color={c.textMuted} /></button><span className="f-mono text-sm w-5 text-center" style={{ color: c.text }}>{cant[p.id] || 0}</span><button onClick={() => setQty(p.id, 1)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: azulSuave }}><Plus size={14} color={azulCliente} /></button></div>
                      </article>
                    );
                  })}
                </div>
                {productosDelSegmento.length === 0 && <p className="f-body text-sm text-center py-10" style={{ color: c.textFaint }}>Todavía no hay productos cargados para esta categoría.</p>}
                <button disabled={totalItems === 0} onClick={() => setStep(2)} className="f-body w-full mt-5 py-4 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40" style={botonPrincipal}>Continuar ({totalItems}) <ChevronRight size={17} /></button>
              </section>
            )}

            {step === 2 && (
              <section>
                <button onClick={() => setStep(1)} className="f-body flex items-center gap-2 text-xs font-medium mb-4" style={{ color: azulCliente }}><ArrowLeft size={17} /> Volver a productos</button>
                <h2 className="f-display text-2xl font-bold" style={{ color: c.text }}>Datos de entrega</h2>
                <p className="f-body text-sm mt-1 mb-5" style={{ color: c.textMuted }}>Completá dónde y cuándo querés recibirlo.</p>
                <div className="rounded-[22px] p-4 sm:p-5 space-y-3.5 shadow-sm" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
                  <Input name="name" autoComplete="name" placeholder="Nombre y apellido" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} aria-invalid={campoInvalido("nombre") || undefined} className="min-h-[52px]" style={campoInvalido("nombre") ? { border: `1px solid ${c.danger}` } : {}} />
                  <Input name="tel" type="tel" inputMode="tel" autoComplete="tel" placeholder="Teléfono" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} aria-invalid={campoInvalido("telefono") || undefined} className="min-h-[52px]" style={campoInvalido("telefono") ? { border: `1px solid ${c.danger}` } : {}} />
                  <Input name="street-address" autoComplete="street-address" placeholder="Calle y altura" value={form.calle} onChange={e => cambiarCalle(e.target.value)} onBlur={e => detectarBarrioDesdeCalle(e.target.value)} aria-invalid={campoInvalido("calle") || undefined} className="min-h-[52px]" style={campoInvalido("calle") ? { border: `1px solid ${c.danger}` } : {}} />
                  <Input name="address-line2" autoComplete="address-line2" placeholder="Piso / Departamento / Condominio (opcional)" maxLength={120} value={form.detalleDireccion} onChange={e => setForm({ ...form, detalleDireccion: e.target.value })} className="min-h-[52px]" />
                  {detectandoBarrio && <div role="status" className="f-body flex items-center gap-2 px-1 text-xs" style={{ color: azulCliente }}><Spinner size={13} /> Buscando el barrio de esta dirección...</div>}
                  {!detectandoBarrio && avisoBarrio && <div role="status" className="f-body flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs" style={{ background: avisoBarrio.tipo === "ok" ? c.successSoft : c.amberSoft, color: avisoBarrio.tipo === "ok" ? c.success : c.amber }}><span className="mt-0.5 shrink-0">{avisoBarrio.tipo === "ok" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}</span><span>{avisoBarrio.texto}</span></div>}
                  <SelectorBarrio zonas={zonas} valor={form.barrio} onChange={cambiarBarrio} color={azulCliente} invalido={campoInvalido("barrio")} />
                </div>
                {form.barrio && <div className="mt-4 rounded-[22px] p-4 sm:p-5 space-y-4 shadow-sm" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
                  <div className="flex items-start gap-3"><div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: azulSuave }}><CalendarClock size={19} color={azulCliente} /></div><div><p className="f-body text-sm font-semibold" style={{ color: c.text }}>Elegí el día de entrega</p><p className="f-body text-xs mt-0.5" style={{ color: c.textFaint }}>Fechas disponibles para {form.barrio}.</p></div></div>
                  {cargandoDisponibilidad ? <div className="flex items-center gap-2 py-2"><Spinner size={14} /><span className="f-body text-xs" style={{ color: c.textFaint }}>Buscando próximos turnos...</span></div> : disponibilidad.length > 0 ? <div className="flex gap-2 overflow-x-auto pb-1">{disponibilidad.slice(0, 10).map(d => <button key={d.fecha} onClick={() => elegirFechaEntrega(d)} className="f-body shrink-0 rounded-2xl px-4 py-3 text-left" style={{ background: form.fechaEntrega === d.fecha ? azulSuave : c.surfaceAlt, border: `1px solid ${form.fechaEntrega === d.fecha ? azulCliente : (campoInvalido("fechaEntrega") ? c.danger : c.border)}` }}><span className="block text-sm font-semibold capitalize" style={{ color: form.fechaEntrega === d.fecha ? azulCliente : c.text }}>{new Date(`${d.fecha}T00:00:00Z`).toLocaleDateString("es-AR", { timeZone: "UTC", weekday: "short", day: "numeric" })}</span><span className="block text-[11px] mt-0.5 capitalize" style={{ color: c.textFaint }}>{new Date(`${d.fecha}T00:00:00Z`).toLocaleDateString("es-AR", { timeZone: "UTC", month: "short" })}</span></button>)}</div> : <p className="f-body text-xs px-3 py-2 rounded-xl" style={{ color: c.amber, background: c.amberSoft }}>No hay turnos disponibles para este barrio. Escribinos para coordinar.</p>}
                  {fechaElegida && <div><p className="f-body text-xs font-medium mb-2" style={{ color: c.textMuted }}>Franja horaria aproximada</p><div className="grid gap-2">{fechaElegida.horarios.map(h => <button key={h.id} onClick={() => setForm({ ...form, horarioZonaId: h.id })} className="f-body w-full px-4 py-3 rounded-xl text-sm text-left" style={{ background: Number(form.horarioZonaId) === h.id ? azulSuave : c.surfaceAlt, border: `1px solid ${Number(form.horarioZonaId) === h.id ? azulCliente : (campoInvalido("horarioZonaId") ? c.danger : c.border)}`, color: Number(form.horarioZonaId) === h.id ? azulCliente : c.text }}>{formatearFranja(h.horaDesde, h.horaHasta)}{h.cupoDisponible <= 2 ? ` · ${h.cupoDisponible} cupo${h.cupoDisponible === 1 ? "" : "s"}` : ""}</button>)}</div>{fechaElegida.horarios.length === 1 && form.horarioZonaId && <p className="f-body text-[11px] mt-2" style={{ color: azulCliente }}>Seleccionamos automáticamente la única franja disponible.</p>}<p className="f-body text-[11px] mt-2" style={{ color: c.textFaint }}>La hora es aproximada: el chofer organiza el recorrido dentro de esta franja.</p></div>}
                </div>}
                <div className="mt-4 rounded-[22px] p-4 sm:p-5 space-y-5 shadow-sm" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
                  <div><p className="f-body text-xs font-medium mb-2" style={{ color: c.textMuted }}>Tipo de pedido</p><div className="f-body w-full px-4 py-3.5 rounded-xl text-sm flex items-center justify-between" style={{ background: c.surfaceAlt }}><span style={{ color: c.text }}>{segmento?.label || "—"}</span><span className="text-[11px]" style={{ color: c.textFaint }}>Elegido al inicio</span></div></div>
                  <div><p className="f-body text-xs font-medium mb-2" style={{ color: c.textMuted }}>¿Cómo vas a pagar?</p><div className="grid grid-cols-2 gap-2">{PAGOS.map(p => <button key={p} onClick={() => { setForm({ ...form, pago: p }); if (p !== "Transferencia") setComprobante(null); }} className="f-body px-3 py-3 rounded-xl text-sm font-medium" style={{ background: form.pago === p ? azulSuave : c.surfaceAlt, border: `1px solid ${form.pago === p ? azulCliente : c.border}`, color: form.pago === p ? azulCliente : c.textMuted }}>{p}</button>)}</div><p className="f-body text-[11px] mt-2" style={{ color: c.textFaint }}>{form.pago === "Transferencia" ? "Podés transferir ahora o después de recibir el pedido. El comprobante es opcional." : "El pago en efectivo se coordina con el chofer."}</p></div>
                  {form.pago === "Transferencia" && <div className="rounded-2xl p-4 space-y-3" style={{ background: azulSuave, border: `1px solid ${azulCliente}55` }}><div className="flex items-center gap-2"><Landmark size={18} color={azulCliente} /><p className="f-body text-sm font-semibold" style={{ color: c.text }}>Datos para transferir</p></div><div className="flex items-center justify-between gap-4 rounded-xl p-3.5" style={{ background: c.surface }}><div><p className="f-body text-[10px] uppercase tracking-wide" style={{ color: c.textFaint }}>Total exacto</p><p className="f-body text-[11px] mt-0.5" style={{ color: c.textMuted }}>Podés pagarlo ahora o después.</p></div><span className="f-display text-xl font-bold whitespace-nowrap" style={{ color: azulCliente }}>${totalPrecio.toLocaleString("es-AR")}</span></div>{datosTransferencia.configurados ? <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">{datosTransferencia.titular && <div><span className="block" style={{ color: c.textFaint }}>Titular</span><span style={{ color: c.text }}>{datosTransferencia.titular}</span></div>}{datosTransferencia.banco && <div><span className="block" style={{ color: c.textFaint }}>Banco</span><span style={{ color: c.text }}>{datosTransferencia.banco}</span></div>}{datosTransferencia.alias && <div><span className="block" style={{ color: c.textFaint }}>Alias</span><span className="f-mono" style={{ color: c.text }}>{datosTransferencia.alias}</span></div>}{datosTransferencia.cbu && <div><span className="block" style={{ color: c.textFaint }}>CBU/CVU</span><span className="f-mono break-all" style={{ color: c.text }}>{datosTransferencia.cbu}</span></div>}{datosTransferencia.cuit && <div><span className="block" style={{ color: c.textFaint }}>CUIT</span><span className="f-mono" style={{ color: c.text }}>{datosTransferencia.cuit}</span></div>}</div> : <p className="f-body text-xs" style={{ color: c.amber }}>Los datos todavía no están publicados. Podés confirmar y coordinar la transferencia después.</p>}<label className="f-body flex items-center justify-center gap-2 w-full px-3 py-3 rounded-xl text-xs font-semibold cursor-pointer" style={{ background: c.surface, border: `1px dashed ${comprobante ? c.success : azulCliente}`, color: comprobante ? c.success : azulCliente }}>{comprobante ? <FileCheck2 size={16} /> : <Upload size={16} />}<span className="truncate">{comprobante ? comprobante.name : "Subir captura del pago (opcional)"}</span><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => setComprobante(e.target.files?.[0] || null)} /></label></div>}
                  <div><p className="f-body text-xs font-medium mb-2" style={{ color: c.textMuted }}>Notas para la entrega <span style={{ color: c.textFaint }}>(opcional)</span></p><textarea value={form.notas} maxLength={500} onChange={e => setForm({ ...form, notas: e.target.value })} rows={3} placeholder="Ej.: tocar timbre 2, portón negro, llamar antes de llegar..." className="f-body w-full px-4 py-3 rounded-xl text-sm outline-none resize-none" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.text }} /><p className="f-body text-[10px] text-right mt-1" style={{ color: c.textFaint }}>{form.notas.length}/500</p></div>
                </div>
                {intentoRevision && faltantesEntrega.length > 0 && <div id="datos-faltantes" role="alert" className="mt-4 flex items-start gap-3 rounded-2xl p-4" style={{ background: c.dangerSoft, border: `1px solid ${c.danger}55` }}><AlertCircle size={18} color={c.danger} className="mt-0.5 shrink-0" /><div><p className="f-body text-sm font-semibold" style={{ color: c.danger }}>Falta completar:</p><p className="f-body text-xs mt-1 leading-relaxed" style={{ color: c.text }}>{faltantesEntrega.map(requisito => requisito.label).join(", ")}.</p></div></div>}
                <button onClick={revisarPedido} className="f-body w-full mt-5 py-4 rounded-2xl text-sm font-semibold" style={botonPrincipal}>Revisar pedido</button>
              </section>
            )}

            {step === 3 && (
              <section>
                <button onClick={() => setStep(2)} className="f-body flex items-center gap-2 text-xs font-medium mb-4" style={{ color: azulCliente }}><ArrowLeft size={17} /> Volver a datos</button>
                <h2 className="f-display text-2xl font-bold" style={{ color: c.text }}>Revisá tu pedido</h2>
                <p className="f-body text-sm mt-1 mb-5" style={{ color: c.textMuted }}>Chequeá que esté todo bien antes de confirmarlo.</p>
                <div className="space-y-4">
                  <DeliveryMap barrio={form.barrio} direccion={form.calle} />
                  <div className="rounded-[22px] p-4 sm:p-5" style={{ background: azulSuave, border: `1px solid ${azulCliente}44` }}><div className="flex items-start gap-3"><CalendarClock size={19} color={azulCliente} className="mt-0.5 shrink-0" /><div><p className="f-body text-sm font-semibold" style={{ color: c.text }}>{formatearFechaEntrega(form.fechaEntrega)}</p><p className="f-body text-xs mt-1" style={{ color: c.textMuted }}>{formatearFranja(horarioElegido?.horaDesde, horarioElegido?.horaHasta)} · horario aproximado</p></div></div>{form.notas && <div className="f-body text-xs pt-3 mt-3" style={{ borderTop: `1px solid ${c.borderSoft}`, color: c.textMuted }}><b style={{ color: c.text }}>Notas:</b> {form.notas}</div>}</div>
                  <div className="rounded-[22px] p-4 sm:p-5 space-y-3 shadow-sm" style={{ background: c.surface, border: `1px solid ${c.border}` }}>{Object.entries(cant).filter(([, q]) => q > 0).map(([id, q]) => { const p = productos.find(x => x.id === Number(id)); if (!p) return null; const variante = varianteElegida(p); return <div key={id} className="flex justify-between gap-4 f-body text-sm"><span style={{ color: c.text }}>{q}× {p.nombre}{variante ? <span className="block text-[11px] mt-0.5" style={{ color: c.textFaint }}>{variante.nombre}</span> : null}</span><span className="f-mono whitespace-nowrap" style={{ color: c.textMuted }}>${(precioUnitarioElegido(p) * q).toLocaleString("es-AR")}</span></div>; })}<div className="h-px my-1" style={{ background: c.border }} /><div className="flex justify-between items-center"><span className="f-display text-base font-semibold" style={{ color: c.text }}>Total</span><span className="f-display text-xl font-bold" style={{ color: azulCliente }}>${totalPrecio.toLocaleString("es-AR")}</span></div><div className="flex justify-between gap-4 f-body text-xs pt-1"><span style={{ color: c.textMuted }}>Pago</span><span className="text-right" style={{ color: c.text }}>{form.pago}{form.pago === "Transferencia" ? (comprobante ? " · comprobante adjunto" : " · comprobante pendiente") : ""}</span></div></div>
                  <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl" style={{ background: c.amberSoft }}><Clock size={16} color={c.amber} className="mt-0.5 shrink-0" /><span className="f-body text-xs leading-relaxed" style={{ color: c.text }}>El chofer organiza su recorrido dentro de la franja elegida; te avisaremos antes de llegar.</span></div>
                  <button disabled={enviando} onClick={confirmar} className="f-body w-full py-4 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60" style={botonPrincipal}>{enviando && <Spinner size={15} />} Confirmar pedido</button>
                </div>
              </section>
            )}
            <AyudaCliente />
          </main>
        )}
      </div>

      <button onClick={onAccesoInterno} className="f-body flex items-center justify-center gap-1.5 py-4 text-[11px] opacity-60 hover:opacity-100 transition-opacity" style={{ color: c.textFaint }}><Lock size={11} /> Acceso interno</button>
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
function NotaCamionEditor({ pedidoId, valor, token, onGuardada }) {
  const c = useTheme();
  const [nota, setNota] = useState(valor || "");
  const [guardando, setGuardando] = useState(false);
  const [guardada, setGuardada] = useState(false);

  useEffect(() => { setNota(valor || ""); }, [valor]);

  const guardar = async () => {
    setGuardando(true);
    setGuardada(false);
    try {
      const data = await api(`/chofer/pedidos/${pedidoId}/nota`, {
        method: "PATCH", token, body: { notaCamion: nota },
      });
      setNota(data.notaCamion || "");
      setGuardada(true);
      onGuardada?.(data.notaCamion || "");
    } finally { setGuardando(false); }
  };

  return (
    <div className="rounded-xl p-2.5 mb-3" style={{ background: c.surfaceAlt, border: `1px solid ${c.borderSoft}` }}>
      <label className="f-body text-[11px] font-medium" style={{ color: c.text }}>Nota camión</label>
      <textarea value={nota} onChange={e => { setNota(e.target.value); setGuardada(false); }} maxLength={500} rows={2} placeholder="Ej.: dejó envases, paga después, llamar antes de volver..." className="f-body w-full mt-1.5 px-2.5 py-2 rounded-lg text-xs outline-none resize-y" style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.text }} />
      <div className="flex items-center justify-between gap-2 mt-1.5">
        <span className="f-body text-[10px]" style={{ color: guardada ? c.success : c.textFaint }}>{guardada ? "Nota guardada" : `${nota.length}/500`}</span>
        <button onClick={guardar} disabled={guardando || nota.trim() === (valor || "")} className="f-body inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium disabled:opacity-40" style={{ background: c.accentSoft, color: c.accent }}>{guardando ? <Spinner size={11} /> : <Save size={11} />} Guardar nota</button>
      </div>
    </div>
  );
}

function CantidadesEntregadasEditor({ pedido, token, habilitado, onGuardado }) {
  const c = useTheme();
  const [editando, setEditando] = useState(false);
  const [cantidades, setCantidades] = useState({});
  const [catalogo, setCatalogo] = useState([]);
  const [productoParaAgregar, setProductoParaAgregar] = useState("");
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const claveItem = item => item.productoId ? `producto-${item.productoId}` : `item-${item.id}`;
  const firmaItems = (pedido.items || []).map(item => `${claveItem(item)}:${item.cantidad}`).join("|");

  useEffect(() => {
    setCantidades(Object.fromEntries((pedido.items || []).map(item => [claveItem(item), item.cantidad])));
    setEditando(false);
    setProductoParaAgregar("");
  }, [pedido.id, firmaItems]);

  if (!(pedido.items || []).length) return null;
  const productosActuales = pedido.items.map(item => ({
    clave: claveItem(item),
    itemId: item.id,
    productoId: item.productoId,
    nombre: item.nombre,
    precio: item.precioUnitario,
  }));
  const clavesActuales = new Set(productosActuales.map(item => item.clave));
  const productosAgregados = catalogo
    .filter(producto => cantidades[`producto-${producto.id}`] !== undefined && !clavesActuales.has(`producto-${producto.id}`))
    .map(producto => ({ clave: `producto-${producto.id}`, productoId: producto.id, nombre: producto.nombre, precio: producto.precio }));
  const filas = [...productosActuales, ...productosAgregados];
  const firmaOriginal = productosActuales.map(item => `${item.clave}:${Number(pedido.items.find(actual => claveItem(actual) === item.clave)?.cantidad || 0)}`).sort().join("|");
  const firmaNueva = filas.filter(item => Number(cantidades[item.clave] || 0) > 0).map(item => `${item.clave}:${Number(cantidades[item.clave])}`).sort().join("|");
  const cambioPendiente = firmaNueva !== firmaOriginal;
  const opcionesParaAgregar = catalogo.filter(producto => cantidades[`producto-${producto.id}`] === undefined);
  const cambiar = (clave, delta) => setCantidades(actual => ({ ...actual, [clave]: Math.max(0, Math.min(999, Number(actual[clave] || 0) + delta)) }));

  const abrirEditor = async () => {
    setEditando(true);
    if (catalogo.length) return;
    setCargandoCatalogo(true);
    try { setCatalogo(await api("/public/productos")); }
    finally { setCargandoCatalogo(false); }
  };

  const agregarProducto = () => {
    const productoId = Number(productoParaAgregar);
    if (!productoId) return;
    setCantidades(actual => ({ ...actual, [`producto-${productoId}`]: 1 }));
    setProductoParaAgregar("");
  };

  const guardar = async () => {
    const items = filas
      .filter(item => Number(cantidades[item.clave] || 0) > 0)
      .map(item => ({ ...(item.productoId ? { productoId: item.productoId } : { itemId: item.itemId }), cantidad: Number(cantidades[item.clave]) }));
    if (!items.length) return mostrarErrorGlobal("El pedido debe conservar al menos un producto.");
    setGuardando(true);
    try {
      const actualizado = await api(`/chofer/pedidos/${pedido.id}/items`, { method: "PATCH", token, body: { items } });
      onGuardado?.(actualizado);
      setEditando(false);
    } finally { setGuardando(false); }
  };

  return (
    <div className="rounded-xl p-2.5 mb-3" style={{ background: c.accentSoft, border: `1px solid ${c.borderSoft}` }}>
      <div className="flex items-center justify-between gap-2">
        <div><p className="f-body text-[11px] font-medium" style={{ color: c.text }}>Productos realmente entregados</p><p className="f-body text-[10px] mt-0.5" style={{ color: c.textFaint }}>Podés cambiar cantidades, quitar o agregar productos.</p></div>
        {habilitado && !editando && <button onClick={abrirEditor} className="f-body inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium" style={{ background: c.surface, color: c.accent }}><Pencil size={11} /> Modificar</button>}
      </div>
      {editando && (
        <div className="space-y-2 mt-2.5">
          {filas.map(item => (
            <div key={item.clave} className="flex items-center gap-2 rounded-lg px-2.5 py-2" style={{ background: c.surface, opacity: Number(cantidades[item.clave] || 0) === 0 ? 0.55 : 1 }}>
              <span className="f-body text-xs flex-1" style={{ color: c.text }}>{item.nombre}</span>
              <button onClick={() => cambiar(item.clave, -1)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: c.surfaceAlt }}><Minus size={12} color={c.textMuted} /></button>
              <input type="number" min="0" max="999" value={cantidades[item.clave] ?? 0} onChange={e => setCantidades(actual => ({ ...actual, [item.clave]: Math.max(0, Math.min(999, Number(e.target.value) || 0)) }))} className="f-mono w-14 text-center text-xs px-1 py-1.5 rounded-lg outline-none" style={{ background: c.bgAlt, border: `1px solid ${c.border}`, color: c.text }} />
              <button onClick={() => cambiar(item.clave, 1)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: c.accentSoft }}><Plus size={12} color={c.accent} /></button>
            </div>
          ))}
          <div className="flex gap-2 rounded-lg p-2" style={{ background: c.surface }}>
            <select value={productoParaAgregar} onChange={e => setProductoParaAgregar(e.target.value)} disabled={cargandoCatalogo || !opcionesParaAgregar.length} className="f-body flex-1 min-w-0 px-2.5 py-2 rounded-lg text-[11px] outline-none disabled:opacity-60" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.text }}>
              <option value="">{cargandoCatalogo ? "Cargando productos..." : opcionesParaAgregar.length ? "Elegí un producto para agregar" : "Todos los productos ya están incluidos"}</option>
              {opcionesParaAgregar.map(producto => <option key={producto.id} value={producto.id}>{producto.nombre}</option>)}
            </select>
            <button onClick={agregarProducto} disabled={!productoParaAgregar} className="f-body inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-medium disabled:opacity-40 shrink-0" style={{ background: c.accentSoft, color: c.accent }}><Plus size={12} /> Agregar</button>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setCantidades(Object.fromEntries(pedido.items.map(item => [claveItem(item), item.cantidad]))); setProductoParaAgregar(""); setEditando(false); }} disabled={guardando} className="f-body px-2.5 py-1.5 text-[11px]" style={{ color: c.textFaint }}>Cancelar</button>
            <button onClick={guardar} disabled={guardando || !cambioPendiente} className="f-body inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium disabled:opacity-40" style={{ background: c.accent, color: c.bgAlt }}>{guardando ? <Spinner size={11} /> : <Save size={11} />} Guardar productos</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CajaChofer({ session, dia, pedidos }) {
  const c = useTheme();
  const [caja, setCaja] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [monto, setMonto] = useState("");
  const [concepto, setConcepto] = useState("");
  const [responsable, setResponsable] = useState(session.nombre || "");
  const [declarado, setDeclarado] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const desplazamiento = dia === "ayer" ? -1 : dia === "manana" ? 1 : 0;
  const fecha = fechaIsoBuenosAires(desplazamiento);
  const firmaPedidos = pedidos.map(p => `${p.id}:${p.estado}:${p.pagoConfirmado || ""}:${p.total}`).join("|");
  const moneda = valor => `$${Number(valor || 0).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const cargar = useCallback(async () => {
    if (dia === "manana") return setCaja(null);
    setCargando(true);
    try {
      const data = await api(`/chofer/caja?fecha=${fecha}`, { token: session.token });
      setCaja(data);
      setObservaciones(data.observaciones || "");
      setDeclarado(data.efectivoDeclarado == null ? String(data.efectivoEsperado ?? "") : String(data.efectivoDeclarado));
    } finally { setCargando(false); }
  }, [dia, fecha, session.token]);

  useEffect(() => { cargar(); }, [cargar, firmaPedidos]);
  if (dia === "manana") return null;

  const agregar = async () => {
    setGuardando(true);
    try {
      const data = await api("/chofer/caja/extracciones", { method: "POST", token: session.token, body: { fecha, monto: Number(monto), concepto, responsable } });
      setCaja(data); setMonto(""); setConcepto(""); setDeclarado(String(data.efectivoEsperado));
    } finally { setGuardando(false); }
  };
  const quitar = async id => {
    setGuardando(true);
    try {
      const data = await api(`/chofer/caja/extracciones/${id}`, { method: "DELETE", token: session.token });
      setCaja(data); setDeclarado(String(data.efectivoEsperado));
    } finally { setGuardando(false); }
  };
  const cerrar = async () => {
    const ok = await confirmarAccion({ titulo: "Cerrar la caja del día", mensaje: `Se registrará una rendición de ${moneda(declarado)}. Después solamente administración podrá reabrirla.`, textoConfirmar: "Cerrar caja", peligro: false });
    if (!ok) return;
    setGuardando(true);
    try { setCaja(await api("/chofer/caja/cerrar", { method: "POST", token: session.token, body: { fecha, efectivoDeclarado: Number(declarado), observaciones } })); }
    finally { setGuardando(false); }
  };

  return (
    <section className="mt-5 rounded-2xl p-4" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div><p className="f-display text-base font-semibold flex items-center gap-2" style={{ color: c.text }}><Wallet size={17} color={c.accent} /> Cierre de caja</p><p className="f-body text-[11px] mt-1" style={{ color: c.textFaint }}>Rendición del reparto y productos entregados.</p></div>
        {caja?.cerrado && <span className="f-body text-[11px] px-2.5 py-1 rounded-full" style={{ background: c.successSoft, color: c.success }}>Caja cerrada</span>}
      </div>
      {cargando && !caja ? <Cargando label="Calculando caja..." /> : caja && <>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <ResumenCajaDato label="Ventas entregadas" valor={moneda(caja.ventasTotal)} color={c.text} fondo={c.surfaceAlt} />
          <ResumenCajaDato label="Efectivo cobrado" valor={moneda(caja.efectivoCobrado)} color={c.success} fondo={c.successSoft} />
          <ResumenCajaDato label="Transferencias" valor={moneda(caja.transferenciasCobradas)} color={c.accent} fondo={c.accentSoft} />
          <ResumenCajaDato label="Remitos" valor={moneda(caja.remitosTotal)} color={caja.remitosTotal ? c.amber : c.text} fondo={caja.remitosTotal ? c.amberSoft : c.surfaceAlt} />
        </div>
        <div className="mb-4"><p className="f-body text-xs font-medium mb-2" style={{ color: c.text }}>Productos entregados</p>{caja.productos.length ? <div className="space-y-1.5">{caja.productos.map(producto => <div key={producto.nombre} className="flex justify-between text-xs"><span className="f-body" style={{ color: c.textMuted }}>{producto.nombre}</span><span className="f-mono" style={{ color: c.text }}>{producto.cantidad} un.</span></div>)}</div> : <p className="f-body text-[11px]" style={{ color: c.textFaint }}>Todavía no hay entregas registradas.</p>}</div>
        <div className="mb-4 pt-3" style={{ borderTop: `1px solid ${c.borderSoft}` }}>
          <div className="flex justify-between items-center mb-2"><p className="f-body text-xs font-medium" style={{ color: c.text }}>Extracciones de efectivo</p><span className="f-mono text-xs" style={{ color: c.danger }}>− {moneda(caja.extraccionesTotal)}</span></div>
          <div className="space-y-1.5 mb-3">{caja.extracciones.map(item => <div key={item.id} className="flex items-start gap-2 rounded-lg px-2.5 py-2" style={{ background: c.dangerSoft }}><div className="min-w-0 flex-1"><p className="f-body text-[11px] font-medium" style={{ color: c.text }}>{item.concepto}</p><p className="f-body text-[10px]" style={{ color: c.textFaint }}>{item.responsable}</p></div><span className="f-mono text-[11px]" style={{ color: c.danger }}>− {moneda(item.monto)}</span>{!caja.cerrado && <button onClick={() => quitar(item.id)} disabled={guardando} aria-label="Quitar extracción"><Trash2 size={13} color={c.danger} /></button>}</div>)}</div>
          {!caja.cerrado && <div className="grid grid-cols-2 gap-2"><Input type="number" min="0" step="1" placeholder="Monto retirado" value={monto} onChange={e => setMonto(e.target.value)} /><Input placeholder="Responsable" value={responsable} onChange={e => setResponsable(e.target.value)} /><Input className="col-span-2" placeholder="Motivo, por ejemplo: combustible" value={concepto} onChange={e => setConcepto(e.target.value)} /><button onClick={agregar} disabled={guardando || !monto || !concepto.trim() || !responsable.trim()} className="f-body col-span-2 py-2 rounded-xl text-xs font-medium disabled:opacity-40" style={{ background: c.dangerSoft, color: c.danger }}>Registrar extracción</button></div>}
        </div>
        <div className="rounded-xl p-3 mb-3" style={{ background: c.accentSoft }}><div className="flex justify-between items-end"><div><p className="f-body text-[10px]" style={{ color: c.textFaint }}>Efectivo esperado para rendir</p><p className="f-body text-[10px] mt-1" style={{ color: c.textMuted }}>Efectivo cobrado menos extracciones</p></div><p className="f-mono text-xl font-semibold" style={{ color: c.accent }}>{moneda(caja.efectivoEsperado)}</p></div></div>
        {caja.cerrado ? <div className="space-y-2"><div className="flex justify-between text-sm"><span className="f-body" style={{ color: c.textMuted }}>Efectivo entregado</span><span className="f-mono" style={{ color: c.text }}>{moneda(caja.efectivoDeclarado)}</span></div><div className="flex justify-between text-sm"><span className="f-body" style={{ color: c.textMuted }}>Diferencia</span><span className="f-mono" style={{ color: caja.diferencia === 0 ? c.success : c.danger }}>{moneda(caja.diferencia)}</span></div>{caja.observaciones && <p className="f-body text-[11px] rounded-lg p-2" style={{ background: c.surfaceAlt, color: c.textMuted }}>{caja.observaciones}</p>}</div> : <div className="space-y-2"><Input type="number" min="0" step="1" placeholder="Efectivo que entregás" value={declarado} onChange={e => setDeclarado(e.target.value)} /><textarea rows={2} placeholder="Observaciones del cierre (opcional)" value={observaciones} maxLength={500} onChange={e => setObservaciones(e.target.value)} className="f-body w-full px-3.5 py-2.5 rounded-xl text-sm outline-none resize-none" style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.text }} /><button onClick={cerrar} disabled={guardando || declarado === ""} className="f-body w-full py-2.5 rounded-xl text-xs font-semibold disabled:opacity-50 inline-flex justify-center items-center gap-2" style={{ background: c.accent, color: c.bgAlt }}>{guardando ? <Spinner size={13} /> : <Wallet size={14} />} Cerrar y rendir caja</button></div>}
      </>}
    </section>
  );
}

function ResumenCajaDato({ label, valor, color, fondo }) {
  const c = useTheme();
  return <div className="rounded-xl p-3" style={{ background: fondo }}><p className="f-body text-[10px]" style={{ color: c.textFaint }}>{label}</p><p className="f-mono text-base mt-1" style={{ color }}>{valor}</p></div>;
}

function ResumenCarga({ carga, compacto = false }) {
  const c = useTheme();
  if (!carga) return null;
  return <div className="rounded-2xl p-4" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
    <div className="flex items-start justify-between gap-3 mb-3"><div><p className="f-display text-sm font-semibold flex items-center gap-2" style={{ color: c.text }}><Package size={16} color={c.accent} /> Carga para retirar</p><p className="f-body text-[11px] mt-1" style={{ color: c.textFaint }}>{carga.pedidosProgramados} pedido{carga.pedidosProgramados !== 1 ? "s" : ""} programado{carga.pedidosProgramados !== 1 ? "s" : ""}</p></div>{carga.chofer?.nombre && <span className="f-body text-[11px] px-2 py-1 rounded-full" style={{ background: c.accentSoft, color: c.accent }}>{carga.chofer.nombre}</span>}</div>
    {carga.programado.length ? <div className={`grid ${compacto ? "sm:grid-cols-2" : "grid-cols-2"} gap-2`}>{carga.programado.map(producto => <div key={producto.nombre} className="rounded-xl p-2.5" style={{ background: c.surfaceAlt }}><p className="f-mono text-lg font-semibold" style={{ color: c.accent }}>{producto.cantidad}</p><p className="f-body text-[11px] leading-tight mt-0.5" style={{ color: c.textMuted }}>{producto.nombre}</p>{carga.pendiente.find(p => p.nombre === producto.nombre)?.cantidad !== producto.cantidad && <p className="f-body text-[10px] mt-1" style={{ color: c.amber }}>Faltan {carga.pendiente.find(p => p.nombre === producto.nombre)?.cantidad || 0}</p>}</div>)}</div> : <p className="f-body text-xs py-3 text-center" style={{ color: c.textFaint }}>No hay mercadería programada para este día.</p>}
  </div>;
}

function enlaceNavegacionRuta(ruta) {
  if (!ruta?.origen || !ruta?.paradas?.length) return "";
  const origen = `${ruta.origen.latitud},${ruta.origen.longitud}`;
  const ultima = ruta.paradas[ruta.paradas.length - 1];
  const params = new URLSearchParams({
    api: "1",
    origin: origen,
    destination: `${ultima.latitud},${ultima.longitud}`,
    travelmode: "driving",
  });
  const intermedias = ruta.paradas.slice(0, -1).map((parada) => `${parada.latitud},${parada.longitud}`).join("|");
  if (intermedias) params.set("waypoints", intermedias);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function MapaRutaChofer({ ruta, modoPanel = false }) {
  const c = useTheme();
  const contenedorRef = useRef(null);

  useEffect(() => {
    if (!contenedorRef.current || !ruta?.disponible || !ruta?.geometria?.coordinates?.length) return undefined;
    const mapa = L.map(contenedorRef.current, { zoomControl: true, scrollWheelZoom: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa);

    const crearIcono = (texto, fondo, borde = "#ffffff") => L.divIcon({
      className: "",
      html: `<div style="width:30px;height:30px;border-radius:999px;background:${fondo};color:#fff;border:3px solid ${borde};box-shadow:0 2px 8px rgba(15,23,42,.35);display:flex;align-items:center;justify-content:center;font:700 12px Inter,sans-serif">${texto}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });

    const origen = [Number(ruta.origen.latitud), Number(ruta.origen.longitud)];
    const origenEnVivo = Boolean(ruta.ubicacionActual);
    L.marker(origen, { icon: crearIcono(origenEnVivo ? "🚚" : "G", origenEnVivo ? "#0878d1" : "#0f172a", c.accent) }).addTo(mapa).bindTooltip(origenEnVivo ? "Ubicación actual del camión" : "Galpón", { direction: "top" });
    ruta.paradas.forEach((parada) => {
      L.marker([Number(parada.latitud), Number(parada.longitud)], { icon: crearIcono(parada.parada, parada.parada === 1 ? "#0b3b82" : c.accent) })
        .addTo(mapa)
        .bindTooltip(`${parada.parada}. ${parada.cliente}`, { direction: "top" });
    });
    const recorrido = L.geoJSON(ruta.geometria, { style: { color: c.accent, weight: 5, opacity: 0.9 } }).addTo(mapa);
    const limites = recorrido.getBounds();
    if (limites.isValid()) mapa.fitBounds(limites, { padding: [24, 24], maxZoom: 16 });
    setTimeout(() => mapa.invalidateSize(), 0);
    return () => mapa.remove();
  }, [ruta, c]);

  if (!ruta?.disponible) {
    return (
      <div className={`rounded-2xl p-4 ${modoPanel ? "h-full min-h-[460px] flex flex-col justify-center" : "mt-4"}`} style={{ background: c.surface, border: `1px solid ${c.border}` }}>
        <p className="f-display text-sm font-semibold flex items-center gap-2" style={{ color: c.text }}><Navigation size={16} color={c.accent} /> Mapa del recorrido</p>
        <p className="f-body text-xs mt-2" style={{ color: c.textFaint }}>No hay paradas pendientes con ubicación para mostrar en este día.</p>
      </div>
    );
  }

  const km = ruta.distanciaMetros != null ? (ruta.distanciaMetros / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 }) : null;
  const minutos = ruta.duracionSegundos != null ? Math.max(1, Math.round(ruta.duracionSegundos / 60)) : null;
  const navegar = enlaceNavegacionRuta(ruta);
  const proximaMinutos = ruta.proximaParada?.duracionSegundos != null ? Math.max(1, Math.round(ruta.proximaParada.duracionSegundos / 60)) : null;
  const proximaKm = ruta.proximaParada?.distanciaMetros != null ? (ruta.proximaParada.distanciaMetros / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 }) : null;
  const origenEtiqueta = ruta.ubicacionActual ? "Ubicación actual" : "Galpón";
  return (
    <section className={`rounded-2xl overflow-hidden ${modoPanel ? "h-full" : "mt-4"}`} style={{ background: c.surface, border: `1px solid ${c.border}` }}>
      <div className="p-4 flex items-start justify-between gap-3">
        <div>
          <p className="f-display text-sm font-semibold flex items-center gap-2" style={{ color: c.text }}><Navigation size={16} color={c.accent} /> Mapa del recorrido</p>
          <p className="f-body text-[11px] mt-1" style={{ color: c.textFaint }}>
            {origenEtiqueta} + {ruta.paradas.length} parada{ruta.paradas.length !== 1 ? "s" : ""}{km ? ` · ${km} km` : ""}{minutos ? ` · ${minutos} min aprox.` : ""}
          </p>
        </div>
        {navegar && <a href={navegar} target="_blank" rel="noreferrer" className="f-body shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-[11px] font-medium" style={{ background: c.accentSoft, color: c.accent }}><ExternalLink size={12} /> Navegar</a>}
      </div>
      {!modoPanel && ruta.proximaParada && <div className="mx-4 mb-3 rounded-xl p-3 flex items-start gap-2.5" style={{ background: c.accentSoft, border: `1px solid ${c.accent}33` }}><div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center f-mono text-xs font-semibold" style={{ background: c.accent, color: c.bgAlt }}>1</div><div className="min-w-0"><p className="f-body text-[10px] uppercase tracking-wide" style={{ color: c.accent }}>Próxima parada</p><p className="f-body text-sm font-semibold truncate mt-0.5" style={{ color: c.text }}>{ruta.proximaParada.cliente}</p><p className="f-body text-[11px] mt-0.5" style={{ color: c.textMuted }}>{ruta.proximaParada.direccion}{proximaMinutos ? ` · ${proximaMinutos} min` : ""}{proximaKm ? ` · ${proximaKm} km` : ""}</p></div></div>}
      {ruta.modo === "aproximado" && <p className="f-body mx-4 mb-3 rounded-lg px-2.5 py-2 text-[10px]" style={{ background: c.amberSoft, color: c.amber }}>El proveedor de rutas no respondió: se muestra una unión aproximada entre paradas.</p>}
      <div ref={contenedorRef} className={`w-full ${modoPanel ? "h-[500px] xl:h-[560px]" : "h-[330px]"}`} aria-label="Mapa interactivo del recorrido del chofer" />
      <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ borderTop: `1px solid ${c.borderSoft}` }}>
        <p className="f-body text-[10px]" style={{ color: c.textFaint }}><b style={{ color: c.textMuted }}>{ruta.ubicacionActual ? "C" : "G"}</b> {origenEtiqueta} · Los números coinciden con las tarjetas.</p>
        <span className="f-body text-[10px] shrink-0" style={{ color: c.textFaint }}>OSM / OSRM</span>
      </div>
    </section>
  );
}

function SeguimientoRepartosAdmin({ rutas }) {
  const c = useTheme();
  const [camionId, setCamionId] = useState(null);
  useEffect(() => {
    if (!rutas.length) return setCamionId(null);
    if (!rutas.some((ruta) => ruta.camion.id === camionId)) setCamionId(rutas[0].camion.id);
  }, [rutas, camionId]);
  if (!rutas.length) return null;
  const seleccionada = rutas.find((ruta) => ruta.camion.id === camionId) || rutas[0];
  const proximaMinutos = seleccionada.proximaParada?.duracionSegundos != null ? Math.max(1, Math.round(seleccionada.proximaParada.duracionSegundos / 60)) : null;
  const proximaKm = seleccionada.proximaParada?.distanciaMetros != null ? (seleccionada.proximaParada.distanciaMetros / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 }) : null;
  const recorridoKm = seleccionada.distanciaMetros != null ? (seleccionada.distanciaMetros / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 }) : null;
  const recorridoMinutos = seleccionada.duracionSegundos != null ? Math.max(1, Math.round(seleccionada.duracionSegundos / 60)) : null;
  return (
    <section className="rounded-3xl overflow-hidden shadow-sm" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
      <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ borderBottom: `1px solid ${c.borderSoft}` }}>
        <div>
          <p className="f-display text-base font-semibold flex items-center gap-2" style={{ color: c.text }}><Radio size={17} color={c.accent} /> Seguimiento de repartos</p>
          <p className="f-body text-[11px] mt-1" style={{ color: c.textFaint }}>Ubicación actual, próxima entrega y recorrido pendiente en tiempo real.</p>
        </div>
        <span className="f-body self-start sm:self-auto inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-semibold" style={{ background: rutas.some(ruta => ruta.ubicacionActual) ? c.successSoft : c.surfaceAlt, color: rutas.some(ruta => ruta.ubicacionActual) ? c.success : c.textMuted }}>
          <span className="w-2 h-2 rounded-full" style={{ background: rutas.some(ruta => ruta.ubicacionActual) ? c.success : c.textFaint }} />
          {rutas.some(ruta => ruta.ubicacionActual) ? "REPARTOS EN VIVO" : "ESPERANDO UBICACIÓN"}
        </span>
      </div>
      <div className="grid lg:grid-cols-[310px_minmax(0,1fr)]">
        <aside className="p-4 lg:p-5 space-y-4" style={{ background: c.surfaceAlt, borderRight: `1px solid ${c.borderSoft}` }}>
          <div>
            <p className="f-body text-[10px] font-semibold uppercase tracking-[0.12em] mb-2" style={{ color: c.textFaint }}>Repartos de hoy</p>
            <div className="space-y-2">
              {rutas.map((ruta) => {
                const activa = ruta.camion.id === seleccionada.camion.id;
                return <button key={ruta.camion.id} onClick={() => setCamionId(ruta.camion.id)} className="w-full rounded-2xl p-3 text-left flex items-center gap-3 transition-colors" style={{ background: activa ? c.surface : "transparent", border: `1px solid ${activa ? ruta.camion.color : c.borderSoft}`, boxShadow: activa ? "0 8px 24px rgba(15,23,42,.06)" : "none" }}>
                  <span className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center" style={{ background: `${ruta.camion.color}20` }}><Truck size={18} color={ruta.camion.color} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="f-display text-sm font-semibold block truncate" style={{ color: c.text }}>{ruta.camion.nombre}</span>
                    <span className="f-body text-[10px] mt-0.5 flex items-center gap-1.5" style={{ color: ruta.ubicacionActual ? c.success : c.textFaint }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: ruta.ubicacionActual ? c.success : c.textFaint }} />{ruta.ubicacionActual ? "En reparto" : "Sin iniciar"} · {ruta.paradas?.length || 0} parada{ruta.paradas?.length === 1 ? "" : "s"}</span>
                  </span>
                  <ChevronRight size={15} color={activa ? ruta.camion.color : c.textFaint} />
                </button>;
              })}
            </div>
          </div>

          <div className="rounded-2xl p-3.5" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center" style={{ background: c.accentSoft }}><LocateFixed size={17} color={c.accent} /></span>
              <div className="min-w-0">
                <p className="f-body text-[10px] uppercase tracking-wide" style={{ color: c.textFaint }}>Ubicación actual</p>
                <p className="f-display text-sm font-semibold mt-1" style={{ color: c.text }}>{seleccionada.ubicacionActual ? "Señal GPS activa" : "En el galpón"}</p>
                <p className="f-body text-[10px] mt-1" style={{ color: seleccionada.ubicacionActual ? c.success : c.textMuted }}>{seleccionada.ubicacionActual ? "Actualizando el recorrido automáticamente" : "El chofer todavía no activó su ubicación"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl p-3.5" style={{ background: seleccionada.proximaParada ? c.accentSoft : c.surface, border: `1px solid ${seleccionada.proximaParada ? c.accent + "44" : c.border}` }}>
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center" style={{ background: seleccionada.proximaParada ? c.accent : c.surfaceAlt }}><Navigation size={17} color={seleccionada.proximaParada ? c.bgAlt : c.textFaint} /></span>
              <div className="min-w-0">
                <p className="f-body text-[10px] uppercase tracking-wide" style={{ color: c.textFaint }}>Próxima parada</p>
                <p className="f-display text-sm font-semibold mt-1 truncate" style={{ color: c.text }}>{seleccionada.proximaParada?.cliente || "Sin entregas pendientes"}</p>
                {seleccionada.proximaParada && <><p className="f-body text-[11px] mt-1 leading-snug" style={{ color: c.textMuted }}>{seleccionada.proximaParada.direccion}</p><p className="f-body text-[10px] mt-2 font-medium" style={{ color: c.accent }}>{proximaMinutos ? `A ${proximaMinutos} min` : "Tiempo por calcular"}{proximaKm ? ` · ${proximaKm} km` : ""}</p></>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl p-3" style={{ background: c.surface }}><p className="f-body text-[9px] uppercase tracking-wide" style={{ color: c.textFaint }}>Recorrido</p><p className="f-mono text-sm mt-1" style={{ color: c.text }}>{recorridoKm ? `${recorridoKm} km` : "—"}</p></div>
            <div className="rounded-xl p-3" style={{ background: c.surface }}><p className="f-body text-[9px] uppercase tracking-wide" style={{ color: c.textFaint }}>Tiempo aprox.</p><p className="f-mono text-sm mt-1" style={{ color: c.text }}>{recorridoMinutos ? `${recorridoMinutos} min` : "—"}</p></div>
          </div>
        </aside>
        <div className="p-3 lg:p-4 min-w-0" style={{ background: c.bg }}>
          {!seleccionada.ubicacionActual && <p className="f-body mb-3 rounded-xl px-3 py-2 text-[11px]" style={{ background: c.amberSoft, color: c.amber }}>El recorrido parte desde el galpón hasta que el chofer active su ubicación.</p>}
          <MapaRutaChofer ruta={seleccionada} modoPanel />
        </div>
      </div>
    </section>
  );
}

function ChoferPanel({ session, onLogout }) {
  const c = useTheme();
  const [dia, setDia] = useState("hoy");
  const [dias, setDias] = useState(() => crearDias());
  const [pedidos, setPedidos] = useState([]);
  const [carga, setCarga] = useState(null);
  const [ruta, setRuta] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [actualizando, setActualizando] = useState(false);
  const [confirmandoPago, setConfirmandoPago] = useState(null);
  const [metodoCobro, setMetodoCobro] = useState("");
  const [comprobanteCobro, setComprobanteCobro] = useState(null);
  const [guardandoCobro, setGuardandoCobro] = useState(false);
  const [compartiendoUbicacion, setCompartiendoUbicacion] = useState(false);
  const [mensajeUbicacion, setMensajeUbicacion] = useState("Activala para que administración vea el camión y recalcular la próxima parada.");
  const seguimientoUbicacionRef = useRef(null);
  const ultimoEnvioUbicacionRef = useRef(0);
  const camionColor = colorDeCamion(session.camionId);
  const diaEditable = dia !== "manana";

  const cargar = useCallback(async (mostrarSpinner) => {
    if (mostrarSpinner) setCargando(true);
    try {
      const [pedidosDia, cargaDia, rutaDia] = await Promise.all([
        api(`/chofer/pedidos?dia=${dia}`, { token: session.token }),
        api(`/chofer/carga?dia=${dia}`, { token: session.token }),
        api(`/chofer/ruta?dia=${dia}`, { token: session.token, silencioso: true }).catch(() => null),
      ]);
      setPedidos(pedidosDia); setCarga(cargaDia);
      setRuta(anterior => JSON.stringify(anterior) === JSON.stringify(rutaDia) ? anterior : rutaDia);
      setError("");
    }
    catch (e) { setError("No pudimos cargar tu ruta."); }
    if (mostrarSpinner) setCargando(false);
  }, [dia, session.token]);

  useEffect(() => { cargar(true); }, [cargar]);
  useEffect(() => { const t = setInterval(() => cargar(false), 8000); return () => clearInterval(t); }, [cargar]);
  useEffect(() => {
    const socket = io(API_BASE, { auth: { token: session.token }, transports: ["websocket", "polling"] });
    const recargarRuta = () => cargar(false);
    socket.on("pedido:nuevo", recargarRuta);
    socket.on("pedido:actualizado", recargarRuta);
    socket.on("pedido:removido", recargarRuta);
    return () => socket.disconnect();
  }, [cargar, session.token]);
  useEffect(() => {
    const recargarAlVolver = () => {
      if (document.visibilityState === "visible") cargar(false);
    };
    window.addEventListener("focus", recargarAlVolver);
    window.addEventListener("online", recargarAlVolver);
    document.addEventListener("visibilitychange", recargarAlVolver);
    return () => {
      window.removeEventListener("focus", recargarAlVolver);
      window.removeEventListener("online", recargarAlVolver);
      document.removeEventListener("visibilitychange", recargarAlVolver);
    };
  }, [cargar]);
  useEffect(() => {
    const actualizarFechas = () => setDias(crearDias());
    const t = setInterval(actualizarFechas, 60000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => () => {
    if (seguimientoUbicacionRef.current != null && navigator.geolocation) navigator.geolocation.clearWatch(seguimientoUbicacionRef.current);
  }, []);

  const activarUbicacion = () => {
    if (!navigator.geolocation) return setMensajeUbicacion("Este dispositivo no permite compartir ubicación.");
    if (seguimientoUbicacionRef.current != null) return;
    setMensajeUbicacion("Buscando señal GPS...");
    seguimientoUbicacionRef.current = navigator.geolocation.watchPosition(async (posicion) => {
      setCompartiendoUbicacion(true);
      const ahora = Date.now();
      if (ahora - ultimoEnvioUbicacionRef.current < 7000) return;
      ultimoEnvioUbicacionRef.current = ahora;
      try {
        await api("/chofer/ubicacion", {
          method: "PUT",
          token: session.token,
          body: { latitud: posicion.coords.latitude, longitud: posicion.coords.longitude, precisionMetros: posicion.coords.accuracy },
        });
        setMensajeUbicacion(`En vivo · precisión aproximada ${Math.round(posicion.coords.accuracy)} m`);
      } catch (e) { setMensajeUbicacion("No pudimos enviar la ubicación. Revisá la conexión."); }
    }, (errorGeolocalizacion) => {
      setCompartiendoUbicacion(false);
      seguimientoUbicacionRef.current = null;
      setMensajeUbicacion(errorGeolocalizacion.code === 1 ? "Permiso de ubicación rechazado. Podés habilitarlo desde el navegador." : "No pudimos obtener la ubicación del dispositivo.");
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
  };

  const detenerUbicacion = async () => {
    if (seguimientoUbicacionRef.current != null) navigator.geolocation.clearWatch(seguimientoUbicacionRef.current);
    seguimientoUbicacionRef.current = null;
    setCompartiendoUbicacion(false);
    setMensajeUbicacion("Ubicación pausada.");
    await api("/chofer/ubicacion", { method: "DELETE", token: session.token }).catch(() => {});
    await cargar(false);
  };

  const hoyPend = dia === "hoy" ? pedidos.filter(o => o.estado === "pendiente").length : null;
  const hoyEnt = dia === "hoy" ? pedidos.filter(o => o.estado === "entregado").length : null;

  const marcar = async (id, estado, pagoConfirmado) => {
    cerrarCobro();
    setPedidos(prev => prev.map(o => o.id === id ? { ...o, estado, pagoConfirmado: pagoConfirmado || null } : o)); // optimista
    try { await api(`/chofer/pedidos/${id}/estado`, { method: "PATCH", token: session.token, body: { estado, pagoConfirmado } }); }
    catch (e) { setError(e.message || "No pudimos actualizar el pedido."); cargar(false); } // si falla, recargo de verdad
  };

  function cerrarCobro() {
    setConfirmandoPago(null);
    setMetodoCobro("");
    setComprobanteCobro(null);
  }

  const abrirCobro = (pedido) => {
    setConfirmandoPago(pedido.id);
    setMetodoCobro(pedido.pagoConfirmado || "");
    setComprobanteCobro(null);
  };

  const tieneComprobanteVigente = (pedido, metodo) => pedido.tieneComprobante
    && pedido.comprobanteTipo === metodo
    && (metodo !== "Transferencia" || !pedido.requiereComprobanteTransferencia);

  const registrarCobro = async (pedido) => {
    if (!metodoCobro) return mostrarErrorGlobal("Elegí Efectivo, Transferencia o Remito.");
    if (metodoCobro === "Transferencia" && !comprobanteCobro && !tieneComprobanteVigente(pedido, "Transferencia")) {
      return mostrarErrorGlobal(pedido.tieneComprobante && pedido.comprobanteTipo === "Transferencia"
        ? "Como modificaste los productos, subí el comprobante actualizado de la transferencia."
        : "Para confirmar una transferencia, subí el comprobante.");
    }
    setGuardandoCobro(true);
    try {
      const form = new FormData();
      form.append("pagoConfirmado", metodoCobro);
      if (["Transferencia", "Remito"].includes(metodoCobro) && comprobanteCobro) form.append("comprobante", comprobanteCobro);
      const actualizado = await api(`/chofer/pedidos/${pedido.id}/cobro`, { method: "PATCH", token: session.token, body: form });
      setPedidos(prev => prev.map(o => o.id === pedido.id ? { ...o, ...actualizado } : o));
      cerrarCobro();
    } catch (e) {
      setError(e.message || "No pudimos registrar el cobro.");
      await cargar(false);
    } finally { setGuardandoCobro(false); }
  };

  const actualizarRuta = async () => {
    setActualizando(true);
    await cargar(false);
    setActualizando(false);
  };

  return (
    <div className="flex-1" style={{ background: c.bg }}>
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5">
          <BrandLogo variant="word" className="h-8 w-auto max-w-[150px]" />
          <div className="flex items-center gap-2">
            <button onClick={actualizarRuta} disabled={actualizando} aria-label="Actualizar ruta" title="Actualizar ruta" className="f-body flex items-center justify-center w-9 h-9 rounded-lg disabled:opacity-60" style={{ background: c.surface, color: c.accent }}><RefreshCw size={14} className={actualizando ? "animate-spin" : ""} /></button>
            <button onClick={onLogout} className="f-body flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs" style={{ background: c.surface, color: c.textMuted }}><LogOut size={14} /> Salir</button>
          </div>
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
            <button key={k} onClick={() => { setDia(k); cerrarCobro(); }} className="f-body flex-1 py-2 rounded-lg text-xs" style={{ background: dia === k ? c.accentSoft : "transparent", color: dia === k ? c.accent : c.textMuted, fontWeight: dia === k ? 600 : 400 }}>{v.label}<span className="block text-[10px] opacity-70">{v.fecha}</span></button>
          ))}
        </div>

        <div className="mb-4"><ResumenCarga carga={carga} /></div>

        <div className="rounded-2xl p-3.5 mb-4 flex items-center gap-3" style={{ background: compartiendoUbicacion ? c.successSoft : c.surface, border: `1px solid ${compartiendoUbicacion ? c.success : c.border}` }}>
          <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center" style={{ background: compartiendoUbicacion ? c.success : c.accentSoft }}><Radio size={16} color={compartiendoUbicacion ? c.bgAlt : c.accent} /></div>
          <div className="min-w-0 flex-1"><p className="f-display text-sm font-semibold" style={{ color: c.text }}>Ubicación en vivo</p><p className="f-body text-[10px] mt-0.5" style={{ color: compartiendoUbicacion ? c.success : c.textFaint }}>{mensajeUbicacion}</p></div>
          <button onClick={compartiendoUbicacion ? detenerUbicacion : activarUbicacion} className="f-body shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-medium" style={{ background: compartiendoUbicacion ? c.surface : c.accent, color: compartiendoUbicacion ? c.danger : c.bgAlt }}><LocateFixed size={12} /> {compartiendoUbicacion ? "Pausar" : "Activar"}</button>
        </div>

        {dia === "ayer" && pedidos.some(o => o.estado === "pendiente") && (
          <p className="f-body text-[11px] mb-3 px-3 py-2 rounded-lg" style={{ background: c.amberSoft, color: c.amber }}>Los pendientes de ayer todavía se pueden completar.</p>
        )}

        <ErrorBanner mensaje={error} />
        {cargando ? <Cargando /> : (
          <>
            <p className="f-body text-[11px] mb-3 flex flex-wrap items-center gap-1.5" style={{ color: c.textFaint }}><MapPin size={11} /> Ruta optimizada por calles {ruta?.ubicacionActual ? "desde tu ubicación actual" : "desde el galpón"} · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap/OSRM</a></p>
            <MapaRutaChofer ruta={ruta} />
            <div className="space-y-2.5 mt-4">
              {pedidos.map((o) => (
                <div key={o.id} className="rounded-2xl p-4" style={{ background: c.surface, border: `1px solid ${c.border}`, opacity: dia === "manana" ? 0.75 : 1 }}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-start gap-2.5">
                      <span className="f-mono text-[11px] font-medium shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5" style={{ background: `${camionColor}22`, color: camionColor }}>{o.parada}</span>
                      <div><p className="f-body text-sm font-medium" style={{ color: c.text }}>{o.cliente}</p><p className="f-body text-xs flex items-center gap-1 mt-0.5" style={{ color: c.textFaint }}><MapPin size={11} /> {o.direccion}{o.detalleDireccion ? ` · ${o.detalleDireccion}` : ""}</p>{o.horaDesde && <p className="f-body text-[11px] flex items-center gap-1 mt-1" style={{ color: c.accent }}><Clock size={11} /> {formatearFranja(o.horaDesde, o.horaHasta)}</p>}</div>
                    </div>
                    <EstadoBadge estado={o.estado} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    {(o.productos || []).map(p => <span key={p} className="f-body text-[11px] px-2 py-0.5 rounded-full" style={{ background: c.surfaceAlt, color: c.textMuted }}>{p}</span>)}
                    <span className="f-body text-[11px] px-2 py-0.5 rounded-full" style={{ background: c.surfaceAlt, color: c.textMuted }}>Declaró: {o.pago}</span>
                    {o.pago === "Transferencia" && <span className="f-body text-[11px] px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: tieneComprobanteVigente(o, "Transferencia") ? c.successSoft : c.amberSoft, color: tieneComprobanteVigente(o, "Transferencia") ? c.success : c.amber }}>{tieneComprobanteVigente(o, "Transferencia") ? <CheckCircle2 size={11} /> : <FileCheck2 size={11} />}{tieneComprobanteVigente(o, "Transferencia") ? "Transferencia comprobada" : (o.tieneComprobante && o.comprobanteTipo === "Transferencia" ? "Falta comprobante actualizado" : "Transferencia sin comprobar")}</span>}
                    {o.total != null && <span className="f-mono text-[11px] px-2 py-0.5 rounded-full ml-auto font-medium" style={{ background: c.accentSoft, color: c.accent }}>${Number(o.total).toLocaleString("es-AR")}</span>}
                  </div>
                  {o.estado === "entregado" && (
                    <p className="f-body text-[11px] mb-2 flex items-center gap-1" style={{ color: o.pagoConfirmado ? c.success : c.amber }}>{o.pagoConfirmado === "Remito" ? <FileCheck2 size={11} /> : <DollarSign size={11} />} {o.pagoConfirmado ? (o.pagoConfirmado === "Remito" ? "Entrega con remito registrada" : `Cobrado con: ${o.pagoConfirmado}`) : "Pago pendiente"}{o.tieneComprobante ? " · comprobante adjunto" : ""}</p>
                  )}
                  {o.notas && <p className="f-body text-[11px] mb-2 px-2.5 py-2 rounded-lg" style={{ background: c.amberSoft, color: c.text }}><b>Nota del cliente:</b> {o.notas}</p>}
                  {o.notaAdmin && <p className="f-body text-[11px] mb-3 px-2.5 py-2 rounded-lg" style={{ background: c.accentSoft, color: c.text }}><b>Indicación de administración:</b> {o.notaAdmin}</p>}
                  <CantidadesEntregadasEditor pedido={o} token={session.token} habilitado={diaEditable && o.estado !== "no_atendido"} onGuardado={actualizado => setPedidos(prev => prev.map(item => item.id === o.id ? { ...item, ...actualizado } : item))} />
                  <NotaCamionEditor pedidoId={o.id} valor={o.notaCamion} token={session.token} onGuardada={notaCamion => setPedidos(prev => prev.map(item => item.id === o.id ? { ...item, notaCamion } : item))} />

                  {diaEditable && o.estado === "pendiente" && confirmandoPago !== o.id && (
                    <div className="flex gap-2">
                      <button onClick={() => abrirCobro(o)} className="f-body flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1" style={{ background: c.successSoft, color: c.success }}><CheckCircle2 size={13} /> Entregado</button>
                      <button onClick={() => marcar(o.id, "no_atendido")} className="f-body flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1" style={{ background: c.dangerSoft, color: c.danger }}><XCircle size={13} /> No había nadie</button>
                    </div>
                  )}
                  {diaEditable && confirmandoPago === o.id && (
                    <div className="rounded-xl p-2.5" style={{ background: c.accentSoft }}>
                      <p className="f-body text-[11px] mb-2 font-medium" style={{ color: c.text }}>{metodoCobro === "Remito" ? (o.estado === "pendiente" ? "Entrega con remito" : "Registrar o actualizar remito") : (o.estado === "pendiente" ? "Entrega y cobro" : "Registrar o actualizar cobro")}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {COBROS_CHOFER.map(p => <button key={p} onClick={() => { setMetodoCobro(p); if (p === "Efectivo") setComprobanteCobro(null); }} className="f-body text-xs px-2.5 py-1.5 rounded-lg font-medium" style={{ background: metodoCobro === p ? c.accent : c.surface, color: metodoCobro === p ? c.bgAlt : c.accent, border: `1px solid ${c.accent}` }}>{p}</button>)}
                      </div>
                      {["Transferencia", "Remito"].includes(metodoCobro) && <label className="f-body mt-2 flex items-center justify-center gap-2 w-full px-2.5 py-2 rounded-lg text-[11px] font-medium cursor-pointer" style={{ background: c.surface, border: `1px dashed ${comprobanteCobro || tieneComprobanteVigente(o, metodoCobro) ? c.success : c.accent}`, color: comprobanteCobro || tieneComprobanteVigente(o, metodoCobro) ? c.success : c.accent }}><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => setComprobanteCobro(e.target.files?.[0] || null)} />{comprobanteCobro || tieneComprobanteVigente(o, metodoCobro) ? <FileCheck2 size={13} /> : <Upload size={13} />}<span className="truncate">{comprobanteCobro ? comprobanteCobro.name : (tieneComprobanteVigente(o, metodoCobro) ? `Comprobante cargado · reemplazar ${metodoCobro.toLowerCase()}` : (metodoCobro === "Transferencia" ? `Subir comprobante de transferencia${o.tieneComprobante && o.comprobanteTipo === "Transferencia" ? " actualizado" : ""} (obligatorio)` : "Subir comprobante de remito (opcional)"))}</span></label>}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {metodoCobro && <button onClick={() => registrarCobro(o)} disabled={guardandoCobro || (metodoCobro === "Transferencia" && !comprobanteCobro && !tieneComprobanteVigente(o, "Transferencia"))} className="f-body text-xs px-2.5 py-1.5 rounded-lg font-medium inline-flex items-center gap-1 disabled:opacity-60" style={{ background: c.success, color: c.bgAlt }}>{guardandoCobro ? <Spinner size={11} /> : (metodoCobro === "Remito" ? <FileCheck2 size={11} /> : <DollarSign size={11} />)} {metodoCobro === "Remito" ? (o.estado === "pendiente" ? "Confirmar entrega con remito" : "Guardar remito") : (o.estado === "pendiente" ? "Confirmar entrega y cobro" : "Guardar cobro")}</button>}
                        <button onClick={cerrarCobro} disabled={guardandoCobro} className="f-body text-xs px-2.5 py-1.5 rounded-lg" style={{ color: c.textFaint }}>Cancelar</button>
                      </div>
                    </div>
                  )}
                  {diaEditable && o.estado === "entregado" && confirmandoPago !== o.id && <div className="flex flex-wrap items-center gap-3"><button onClick={() => abrirCobro(o)} className="f-body text-[11px] font-medium underline" style={{ color: o.pagoConfirmado ? c.textMuted : c.accent }}>{o.pagoConfirmado ? "Actualizar cobro o comprobante" : "Registrar cobro pendiente"}</button><button onClick={() => marcar(o.id, "pendiente")} className="f-body text-[11px] underline" style={{ color: c.textFaint }}>Revertir a pendiente</button></div>}
                  {diaEditable && o.estado === "no_atendido" && <button onClick={() => marcar(o.id, "pendiente")} className="f-body text-[11px] underline" style={{ color: c.textFaint }}>Revertir a pendiente</button>}
                  {dia === "manana" && <p className="f-body text-[11px]" style={{ color: c.textFaint }}>Programado — todavía no se puede marcar</p>}
                </div>
              ))}
              {pedidos.length === 0 && <p className="f-body text-xs text-center py-8" style={{ color: c.textFaint }}>Sin pedidos para este día.</p>}
            </div>
            <CajaChofer session={session} dia={dia} pedidos={pedidos} />
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
function AdminNuevoPedido({ token, onClose, onCreado }) {
  const c = useTheme();
  const [segmento, setSegmento] = useState("consumo_personal");
  const [productos, setProductos] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [cantidades, setCantidades] = useState({});
  const [disponibilidad, setDisponibilidad] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoDisponibilidad, setCargandoDisponibilidad] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({ nombre: "", telefono: "", calle: "", detalleDireccion: "", barrio: "", pago: "Efectivo", notas: "", fechaEntrega: "", horarioZonaId: "" });

  useEffect(() => {
    let vigente = true;
    Promise.all([api("/public/productos"), api("/public/zonas")])
      .then(([ps, zs]) => { if (vigente) { setProductos(ps); setZonas(zs); } })
      .catch(() => {})
      .finally(() => vigente && setCargando(false));
    return () => { vigente = false; };
  }, []);

  useEffect(() => {
    if (!form.barrio) { setDisponibilidad([]); return; }
    let vigente = true;
    setCargandoDisponibilidad(true);
    api(`/public/disponibilidad?barrio=${encodeURIComponent(form.barrio)}`)
      .then(data => { if (vigente) setDisponibilidad(data.disponibilidad || []); })
      .catch(() => { if (vigente) setDisponibilidad([]); })
      .finally(() => vigente && setCargandoDisponibilidad(false));
    return () => { vigente = false; };
  }, [form.barrio]);

  useEffect(() => {
    const cerrar = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, [onClose]);

  const productosVisibles = productos.filter(producto => producto.categoria === segmento);
  const fechaElegida = disponibilidad.find(item => item.fecha === form.fechaEntrega);
  const items = Object.entries(cantidades).filter(([, cantidad]) => cantidad > 0).map(([productoId, cantidad]) => ({ productoId: Number(productoId), cantidad }));
  const total = items.reduce((suma, item) => suma + Number(productos.find(producto => producto.id === item.productoId)?.precio || 0) * item.cantidad, 0);
  const cambiarCantidad = (id, delta) => setCantidades(actual => ({ ...actual, [id]: Math.max(0, Math.min(999, Number(actual[id] || 0) + delta)) }));

  const guardar = async () => {
    if (!form.nombre.trim() || !form.telefono.trim() || !form.calle.trim() || !form.barrio || !form.fechaEntrega || !form.horarioZonaId || !items.length) {
      return mostrarErrorGlobal("Completá los datos, elegí fecha, horario y al menos un producto.");
    }
    setGuardando(true);
    try {
      const creado = await api("/admin/pedidos", {
        method: "POST",
        token,
        body: {
          ...form,
          tipo: TIPO_DESTINO_POR_SEGMENTO[segmento] || "casa",
          segmento,
          horarioZonaId: Number(form.horarioZonaId),
          items,
        },
      });
      onCreado?.(creado);
      onClose();
    } finally { setGuardando(false); }
  };

  return (
    <div role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }} className="modal-backdrop-in fixed inset-0 flex items-center justify-center p-3 md:p-6" style={{ zIndex: 1002, background: "rgba(2, 8, 23, 0.76)", backdropFilter: "blur(6px)" }}>
      <section role="dialog" aria-modal="true" aria-labelledby="nuevo-pedido-titulo" className="modal-card-in w-full max-w-5xl max-h-[94vh] overflow-y-auto rounded-3xl shadow-2xl" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-5 md:px-7 py-5" style={{ background: c.surface, borderBottom: `1px solid ${c.borderSoft}` }}>
          <div><p className="f-body text-[11px] uppercase tracking-wider" style={{ color: c.accent }}>Carga desde administración</p><h2 id="nuevo-pedido-titulo" className="f-display text-xl font-semibold mt-1" style={{ color: c.text }}>Nuevo pedido</h2></div>
          <button onClick={onClose} className="p-2.5 rounded-xl" style={{ background: c.surfaceAlt }} aria-label="Cerrar"><X size={18} color={c.textMuted} /></button>
        </div>
        {cargando ? <Cargando label="Preparando el formulario..." /> : (
          <div className="p-5 md:p-7 grid lg:grid-cols-[1fr_.9fr] gap-6">
            <div className="space-y-4">
              <div>
                <p className="f-body text-xs font-medium mb-2" style={{ color: c.text }}>1. Datos del cliente</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  <Input autoComplete="name" placeholder="Nombre y apellido" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
                  <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="Teléfono" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
                  <Input autoComplete="street-address" placeholder="Calle y altura" value={form.calle} onChange={e => setForm({ ...form, calle: e.target.value })} />
                  <Input autoComplete="address-line2" placeholder="Piso / Departamento / Condominio (opcional)" maxLength={120} value={form.detalleDireccion} onChange={e => setForm({ ...form, detalleDireccion: e.target.value })} />
                  <select value={form.barrio} onChange={e => setForm({ ...form, barrio: e.target.value, fechaEntrega: "", horarioZonaId: "" })} className="f-body w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: form.barrio ? c.text : c.textFaint }}><option value="">Barrio / localidad</option>{zonas.map(zona => <option key={zona.barrio} value={zona.barrio}>{zona.barrio} · {zona.camionNombre}</option>)}</select>
                </div>
              </div>

              <div>
                <p className="f-body text-xs font-medium mb-2" style={{ color: c.text }}>2. Catálogo y productos</p>
                <div className="flex flex-wrap gap-1.5 mb-3">{OPCIONES_SEGMENTO.map(op => <button key={op.categoria} onClick={() => { setSegmento(op.categoria); setCantidades({}); }} className="f-body px-3 py-2 rounded-xl text-xs font-medium" style={{ background: segmento === op.categoria ? c.accentSoft : c.surfaceAlt, border: `1px solid ${segmento === op.categoria ? c.accent : c.border}`, color: segmento === op.categoria ? c.accent : c.textMuted }}>{op.label}</button>)}</div>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {productosVisibles.map(producto => (
                    <div key={producto.id} className="flex items-center gap-3 rounded-xl p-3" style={{ background: c.surfaceAlt, border: `1px solid ${c.borderSoft}` }}>
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center shrink-0" style={{ background: c.accentSoft }}>{producto.imagenUrl ? <img src={producto.imagenUrl} alt="" className="w-full h-full object-cover" /> : <Package size={15} color={c.accent} />}</div>
                      <div className="flex-1 min-w-0"><p className="f-body text-sm font-medium" style={{ color: c.text }}>{producto.nombre}</p><p className="f-mono text-[11px]" style={{ color: c.accent }}>${Number(producto.precio).toLocaleString("es-AR")}</p></div>
                      <button onClick={() => cambiarCantidad(producto.id, -1)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: c.surface }}><Minus size={13} color={c.textMuted} /></button>
                      <input type="number" min="0" max="999" value={cantidades[producto.id] || 0} onChange={e => setCantidades(actual => ({ ...actual, [producto.id]: Math.max(0, Math.min(999, Number(e.target.value) || 0)) }))} className="f-mono w-14 text-center text-xs px-1 py-2 rounded-lg outline-none" style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.text }} />
                      <button onClick={() => cambiarCantidad(producto.id, 1)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: c.accentSoft }}><Plus size={13} color={c.accent} /></button>
                    </div>
                  ))}
                  {!productosVisibles.length && <p className="f-body text-xs py-4 text-center" style={{ color: c.textFaint }}>No hay productos activos en este catálogo.</p>}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="f-body text-xs font-medium mb-2" style={{ color: c.text }}>3. Entrega</p>
                {!form.barrio ? <p className="f-body text-xs rounded-xl p-3" style={{ background: c.surfaceAlt, color: c.textFaint }}>Elegí el barrio para ver sus días habilitados.</p> : cargandoDisponibilidad ? <Cargando label="Buscando fechas..." /> : disponibilidad.length ? (
                  <div className="space-y-3">
                    <div className="flex gap-2 overflow-x-auto pb-1">{disponibilidad.slice(0, 12).map(dia => <button key={dia.fecha} onClick={() => setForm({ ...form, fechaEntrega: dia.fecha, horarioZonaId: "" })} className="f-body shrink-0 px-3 py-2 rounded-xl text-xs" style={{ background: form.fechaEntrega === dia.fecha ? c.accentSoft : c.surfaceAlt, border: `1px solid ${form.fechaEntrega === dia.fecha ? c.accent : c.border}`, color: form.fechaEntrega === dia.fecha ? c.accent : c.textMuted }}>{new Date(`${dia.fecha}T00:00:00Z`).toLocaleDateString("es-AR", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" })}</button>)}</div>
                    {fechaElegida && <div className="flex flex-wrap gap-2">{fechaElegida.horarios.map(horario => <button key={horario.id} onClick={() => setForm({ ...form, horarioZonaId: horario.id })} className="f-body px-3 py-2 rounded-xl text-xs" style={{ background: Number(form.horarioZonaId) === horario.id ? c.accentSoft : c.surfaceAlt, border: `1px solid ${Number(form.horarioZonaId) === horario.id ? c.accent : c.border}`, color: Number(form.horarioZonaId) === horario.id ? c.accent : c.textMuted }}>{formatearFranja(horario.horaDesde, horario.horaHasta)}</button>)}</div>}
                  </div>
                ) : <p className="f-body text-xs rounded-xl p-3" style={{ background: c.amberSoft, color: c.amber }}>Este barrio no tiene fechas disponibles.</p>}
              </div>

              <div><p className="f-body text-xs font-medium mb-2" style={{ color: c.text }}>4. Pago y observaciones</p><div className="flex gap-2 mb-3">{PAGOS.map(pago => <button key={pago} onClick={() => setForm({ ...form, pago })} className="f-body px-3 py-2 rounded-xl text-xs" style={{ background: form.pago === pago ? c.accentSoft : c.surfaceAlt, border: `1px solid ${form.pago === pago ? c.accent : c.border}`, color: form.pago === pago ? c.accent : c.textMuted }}>{pago}</button>)}</div><textarea value={form.notas} maxLength={500} onChange={e => setForm({ ...form, notas: e.target.value })} rows={3} placeholder="Notas para el chofer (opcional)" className="f-body w-full px-3.5 py-2.5 rounded-xl text-sm outline-none resize-y" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.text }} /></div>

              <div className="rounded-2xl p-4" style={{ background: c.accentSoft, border: `1px solid ${c.accent}33` }}><div className="flex justify-between gap-3"><span className="f-body text-sm" style={{ color: c.text }}>Total del pedido</span><span className="f-mono text-xl font-semibold" style={{ color: c.accent }}>${total.toLocaleString("es-AR")}</span></div><p className="f-body text-[11px] mt-1" style={{ color: c.textFaint }}>{items.reduce((suma, item) => suma + item.cantidad, 0)} unidad{items.reduce((suma, item) => suma + item.cantidad, 0) !== 1 ? "es" : ""}</p></div>
              <button onClick={guardar} disabled={guardando} className="f-body w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: c.accent, color: c.bgAlt }}>{guardando ? <Spinner size={14} /> : <Plus size={15} />} Crear pedido y enviarlo al chofer</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function AdminPedidos({ token, camiones }) {
  const c = useTheme();
  const [q, setQ] = useState(""); const [fCamion, setFCamion] = useState("todos"); const [fEstado, setFEstado] = useState("todos"); const [fDia, setFDia] = useState("hoy");
  const [desde, setDesde] = useState(""); const [hasta, setHasta] = useState("");
  const [grupos, setGrupos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [comprobanteUrl, setComprobanteUrl] = useState("");
  const [abriendoComprobante, setAbriendoComprobante] = useState(null);
  const [detalleId, setDetalleId] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [fechaManual, setFechaManual] = useState("");
  const [notaAdmin, setNotaAdmin] = useState("");
  const [guardandoDetalle, setGuardandoDetalle] = useState(false);
  const [eliminandoDetalle, setEliminandoDetalle] = useState(false);
  const [okDetalle, setOkDetalle] = useState("");
  const [nuevoPedidoAbierto, setNuevoPedidoAbierto] = useState(false);
  const [catalogo, setCatalogo] = useState([]);
  const [itemsEdit, setItemsEdit] = useState([]);
  const [notasEdit, setNotasEdit] = useState("");
  const [cargasPedidos, setCargasPedidos] = useState([]);
  const [rutasVivo, setRutasVivo] = useState([]);
  const fechaCarga = desde && hasta && desde === hasta
    ? desde
    : (!desde && !hasta && ["ayer", "hoy", "manana"].includes(fDia) ? fDia : null);

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
      const [gruposNuevos, cargasNuevas, rutasNuevas] = await Promise.all([
        api(`/admin/pedidos?${params.toString()}`, { token }),
        fechaCarga ? api(`/admin/cargas?fecha=${fechaCarga}`, { token }) : Promise.resolve({ cargas: [] }),
        fechaCarga ? api(`/admin/rutas?dia=${fechaCarga}`, { token, silencioso: true }).catch(() => ({ rutas: [] })) : Promise.resolve({ rutas: [] }),
      ]);
      setGrupos(gruposNuevos);
      setCargasPedidos(cargasNuevas.cargas || []);
      setRutasVivo(anterior => JSON.stringify(anterior) === JSON.stringify(rutasNuevas.rutas || []) ? anterior : (rutasNuevas.rutas || []));
      setError("");
    } catch (e) { setError("No pudimos cargar los pedidos."); }
    if (mostrarSpinner) setCargando(false);
  }, [token, fDia, fCamion, fEstado, q, desde, hasta, fechaCarga]);

  useEffect(() => { cargar(true); }, [cargar]);
  useEffect(() => { api("/admin/productos", { token }).then(setCatalogo).catch(() => {}); }, [token]);
  useEffect(() => { const t = setInterval(() => cargar(false), 10000); return () => clearInterval(t); }, [cargar]);
  useEffect(() => {
    const socket = io(API_BASE, { auth: { token }, transports: ["websocket", "polling"] });
    socket.on("ubicacion:actualizada", () => cargar(false));
    socket.on("pedido:actualizado", () => cargar(false));
    return () => socket.disconnect();
  }, [cargar, token]);

  const cerrarDetalle = useCallback(() => {
    setDetalleId(null);
    setDetalle(null);
    setOkDetalle("");
  }, []);

  useEffect(() => {
    if (!detalleId) return;
    const cerrarConEscape = (evento) => { if (evento.key === "Escape") cerrarDetalle(); };
    window.addEventListener("keydown", cerrarConEscape);
    return () => window.removeEventListener("keydown", cerrarConEscape);
  }, [detalleId, cerrarDetalle]);

  const abrirDetalle = async (id) => {
    setDetalleId(id);
    setDetalle(null);
    setOkDetalle("");
    setCargandoDetalle(true);
    try {
      const data = await api(`/admin/pedidos/${id}`, { token });
      setDetalle(data);
      setFechaManual(String(data.fechaEntrega || "").slice(0, 10));
      setNotaAdmin(data.notaAdmin || "");
      setNotasEdit(data.notas || "");
      setItemsEdit(data.items.filter(item => item.productoId).map(item => ({ productoId: item.productoId, cantidad: item.cantidad })));
    } catch (e) {
      cerrarDetalle();
    } finally { setCargandoDetalle(false); }
  };

  const guardarCambioFecha = async () => {
    if (!detalle || !fechaManual) {
      mostrarErrorGlobal("Elegí la nueva fecha de entrega.");
      return;
    }
    setGuardandoDetalle(true);
    setOkDetalle("");
    try {
      const actualizado = await api(`/admin/pedidos/${detalle.id}/fecha`, {
        method: "PATCH",
        token,
        body: { fechaEntrega: fechaManual, notaAdmin },
      });
      setDetalle(actual => ({ ...actual, ...actualizado }));
      setNotaAdmin(actualizado.notaAdmin || "");
      setOkDetalle("Pedido movido al día indicado. El chofer ya recibió la actualización.");
      await cargar(false);
    } finally { setGuardandoDetalle(false); }
  };

  const reasignar = async (id, newCamionId) => {
    try { await api(`/admin/pedidos/${id}/camion`, { method: "PATCH", token, body: { camionId: Number(newCamionId) } }); cargar(false); }
    catch (e) { setError("No se pudo reasignar el pedido."); }
  };

  const cambiarCantidadAdmin = (productoId, delta) => {
    setItemsEdit(actual => {
      const existente = actual.find(item => item.productoId === productoId);
      const cantidad = Math.max(0, Math.min(999, (existente?.cantidad || 0) + delta));
      if (!cantidad) return actual.filter(item => item.productoId !== productoId);
      return existente ? actual.map(item => item.productoId === productoId ? { ...item, cantidad } : item) : [...actual, { productoId, cantidad }];
    });
    setOkDetalle("");
  };

  const guardarProductosPedido = async () => {
    if (!detalle || !itemsEdit.length) return mostrarErrorGlobal("El pedido debe conservar al menos un producto.");
    setGuardandoDetalle(true); setOkDetalle("");
    try {
      const actualizado = await api(`/admin/pedidos/${detalle.id}`, { method: "PATCH", token, body: { items: itemsEdit, notas: notasEdit, notaAdmin } });
      setDetalle(actualizado);
      setItemsEdit(actualizado.items.filter(item => item.productoId).map(item => ({ productoId: item.productoId, cantidad: item.cantidad })));
      setOkDetalle("Pedido actualizado. El chofer ya recibió las nuevas cantidades.");
      await cargar(false);
    } finally { setGuardandoDetalle(false); }
  };

  const eliminarPedido = async () => {
    if (!detalle) return;
    const ok = await confirmarAccion({ titulo: `Eliminar pedido #${detalle.id}`, mensaje: "Se borrarán el pedido, sus productos y el comprobante asociado. Esta acción no se puede deshacer.", textoConfirmar: "Eliminar pedido" });
    if (!ok) return;
    setEliminandoDetalle(true);
    try {
      await api(`/admin/pedidos/${detalle.id}`, { method: "DELETE", token });
      cerrarDetalle();
      await cargar(false);
    } finally { setEliminandoDetalle(false); }
  };

  return (
    <div className="space-y-4">
      {nuevoPedidoAbierto && <AdminNuevoPedido token={token} onClose={() => setNuevoPedidoAbierto(false)} onCreado={() => { setFDia("todos"); setDesde(""); setHasta(""); cargar(false); }} />}
      <ComprobanteModal url={comprobanteUrl} onClose={cerrarComprobante} />
      {detalleId && (
        <div role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) cerrarDetalle(); }} className="modal-backdrop-in fixed inset-0 flex items-center justify-center p-3 md:p-6" style={{ zIndex: 1001, background: "rgba(2, 8, 23, 0.76)", backdropFilter: "blur(6px)" }}>
          <section role="dialog" aria-modal="true" aria-labelledby="detalle-pedido-titulo" className="modal-card-in w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 px-5 md:px-7 py-5" style={{ background: c.surface, borderBottom: `1px solid ${c.borderSoft}` }}>
              <div>
                <p className="f-body text-[11px] uppercase tracking-wider" style={{ color: c.accent }}>Ficha completa</p>
                <h2 id="detalle-pedido-titulo" className="f-display text-xl md:text-2xl font-semibold mt-1" style={{ color: c.text }}>{detalle ? `Pedido #${detalle.id} · ${detalle.cliente}` : "Cargando pedido..."}</h2>
              </div>
              <div className="flex items-center gap-2">{detalle && <button onClick={eliminarPedido} disabled={eliminandoDetalle} className="f-body inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium disabled:opacity-60" style={{ background: c.dangerSoft, color: c.danger }}>{eliminandoDetalle ? <Spinner size={14} /> : <Trash2 size={14} />} Eliminar</button>}<button onClick={cerrarDetalle} className="p-2.5 rounded-xl shrink-0" style={{ background: c.surfaceAlt }} aria-label="Cerrar detalle"><X size={18} color={c.textMuted} /></button></div>
            </div>

            {cargandoDetalle || !detalle ? <Cargando label="Cargando todos los datos..." /> : (
              <div className="p-5 md:p-7 space-y-6">
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="rounded-2xl p-4" style={{ background: c.surfaceAlt }}><p className="f-body text-[11px] mb-1.5" style={{ color: c.textFaint }}>Cliente</p><p className="f-body text-sm font-semibold" style={{ color: c.text }}>{detalle.cliente}</p><p className="f-mono text-xs mt-1" style={{ color: c.textMuted }}>{detalle.telefono}</p></div>
                  <div className="rounded-2xl p-4" style={{ background: c.surfaceAlt }}><p className="f-body text-[11px] mb-1.5" style={{ color: c.textFaint }}>Entrega</p><p className="f-body text-sm font-semibold" style={{ color: c.text }}>{detalle.direccion}</p>{detalle.detalleDireccion && <p className="f-body text-xs mt-1" style={{ color: c.text }}>{detalle.detalleDireccion}</p>}<p className="f-body text-xs mt-1" style={{ color: c.textMuted }}>{detalle.barrio}</p></div>
                  <div className="rounded-2xl p-4" style={{ background: c.surfaceAlt }}><p className="f-body text-[11px] mb-1.5" style={{ color: c.textFaint }}>Camión y estado</p><div className="flex flex-wrap items-center gap-2"><CamionChip camion={detalle.camion} small /><EstadoBadge estado={detalle.estado} /></div></div>
                  <div className="rounded-2xl p-4" style={{ background: c.surfaceAlt }}><p className="f-body text-[11px] mb-1.5" style={{ color: c.textFaint }}>Pago y total</p><p className="f-body text-sm" style={{ color: detalle.pagoConfirmado ? c.success : (detalle.estado === "entregado" ? c.amber : c.text) }}>{detalle.pagoConfirmado ? `${detalle.pagoConfirmado} confirmado` : (detalle.estado === "entregado" ? `Pago pendiente · declaró ${detalle.pago}` : `Declaró ${detalle.pago}`)}</p><p className="f-mono text-base font-semibold mt-1" style={{ color: c.accent }}>${Number(detalle.total || 0).toLocaleString("es-AR")}</p></div>
                </div>

                <div className="grid md:grid-cols-[1.1fr_.9fr] gap-4">
                  <div className="rounded-2xl p-4 md:p-5" style={{ border: `1px solid ${c.border}` }}>
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <h3 className="f-display text-base font-semibold" style={{ color: c.text }}>Productos</h3>
                      <span className="f-body text-xs" style={{ color: c.textFaint }}>{detalle.items.length} producto{detalle.items.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="space-y-2.5">
                      {detalle.items.map(item => (
                        <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 py-2" style={{ borderBottom: `1px solid ${c.borderSoft}` }}>
                          <div><p className="f-body text-sm" style={{ color: c.text }}>{item.cantidad}× {item.nombre}</p><p className="f-body text-[11px] mt-0.5" style={{ color: c.textFaint }}>${Number(item.precioUnitario).toLocaleString("es-AR")} c/u</p></div>
                          <span className="f-mono text-sm" style={{ color: c.textMuted }}>${Number(item.subtotal).toLocaleString("es-AR")}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between pt-3"><span className="f-body text-sm font-semibold" style={{ color: c.text }}>Total</span><span className="f-mono text-base font-semibold" style={{ color: c.accent }}>${Number(detalle.total || 0).toLocaleString("es-AR")}</span></div>
                    {detalle.estado !== "entregado" && detalle.items.every(item => item.productoId) && <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${c.borderSoft}` }}><p className="f-body text-xs font-medium mb-2" style={{ color: c.text }}>Modificar productos</p><div className="space-y-2">{catalogo.filter(producto => producto.categoria === detalle.segmento && (producto.activo || itemsEdit.some(item => item.productoId === producto.id))).map(producto => { const cantidad = itemsEdit.find(item => item.productoId === producto.id)?.cantidad || 0; return <div key={producto.id} className="flex items-center gap-2 rounded-xl p-2" style={{ background: c.surfaceAlt }}><span className="f-body text-xs flex-1" style={{ color: c.text }}>{producto.nombre}</span><button onClick={() => cambiarCantidadAdmin(producto.id, -1)} disabled={!cantidad} className="w-7 h-7 rounded-lg disabled:opacity-30" style={{ background: c.surface }}><Minus size={13} className="mx-auto" color={c.textMuted} /></button><span className="f-mono w-7 text-center text-xs" style={{ color: c.text }}>{cantidad}</span><button onClick={() => cambiarCantidadAdmin(producto.id, 1)} className="w-7 h-7 rounded-lg" style={{ background: c.accentSoft }}><Plus size={13} className="mx-auto" color={c.accent} /></button></div>; })}</div><label className="f-body block text-[11px] mt-3 mb-1.5" style={{ color: c.textMuted }}>Nota del cliente / WhatsApp</label><textarea value={notasEdit} maxLength={500} onChange={e => setNotasEdit(e.target.value)} rows={2} className="f-body w-full px-3 py-2 rounded-xl text-xs outline-none resize-y" style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.text }} /><button onClick={guardarProductosPedido} disabled={guardandoDetalle || !itemsEdit.length} className="f-body mt-3 w-full py-2.5 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: c.accent, color: c.bgAlt }}>{guardandoDetalle ? <Spinner size={13} /> : <Save size={13} />} Guardar cambios del pedido</button></div>}
                    {detalle.estado !== "entregado" && detalle.items.some(item => !item.productoId) && <p className="f-body mt-4 pt-4 text-xs" style={{ borderTop: `1px solid ${c.borderSoft}`, color: c.amber }}>Este pedido conserva un producto histórico eliminado del catálogo. Para proteger sus datos originales, no se puede modificar su composición.</p>}
                  </div>

                  <div className="rounded-2xl p-4 md:p-5 space-y-4" style={{ border: `1px solid ${c.border}` }}>
                    <h3 className="f-display text-base font-semibold" style={{ color: c.text }}>Datos del pedido</h3>
                    <div><p className="f-body text-[11px]" style={{ color: c.textFaint }}>Categoría</p><p className="f-body text-sm mt-1" style={{ color: c.text }}>{OPCIONES_SEGMENTO.find(x => x.categoria === detalle.segmento)?.label || detalle.segmento}</p></div>
                    <div><p className="f-body text-[11px]" style={{ color: c.textFaint }}>Horario aproximado</p><p className="f-body text-sm mt-1" style={{ color: c.text }}>{formatearFranja(detalle.horaDesde, detalle.horaHasta)}</p></div>
                    <div><p className="f-body text-[11px]" style={{ color: c.textFaint }}>Nota del cliente</p><p className="f-body text-sm mt-1 whitespace-pre-wrap" style={{ color: c.text }}>{detalle.notas || "Sin notas"}</p></div>
                    <div><p className="f-body text-[11px]" style={{ color: c.textFaint }}>Nota camión</p><p className="f-body text-sm mt-1 whitespace-pre-wrap" style={{ color: detalle.notaCamion ? c.text : c.textFaint }}>{detalle.notaCamion || "Sin nota del chofer"}</p></div>
                    {detalle.tieneComprobante && <button onClick={() => abrirComprobante(detalle.id)} disabled={abriendoComprobante === detalle.id} className="f-body w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium disabled:opacity-60" style={{ background: c.accentSoft, color: c.accent }}>{abriendoComprobante === detalle.id ? <Spinner size={13} /> : <Eye size={14} />} Ver comprobante</button>}
                  </div>
                </div>

                {["pendiente", "no_atendido"].includes(detalle.estado) ? <div className="rounded-2xl p-4 md:p-5" style={{ background: c.accentSoft, border: `1px solid ${c.border}` }}>
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
                    <div><h3 className="f-display text-base font-semibold flex items-center gap-2" style={{ color: c.text }}><CalendarClock size={17} color={c.accent} /> {detalle.estado === "no_atendido" ? "Reagendar pedido" : "Cambiar entrega manualmente"}</h3><p className="f-body text-xs mt-1" style={{ color: c.textMuted }}>{detalle.estado === "no_atendido" ? "Al guardarlo vuelve a Pendiente y aparece en la ruta del nuevo día." : "Al guardar, el pedido se mueve al día nuevo en administración y en la ruta del chofer."}</p></div>
                    <div className="md:text-right"><p className="f-body text-[11px]" style={{ color: c.textFaint }}>Entrega actual</p><p className="f-body text-sm font-semibold mt-1" style={{ color: c.accent }}>{formatearFechaEntrega(detalle.fechaEntrega)}</p>{detalle.fechaEntregaOriginal && <p className="f-body text-[11px] mt-1" style={{ color: c.textMuted }}>Solicitada originalmente: {formatearFechaEntrega(detalle.fechaEntregaOriginal)}</p>}</div>
                  </div>
                  <div className="grid md:grid-cols-[240px_1fr] gap-3">
                    <div><label className="f-body block text-xs mb-1.5" style={{ color: c.textMuted }}>Nueva fecha</label><Input type="date" value={fechaManual} onChange={e => { setFechaManual(e.target.value); setOkDetalle(""); }} /><button onClick={() => { setFechaManual(fechaIsoBuenosAires(1)); setOkDetalle(""); }} className="f-body mt-2 w-full px-3 py-2 rounded-xl text-xs font-medium" style={{ background: c.surface, color: c.accent, border: `1px solid ${c.border}` }}>Pasar para mañana</button></div>
                    <div><label className="f-body block text-xs mb-1.5" style={{ color: c.textMuted }}>Nota interna para el chofer (opcional)</label><textarea value={notaAdmin} maxLength={500} onChange={e => { setNotaAdmin(e.target.value); setOkDetalle(""); }} rows={3} placeholder="Ej.: el cliente confirmó que puede recibir antes; llamar al llegar..." className="f-body w-full px-3.5 py-2.5 rounded-xl text-sm outline-none resize-y" style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.text }} /><p className="f-body text-[10px] text-right mt-1" style={{ color: c.textFaint }}>{notaAdmin.length}/500</p></div>
                  </div>
                  {okDetalle && <p className="f-body text-xs mt-3 flex items-center gap-1.5" style={{ color: c.success }}><CheckCircle2 size={13} /> {okDetalle}</p>}
                  <button onClick={guardarCambioFecha} disabled={guardandoDetalle} className="f-body mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60" style={{ background: c.accent, color: c.bgAlt }}>{guardandoDetalle ? <Spinner size={14} /> : <Save size={14} />} Guardar fecha y nota</button>
                </div> : <div className="rounded-2xl p-4 flex items-center gap-2" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}` }}><CheckCircle2 size={16} color={detalle.estado === "entregado" ? c.success : c.textMuted} /><p className="f-body text-xs" style={{ color: c.textMuted }}>La fecha queda bloqueada porque este pedido ya fue cerrado.</p></div>}
              </div>
            )}
          </section>
        </div>
      )}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: c.accentSoft }}>
        <ArrowLeftRight size={14} color={c.accent} />
        <p className="f-body text-xs flex-1" style={{ color: c.text }}>Los pedidos se ordenan automáticamente por recorrido real en calles dentro de cada franja, partiendo desde el galpón. Si el ruteador no está disponible, se usa el orden geográfico seguro. Datos de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap</a>. Tocá cualquier tarjeta para ver todos sus datos o hacer cambios.</p>
        <button onClick={() => setNuevoPedidoAbierto(true)} className="f-body shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold" style={{ background: c.accent, color: c.bgAlt }}><Plus size={14} /> Cargar pedido</button>
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

      {fechaCarga && <section className="rounded-2xl p-4" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}` }}>
        <div className="mb-3"><p className="f-display text-sm font-semibold flex items-center gap-2" style={{ color: c.text }}><Boxes size={16} color={c.accent} /> Carga total del reparto</p><p className="f-body text-[11px] mt-1" style={{ color: c.textFaint }}>Mercadería que debe retirar cada chofer para cumplir todos los pedidos programados de este día.</p></div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {cargasPedidos.filter(carga => fCamion === "todos" || String(carga.camion.id) === String(fCamion)).map(carga => <div key={carga.camion.id}><div className="mb-2"><CamionChip camion={carga.camion} /></div><ResumenCarga carga={carga} compacto /></div>)}
        </div>
      </section>}

      {fechaCarga && <SeguimientoRepartosAdmin rutas={rutasVivo.filter(ruta => fCamion === "todos" || String(ruta.camion.id) === String(fCamion))} />}

      <ErrorBanner mensaje={error} />
      {cargando ? <Cargando /> : (
        <>
          {grupos.length === 0 && <div className="rounded-2xl py-10 text-center" style={{ background: c.surface, border: `1px solid ${c.border}` }}><p className="f-body text-xs" style={{ color: c.textFaint }}>Sin resultados para estos filtros.</p></div>}
          <div className="space-y-3">
            {grupos.map(({ camion: cm, pedidos: items }) => (
              <div key={cm.id} className="rounded-2xl overflow-hidden" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
                <div className="flex items-center gap-2 px-5 py-3.5" style={{ background: `${cm.color}14`, borderBottom: `1px solid ${c.borderSoft}` }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${cm.color}20` }}><Truck size={17} color={cm.color} /></div><span className="f-display text-sm font-semibold" style={{ color: cm.color }}>{cm.nombre}</span>
                  <span className="f-mono text-xs ml-auto" style={{ color: c.textFaint }}>{items.length} pedido{items.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-4">
                  {items.map(o => (
                    <article key={o.id} role="button" tabIndex={0} onClick={() => abrirDetalle(o.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrirDetalle(o.id); } }} className="rounded-2xl p-5 cursor-pointer transition-transform hover:-translate-y-0.5 focus:outline-none" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}` }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="f-mono text-sm font-semibold shrink-0 w-9 h-9 rounded-full inline-flex items-center justify-center" style={{ background: `${cm.color}22`, color: cm.color }}>{o.parada}</span>
                          <div className="min-w-0"><p className="f-display text-base font-semibold" style={{ color: c.text }}>{o.cliente}</p><p className="f-body text-xs flex items-start gap-1.5 mt-1" style={{ color: c.textMuted }}><MapPin size={13} className="shrink-0 mt-0.5" /> <span>{o.direccion}{o.detalleDireccion ? ` · ${o.detalleDireccion}` : ""} · {o.barrio}</span></p><p className="f-mono text-[11px] mt-1" style={{ color: c.textFaint }}>{o.telefono}</p></div>
                        </div>
                        <EstadoBadge estado={o.estado} />
                      </div>

                      <div className="grid sm:grid-cols-2 gap-3 mt-4">
                        <div className="rounded-xl p-3" style={{ background: c.surface }}><p className="f-body text-[10px] uppercase tracking-wide" style={{ color: c.textFaint }}>Día de entrega</p><p className="f-body text-sm font-medium mt-1" style={{ color: c.text }}>{formatearFechaEntrega(o.fechaEntrega)}</p>{o.fechaReasignadaManual && <span className="f-body inline-flex mt-1.5 text-[10px] px-2 py-0.5 rounded-full" style={{ background: c.amberSoft, color: c.amber }}>Fecha cambiada manualmente</span>}</div>
                        <div className="rounded-xl p-3" style={{ background: c.surface }}><p className="f-body text-[10px] uppercase tracking-wide" style={{ color: c.textFaint }}>Horario</p><p className="f-body text-sm font-medium mt-1" style={{ color: o.horaDesde ? c.accent : c.textMuted }}>{formatearFranja(o.horaDesde, o.horaHasta)}</p></div>
                      </div>

                      {(o.notas || o.notaAdmin || o.notaCamion) && <div className="mt-3 space-y-1.5">{o.notas && <p className="f-body text-xs px-3 py-2 rounded-xl line-clamp-2" style={{ background: c.amberSoft, color: c.text }}><b>Cliente:</b> {o.notas}</p>}{o.notaAdmin && <p className="f-body text-xs px-3 py-2 rounded-xl line-clamp-2" style={{ background: c.accentSoft, color: c.text }}><b>Administración:</b> {o.notaAdmin}</p>}{o.notaCamion && <p className="f-body text-xs px-3 py-2 rounded-xl line-clamp-2" style={{ background: c.surface, color: c.text }}><b>Nota camión:</b> {o.notaCamion}</p>}</div>}

                      <div className="flex flex-wrap items-center gap-2 mt-4 pt-4" style={{ borderTop: `1px solid ${c.borderSoft}` }}>
                        <span className="f-body text-xs" style={{ color: o.pagoConfirmado ? c.success : (o.estado === "entregado" ? c.amber : c.textMuted) }}>{o.pagoConfirmado ? `${o.pagoConfirmado} confirmado ✓` : (o.estado === "entregado" ? "Pago pendiente" : `Declaró ${o.pago || "—"}`)}</span>
                        {o.tieneComprobante && <button onClick={e => { e.stopPropagation(); abrirComprobante(o.id); }} disabled={abriendoComprobante === o.id} className="f-body inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium disabled:opacity-60" style={{ background: c.accentSoft, color: c.accent }} title="Ver captura del pago">{abriendoComprobante === o.id ? <Spinner size={11} /> : <Eye size={11} />} Comprobante</button>}
                        <span className="f-mono text-base font-semibold ml-auto" style={{ color: c.accent }}>${Number(o.total || 0).toLocaleString("es-AR")}</span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
                        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                          <select value={o.camionId} onChange={e => reasignar(o.id, e.target.value)} aria-label={`Asignar camión al pedido de ${o.cliente}`} className="f-body text-xs rounded-lg px-2.5 py-2 outline-none" style={{ background: c.surface, border: `1px solid ${c.border}`, color: camiones.find(x => x.id === o.camionId)?.color }}>
                            {camiones.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                          </select>
                          {o.reasignadoManual && <span className="f-body text-[10px] px-2 py-1 rounded-full" style={{ background: c.amberSoft, color: c.amber }}>camión manual</span>}
                        </div>
                        <button onClick={e => { e.stopPropagation(); abrirDetalle(o.id); }} className="f-body inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold" style={{ background: c.accent, color: c.bgAlt }}>Ver detalle <ChevronRight size={14} /></button>
                      </div>
                    </article>
                  ))}
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
  const [editandoCliente, setEditandoCliente] = useState(null);
  const [guardandoCliente, setGuardandoCliente] = useState(false);

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

  const guardarCliente = async () => {
    if (!editandoCliente) return;
    setGuardandoCliente(true);
    try {
      await api(`/admin/clientes/${editandoCliente.id}`, { method: "PATCH", token, body: editandoCliente });
      setEditandoCliente(null);
      const params = new URLSearchParams({ orden });
      if (q) params.set("q", q);
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      setLista(await api(`/admin/clientes?${params.toString()}`, { token }));
    } finally { setGuardandoCliente(false); }
  };

  const eliminarCliente = async cliente => {
    const ok = await confirmarAccion({ titulo: `Eliminar a ${cliente.nombre}`, mensaje: `Se borrará su ficha y también ${cliente.cantidadPedidos} pedido${cliente.cantidadPedidos === 1 ? "" : "s"} asociado${cliente.cantidadPedidos === 1 ? "" : "s"}. Esta acción no se puede deshacer.`, textoConfirmar: "Eliminar cliente" });
    if (!ok) return;
    await api(`/admin/clientes/${cliente.id}`, { method: "DELETE", token });
    setLista(actual => actual.filter(item => item.id !== cliente.id));
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
      {editandoCliente && <div role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setEditandoCliente(null); }} className="modal-backdrop-in fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 1001, background: "rgba(2, 8, 23, 0.76)", backdropFilter: "blur(6px)" }}><section role="dialog" aria-modal="true" aria-labelledby="editar-cliente-titulo" className="modal-card-in w-full max-w-xl rounded-3xl p-5 md:p-6" style={{ background: c.surface, border: `1px solid ${c.border}` }}><div className="flex items-center justify-between gap-3 mb-5"><div><p className="f-body text-[11px] uppercase tracking-wider" style={{ color: c.accent }}>Base de clientes</p><h2 id="editar-cliente-titulo" className="f-display text-xl font-semibold mt-1" style={{ color: c.text }}>Editar cliente</h2></div><button onClick={() => setEditandoCliente(null)} className="p-2 rounded-xl" style={{ background: c.surfaceAlt }} aria-label="Cerrar"><X size={17} color={c.textMuted} /></button></div><div className="grid sm:grid-cols-2 gap-3"><Input placeholder="Nombre y apellido" value={editandoCliente.nombre} onChange={e => setEditandoCliente({ ...editandoCliente, nombre: e.target.value })} /><Input placeholder="Teléfono" value={editandoCliente.telefono} onChange={e => setEditandoCliente({ ...editandoCliente, telefono: e.target.value })} /><Input placeholder="Calle y altura" value={editandoCliente.calle || ""} onChange={e => setEditandoCliente({ ...editandoCliente, calle: e.target.value })} /><Input placeholder="Piso / Departamento / Condominio" maxLength={120} value={editandoCliente.detalleDireccion || ""} onChange={e => setEditandoCliente({ ...editandoCliente, detalleDireccion: e.target.value })} /><Input placeholder="Barrio / localidad" value={editandoCliente.barrio} onChange={e => setEditandoCliente({ ...editandoCliente, barrio: e.target.value })} /><Select value={editandoCliente.tipo} onChange={e => setEditandoCliente({ ...editandoCliente, tipo: e.target.value })}><option value="casa">Casa</option><option value="oficina">Oficina</option><option value="empresa">Empresa</option></Select><Select value={editandoCliente.pago} onChange={e => setEditandoCliente({ ...editandoCliente, pago: e.target.value })}><option value="Efectivo">Efectivo</option><option value="Transferencia">Transferencia</option></Select></div><p className="f-body text-[11px] mt-3" style={{ color: c.textFaint }}>Esto modifica la ficha de la base; los pedidos ya creados conservan sus datos propios.</p><div className="flex justify-end gap-2 mt-5"><button onClick={() => setEditandoCliente(null)} disabled={guardandoCliente} className="f-body px-4 py-2.5 rounded-xl text-xs" style={{ background: c.surfaceAlt, color: c.textMuted }}>Cancelar</button><button onClick={guardarCliente} disabled={guardandoCliente} className="f-body inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold disabled:opacity-60" style={{ background: c.accent, color: c.bgAlt }}>{guardandoCliente ? <Spinner size={13} /> : <Save size={13} />} Guardar</button></div></section></div>}
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
              <thead><tr>{["Cliente", "Barrio", "Teléfono", "Tipo", "Pedidos", "Gasto total", "Último pedido", "Pago", "Nota camión (último pedido)", "Acciones"].map(h => <th key={h} className="text-left px-4 py-2.5 font-medium whitespace-nowrap" style={{ color: c.textFaint, borderBottom: `1px solid ${c.borderSoft}` }}>{h}</th>)}</tr></thead>
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
                    <td className="px-4 py-2.5" style={{ color: c.textMuted }}><div className="flex items-center gap-2 whitespace-nowrap"><span style={{ color: cl.pagoConfirmado ? c.success : (cl.estadoUltimoPedido === "entregado" ? c.amber : c.textMuted) }}>{cl.pagoConfirmado ? `${cl.pagoConfirmado} confirmado` : (cl.estadoUltimoPedido === "entregado" ? "Pago pendiente" : cl.pago)}</span>{cl.tieneComprobante && <button onClick={() => abrirComprobante(cl.ultimoPedidoId)} disabled={abriendoComprobante === cl.ultimoPedidoId} className="f-body inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium disabled:opacity-60" style={{ background: c.accentSoft, color: c.accent }}>{abriendoComprobante === cl.ultimoPedidoId ? <Spinner size={11} /> : <Eye size={11} />} Ver comprobante</button>}</div></td>
                    <td className="px-4 py-2.5 min-w-[220px]" style={{ color: cl.notaCamion ? c.textMuted : c.textFaint }}><span className="line-clamp-2" title={cl.notaCamion || ""}>{cl.notaCamion || "Sin nota"}</span></td>
                    <td className="px-4 py-2.5"><div className="flex items-center gap-1.5"><button onClick={() => setEditandoCliente({ ...cl, pago: cl.pagoDeclarado || "Efectivo" })} className="p-2 rounded-lg" style={{ background: c.accentSoft }} title="Editar cliente"><Pencil size={13} color={c.accent} /></button><button onClick={() => eliminarCliente(cl)} className="p-2 rounded-lg" style={{ background: c.dangerSoft }} title="Eliminar cliente"><Trash2 size={13} color={c.danger} /></button></div></td>
                  </tr>
                ))}
                {lista.length === 0 && <tr><td colSpan={10} className="text-center py-8" style={{ color: c.textFaint }}>Sin clientes que coincidan con la búsqueda.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- ADMIN: CATÁLOGO (3 catálogos separados) ---------------------------------- */
function EditorVariantesMayoristas({ producto, onCrear, onEditar, onEliminar }) {
  const c = useTheme();
  const [abierto, setAbierto] = useState(false);
  const [nuevo, setNuevo] = useState({ nombre: "", cantidad: "", precioUnitario: "" });
  const variantes = producto.variantes || [];
  const agregar = async () => {
    if (!nuevo.nombre.trim() || !nuevo.cantidad || !nuevo.precioUnitario) return mostrarErrorGlobal("Completá el nombre, la cantidad y el precio unitario de la opción.");
    const creado = await onCrear(producto.id, { nombre: nuevo.nombre, cantidad: Number(nuevo.cantidad), precioUnitario: Number(nuevo.precioUnitario), orden: variantes.length });
    if (creado) setNuevo({ nombre: "", cantidad: "", precioUnitario: "" });
  };
  return (
    <div className="sm:ml-[68px] rounded-xl overflow-hidden" style={{ border: `1px solid ${c.borderSoft}`, background: c.bgAlt }}>
      <button onClick={() => setAbierto(actual => !actual)} className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left">
        <div><p className="f-body text-xs font-medium" style={{ color: c.text }}>Cantidades y precios mayoristas</p><p className="f-body text-[10px] mt-0.5" style={{ color: c.textFaint }}>{variantes.length ? `${variantes.length} opción${variantes.length === 1 ? "" : "es"} configurada${variantes.length === 1 ? "" : "s"}` : "Agregá las opciones que verá el cliente al desplegar el producto"}</p></div>
        <ChevronDown size={16} color={c.accent} className={`transition-transform ${abierto ? "rotate-180" : ""}`} />
      </button>
      {abierto && <div className="p-3 space-y-2" style={{ borderTop: `1px solid ${c.borderSoft}` }}>
        {variantes.map(variante => <div key={variante.id} className="grid grid-cols-1 sm:grid-cols-[1fr_100px_130px_auto] gap-2 items-center rounded-xl p-2" style={{ background: c.surface, opacity: variante.activo ? 1 : 0.55 }}>
          <input defaultValue={variante.nombre} aria-label="Nombre de la opción" onBlur={e => { const valor = e.target.value.trim(); if (valor && valor !== variante.nombre) onEditar(producto.id, variante.id, { nombre: valor }); }} className="f-body min-w-0 px-2.5 py-2 rounded-lg text-xs outline-none" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.text }} />
          <div className="relative"><input type="number" min="1" defaultValue={variante.cantidad} aria-label="Cantidad" onBlur={e => { const valor = Number(e.target.value); if (valor > 0 && valor !== variante.cantidad) onEditar(producto.id, variante.id, { cantidad: valor }); }} className="f-mono w-full px-2.5 py-2 pr-8 rounded-lg text-xs outline-none" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.text }} /><span className="absolute right-2 top-2 f-body text-[10px]" style={{ color: c.textFaint }}>un.</span></div>
          <div className="relative"><span className="absolute left-2 top-2 f-mono text-xs" style={{ color: c.textFaint }}>$</span><input type="number" min="1" defaultValue={variante.precioUnitario} aria-label="Precio unitario" onBlur={e => { const valor = Number(e.target.value); if (valor > 0 && valor !== Number(variante.precioUnitario)) onEditar(producto.id, variante.id, { precioUnitario: valor }); }} className="f-mono w-full pl-5 pr-8 py-2 rounded-lg text-xs outline-none" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.text }} /><span className="absolute right-2 top-2 f-body text-[10px]" style={{ color: c.textFaint }}>c/u</span></div>
          <div className="flex items-center gap-1 justify-end"><button onClick={() => onEditar(producto.id, variante.id, { activo: !variante.activo })} className="f-body px-2 py-1.5 rounded-lg text-[10px]" style={{ background: variante.activo ? c.successSoft : c.dangerSoft, color: variante.activo ? c.success : c.danger }}>{variante.activo ? "Visible" : "Oculta"}</button><button onClick={() => onEliminar(producto, variante)} className="p-1.5 rounded-lg" style={{ background: c.dangerSoft }} aria-label={`Eliminar ${variante.nombre}`}><Trash2 size={12} color={c.danger} /></button></div>
          <p className="sm:col-span-4 f-body text-[10px] px-1" style={{ color: c.textFaint }}>Total mostrado: ${(Number(variante.precioUnitario) * variante.cantidad).toLocaleString("es-AR")}</p>
        </div>)}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px_130px_auto] gap-2 items-center rounded-xl p-2" style={{ border: `1px dashed ${c.border}` }}>
          <input value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Ej.: x 15 unidades" className="f-body min-w-0 px-2.5 py-2 rounded-lg text-xs outline-none" style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.text }} />
          <input type="number" min="1" value={nuevo.cantidad} onChange={e => setNuevo({ ...nuevo, cantidad: e.target.value })} placeholder="Cantidad" className="f-mono w-full px-2.5 py-2 rounded-lg text-xs outline-none" style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.text }} />
          <input type="number" min="1" value={nuevo.precioUnitario} onChange={e => setNuevo({ ...nuevo, precioUnitario: e.target.value })} placeholder="$ por unidad" className="f-mono w-full px-2.5 py-2 rounded-lg text-xs outline-none" style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.text }} />
          <button onClick={agregar} className="f-body inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-[11px] font-medium" style={{ background: c.accent, color: c.bgAlt }}><Plus size={12} /> Agregar</button>
        </div>
      </div>}
    </div>
  );
}

function ListaProductos({ productos, esMayorista, onEditarPrecio, onToggleActivo, onEliminar, onSubirImagen, onEliminarImagen, subiendoImagen, onCrearVariante, onEditarVariante, onEliminarVariante }) {
  const c = useTheme();
  return (
    <div className="space-y-2">
      {productos.map(p => (
        <div key={p.id} className="rounded-2xl p-3.5 flex flex-col gap-3" style={{ background: c.surface, border: `1px solid ${c.border}`, opacity: p.activo ? 1 : 0.5 }}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3"><div className="flex items-center gap-3 flex-1 min-w-0">
            <label className="group relative w-14 h-14 rounded-xl flex items-center justify-center shrink-0 overflow-hidden cursor-pointer" style={{ background: c.accentSoft, border: `1px dashed ${c.accent}66` }} title="Elegir o reemplazar imagen" aria-label={`Cambiar imagen de ${p.nombre}`}>
              {p.imagenUrl ? <img src={p.imagenUrl} alt={p.nombre} className="w-full h-full object-contain p-0.5" /> : <Package size={18} color={c.accent} />}
              <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(2,8,23,.58)" }}><ImagePlus size={18} color="#fff" /></span>
              <span className="absolute right-0.5 bottom-0.5 w-5 h-5 rounded-full flex items-center justify-center group-hover:opacity-0" style={{ background: c.accent, boxShadow: "0 2px 6px rgba(15,23,42,.25)" }}><ImagePlus size={11} color="#fff" /></span>
              {subiendoImagen === p.id && <span className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(2,8,23,.58)" }}><Spinner size={16} /></span>}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={subiendoImagen === p.id} onChange={e => { const archivo = e.target.files?.[0]; if (archivo) onSubirImagen(p.id, archivo); e.target.value = ""; }} />
            </label>
            <div className="flex-1 min-w-0"><p className="f-body text-sm font-medium" style={{ color: c.text }}>{p.nombre}</p><p className="f-body text-[11px]" style={{ color: c.textFaint }}>{p.descripcion || "—"}</p><p className="f-body text-[10px] mt-0.5" style={{ color: c.accent }}>Tocá la imagen para cambiarla</p></div>
          </div>
          <div className="flex items-center gap-2 justify-between sm:justify-end shrink-0">
            <div className="flex items-center gap-1"><span className="f-mono text-xs" style={{ color: c.textFaint }}>$</span><input type="number" defaultValue={p.precio} onBlur={e => onEditarPrecio(p.id, e.target.value)} className="f-mono text-xs w-20 px-2 py-1.5 rounded-lg outline-none" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.text }} /></div>
            <button onClick={() => onToggleActivo(p.id, p.activo)} className="f-body text-[11px] px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap" style={{ background: p.activo ? c.successSoft : c.dangerSoft, color: p.activo ? c.success : c.danger }}>{p.activo ? "Activo" : "Oculto"}</button>
            {p.imagenUrl && <button onClick={() => onEliminarImagen(p)} className="p-1.5 rounded-lg" style={{ background: c.surfaceAlt }} title={`Quitar foto de ${p.nombre}`} aria-label={`Quitar foto de ${p.nombre}`}><X size={13} color={c.textMuted} /></button>}
            <button onClick={() => onEliminar(p)} className="p-1.5 rounded-lg" style={{ background: c.dangerSoft }} title={`Eliminar definitivamente ${p.nombre}`} aria-label={`Eliminar definitivamente ${p.nombre}`}><Trash2 size={13} color={c.danger} /></button>
          </div></div>
          {esMayorista && <EditorVariantesMayoristas producto={p} onCrear={onCrearVariante} onEditar={onEditarVariante} onEliminar={onEliminarVariante} />}
        </div>
      ))}
      {productos.length === 0 && <p className="f-body text-xs py-4" style={{ color: c.textFaint }}>Sin productos en esta categoría todavía.</p>}
    </div>
  );
}

function AdminCatalogo({ token }) {
  const c = useTheme();
  const [productos, setProductos] = useState([]);
  const [portadas, setPortadas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [subiendoImagen, setSubiendoImagen] = useState(null);
  const [subiendoPortada, setSubiendoPortada] = useState(false);
  const [tab, setTab] = useState("consumo_personal");
  const [nuevo, setNuevo] = useState({ nombre: "", precio: "", descripcion: "" });

  const cargar = useCallback(async () => {
    try {
      const [listaProductos, listaPortadas] = await Promise.all([
        api("/admin/productos", { token }),
        api("/admin/portadas-catalogo", { token }),
      ]);
      setProductos(listaProductos);
      setPortadas(listaPortadas);
    } catch {
      setError("No pudimos cargar el catálogo.");
    } finally {
      setCargando(false);
    }
  }, [token]);
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
  const subirPortada = async (archivo) => {
    setSubiendoPortada(true); setError(""); setMensaje("");
    try {
      const body = new FormData();
      body.append("imagen", archivo);
      const actualizada = await api(`/admin/portadas-catalogo/${tab}/imagen`, { method: "PUT", token, body });
      setPortadas(prev => [...prev.filter(portada => portada.categoria !== tab), actualizada]);
      setMensaje(`Imagen de portada de ${OPCIONES_SEGMENTO.find(op => op.categoria === tab)?.label} actualizada.`);
    } catch (e) { setError(e.message || "No se pudo subir la imagen de portada."); }
    setSubiendoPortada(false);
  };
  const eliminarPortada = async () => {
    const etiqueta = OPCIONES_SEGMENTO.find(op => op.categoria === tab)?.label || "este catálogo";
    const confirmado = await confirmarAccion({ titulo: `¿Quitar la portada de ${etiqueta}?`, mensaje: "En la pantalla inicial se mostrará el ícono predeterminado. Las imágenes de los productos no cambiarán.", textoConfirmar: "Quitar portada", peligro: false });
    if (!confirmado) return;
    setError(""); setMensaje("");
    try {
      await api(`/admin/portadas-catalogo/${tab}/imagen`, { method: "DELETE", token });
      setPortadas(prev => prev.filter(portada => portada.categoria !== tab));
      setMensaje("Imagen de portada eliminada.");
    } catch (e) { setError(e.message || "No se pudo quitar la imagen de portada."); }
  };
  const crearVariante = async (productoId, datos) => {
    try {
      const variante = await api(`/admin/productos/${productoId}/variantes`, { method: "POST", token, body: datos });
      setProductos(prev => prev.map(producto => producto.id === productoId ? { ...producto, variantes: [...(producto.variantes || []), variante] } : producto));
      setMensaje("Opción mayorista agregada.");
      return true;
    } catch (e) { setError(e.message || "No se pudo agregar la opción mayorista."); return false; }
  };
  const editarVariante = async (productoId, varianteId, cambios) => {
    setError("");
    try {
      const variante = await api(`/admin/productos/${productoId}/variantes/${varianteId}`, { method: "PATCH", token, body: cambios });
      setProductos(prev => prev.map(producto => producto.id === productoId ? { ...producto, variantes: (producto.variantes || []).map(actual => actual.id === varianteId ? variante : actual) } : producto));
    } catch (e) { setError(e.message || "No se pudo actualizar la opción mayorista."); cargar(); }
  };
  const eliminarVariante = async (producto, variante) => {
    const confirmado = await confirmarAccion({ titulo: `¿Eliminar "${variante.nombre}"?`, mensaje: `Se quitará esta cantidad de ${producto.nombre}. Los pedidos anteriores conservarán su precio.`, textoConfirmar: "Eliminar opción" });
    if (!confirmado) return;
    try {
      await api(`/admin/productos/${producto.id}/variantes/${variante.id}`, { method: "DELETE", token });
      setProductos(prev => prev.map(actual => actual.id === producto.id ? { ...actual, variantes: (actual.variantes || []).filter(item => item.id !== variante.id) } : actual));
      setMensaje("Opción mayorista eliminada.");
    } catch (e) { setError(e.message || "No se pudo eliminar la opción mayorista."); }
  };
  const agregar = async () => {
    if (!nuevo.nombre || !nuevo.precio) return;
    try { await api("/admin/productos", { method: "POST", token, body: { nombre: nuevo.nombre, descripcion: nuevo.descripcion, precio: Number(nuevo.precio), categoria: tab } }); setNuevo({ nombre: "", precio: "", descripcion: "" }); cargar(); }
    catch (e) { setError(e.message || "No se pudo crear el producto."); }
  };

  if (cargando) return <Cargando />;
  const delTab = productos.filter(p => p.categoria === tab);
  const catalogoActivo = OPCIONES_SEGMENTO.find(op => op.categoria === tab);
  const portadaActiva = portadas.find(portada => portada.categoria === tab);

  return (
    <div className="space-y-4">
      <p className="f-body text-xs" style={{ color: c.textMuted }}>Cada catálogo se ve por separado en la vidriera, según lo que el cliente elija al empezar su pedido.</p>
      <div className="flex items-start gap-3 rounded-2xl p-3.5" style={{ background: c.accentSoft, border: `1px solid ${c.accent}33` }}><ImagePlus size={18} color={c.accent} className="mt-0.5 shrink-0" /><div><p className="f-body text-xs font-semibold" style={{ color: c.text }}>Imágenes de la portada</p><p className="f-body text-[11px] mt-1 leading-relaxed" style={{ color: c.textMuted }}>Cada catálogo tiene una imagen general independiente para la primera pantalla. Podés usar una composición PNG con fondo transparente; no se tomarán automáticamente las fotos de los productos.</p></div></div>
      <div className="flex flex-wrap rounded-xl p-1 gap-1" style={{ background: c.surface, width: "fit-content" }}>
        {OPCIONES_SEGMENTO.map(op => (
          <button key={op.categoria} onClick={() => setTab(op.categoria)} className="f-body px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5" style={{ background: tab === op.categoria ? c.accentSoft : "transparent", color: tab === op.categoria ? c.accent : c.textMuted }}>
            <op.Icon size={13} /> {op.label}
          </button>
        ))}
      </div>
      <ErrorBanner mensaje={error} />
      {mensaje && <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: c.successSoft }}><CheckCircle2 size={14} color={c.success} /><span className="f-body text-xs" style={{ color: c.success }}>{mensaje}</span></div>}

      <div className="rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-4" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
        <div className="w-32 h-28 rounded-2xl flex items-center justify-center overflow-hidden shrink-0" style={{ background: c.bgAlt, border: `1px dashed ${c.accent}66` }}>
          {portadaActiva?.imagenUrl ? <img src={portadaActiva.imagenUrl} alt={`Portada de ${catalogoActivo?.label}`} className="w-full h-full object-contain" /> : catalogoActivo ? <catalogoActivo.Icon size={38} color={c.accent} strokeWidth={1.5} /> : null}
        </div>
        <div className="flex-1 min-w-0">
          <p className="f-body text-sm font-semibold" style={{ color: c.text }}>Imagen general de {catalogoActivo?.label}</p>
          <p className="f-body text-[11px] mt-1 leading-relaxed" style={{ color: c.textMuted }}>Se muestra únicamente en la tarjeta del inicio. Recomendado: PNG transparente, formato horizontal o cuadrado, hasta 5 MB.</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <label className="f-body inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer" style={{ background: c.accent, color: c.bgAlt }}>
              {subiendoPortada ? <Spinner size={14} /> : <Upload size={14} />} {portadaActiva ? "Reemplazar imagen" : "Cargar imagen"}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={subiendoPortada} onChange={e => { const archivo = e.target.files?.[0]; if (archivo) subirPortada(archivo); e.target.value = ""; }} />
            </label>
            {portadaActiva && <button onClick={eliminarPortada} disabled={subiendoPortada} className="f-body inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium disabled:opacity-50" style={{ background: c.surfaceAlt, color: c.textMuted, border: `1px solid ${c.border}` }}><X size={14} /> Quitar portada</button>}
          </div>
        </div>
      </div>

      <ListaProductos productos={delTab} esMayorista={tab === "comercio_reventa"} onEditarPrecio={editarPrecio} onToggleActivo={toggleActivo} onEliminar={eliminar} onSubirImagen={subirImagen} onEliminarImagen={eliminarImagen} subiendoImagen={subiendoImagen} onCrearVariante={crearVariante} onEditarVariante={editarVariante} onEliminarVariante={eliminarVariante} />

      <div className="rounded-2xl p-3.5 flex flex-col gap-2" style={{ background: c.bgAlt, border: `1px dashed ${c.border}` }}>
        <p className="f-body text-xs font-medium" style={{ color: c.textMuted }}>Agregar producto a {catalogoActivo?.label}</p>
        <Input placeholder="Nombre del producto" value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} />
        <Input placeholder="Descripción (opcional)" value={nuevo.descripcion} onChange={e => setNuevo({ ...nuevo, descripcion: e.target.value })} />
        <div className="flex gap-2">
          <input type="number" placeholder={tab === "comercio_reventa" ? "Precio unitario base" : "Precio"} value={nuevo.precio} onChange={e => setNuevo({ ...nuevo, precio: e.target.value })} className="f-body flex-1 px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.text }} />
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
          <Input value={choferPassword} onChange={e => setChoferPassword(e.target.value)} placeholder="Nueva contraseña (dejar vacío para no cambiarla)" type="password" className="text-xs py-1.5" />
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

function AgendaBarrios({ token, zonas, onGuardado }) {
  const c = useTheme();
  const [zonaId, setZonaId] = useState("");
  const [agenda, setAgenda] = useState({ diasSemana: [], horaDesde: "09:00", horaHasta: "15:00", cupoMaximo: "6" });
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!zonas.length) return setZonaId("");
    if (!zonas.some(zona => String(zona.id) === String(zonaId))) setZonaId(String(zonas[0].id));
  }, [zonas, zonaId]);

  useEffect(() => {
    if (!zonaId) return;
    let vigente = true;
    setCargando(true); setOk(""); setError("");
    api(`/admin/zonas/${zonaId}/agenda`, { token })
      .then(data => {
        if (!vigente) return;
        setAgenda({
          diasSemana: data.diasSemana || [],
          horaDesde: data.horaDesde || "09:00",
          horaHasta: data.horaHasta || "15:00",
          cupoMaximo: String(data.cupoMaximo || 6),
        });
      })
      .catch(e => vigente && setError(e.message || "No pudimos cargar la agenda."))
      .finally(() => vigente && setCargando(false));
    return () => { vigente = false; };
  }, [zonaId, token]);

  const zona = zonas.find(item => String(item.id) === String(zonaId));
  const franjas = useMemo(() => generarFranjasVista(agenda.horaDesde, agenda.horaHasta), [agenda.horaDesde, agenda.horaHasta]);
  const alternarDia = (dia) => setAgenda(actual => ({
    ...actual,
    diasSemana: actual.diasSemana.includes(dia) ? actual.diasSemana.filter(valor => valor !== dia) : [...actual.diasSemana, dia].sort((a, b) => a - b),
  }));
  const guardar = async () => {
    setOk(""); setError("");
    if (!agenda.diasSemana.length) return setError("Elegí al menos un día de reparto.");
    if (!franjas.length) return setError("Ingresá un rango horario válido.");
    setGuardando(true);
    try {
      const data = await api(`/admin/zonas/${zonaId}/agenda`, {
        method: "PUT", token,
        body: { ...agenda, cupoMaximo: Number(agenda.cupoMaximo) },
      });
      setAgenda({ diasSemana: data.diasSemana, horaDesde: data.horaDesde, horaHasta: data.horaHasta, cupoMaximo: String(data.cupoMaximo) });
      setOk(`Horario de ${data.barrio} guardado: ${data.horaDesde} a ${data.horaHasta}.`);
      onGuardado?.();
    } catch (e) { setError(e.message || "No pudimos guardar la agenda."); }
    setGuardando(false);
  };

  return (
    <div className="rounded-2xl p-4" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
      <div className="flex items-start gap-2 mb-3">
        <CalendarClock size={16} color={c.accent} className="mt-0.5 shrink-0" />
        <div><p className="f-body text-sm font-medium" style={{ color: c.text }}>Horarios de entrega por barrio</p><p className="f-body text-[11px] mt-0.5" style={{ color: c.textFaint }}>Elegí un barrio y definí sus días y rango horario. El cliente verá el rango completo, por ejemplo de 10:00 a 13:00.</p></div>
      </div>
      {zonas.length === 0 ? <p className="f-body text-xs" style={{ color: c.textFaint }}>Primero agregá un barrio.</p> : (
        <div className="space-y-3">
          <select value={zonaId} onChange={e => setZonaId(e.target.value)} className="f-body w-full px-3 py-2.5 rounded-xl text-xs outline-none" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.text }}>
            {zonas.map(item => <option key={item.id} value={item.id}>{item.barrio} · {item.camionNombre || "sin camión asignado"}</option>)}
          </select>
          {cargando ? <Cargando label="Cargando agenda..." /> : (
            <>
              <div>
                <p className="f-body text-xs mb-2" style={{ color: c.textMuted }}>Días de reparto</p>
                <div className="flex flex-wrap gap-2">
                  {DIAS_SEMANA.map(dia => {
                    const activo = agenda.diasSemana.includes(dia.id);
                    return <button key={dia.id} onClick={() => alternarDia(dia.id)} className="f-body px-3 py-2 rounded-xl text-xs font-medium" style={{ background: activo ? c.accentSoft : c.bgAlt, border: `1px solid ${activo ? c.accent : c.border}`, color: activo ? c.accent : c.textMuted }}>{dia.label}</button>;
                  })}
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-2 p-3 rounded-xl" style={{ background: c.bgAlt, border: `1px dashed ${c.border}` }}>
                <label className="f-body text-[10px]" style={{ color: c.textFaint }}>Comienza
                  <input type="time" step="3600" value={agenda.horaDesde} onChange={e => setAgenda({ ...agenda, horaDesde: e.target.value })} className="block w-full mt-1 px-2.5 py-2 rounded-lg text-xs outline-none" style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.text }} />
                </label>
                <label className="f-body text-[10px]" style={{ color: c.textFaint }}>Finaliza
                  <input type="time" step="3600" value={agenda.horaHasta} onChange={e => setAgenda({ ...agenda, horaHasta: e.target.value })} className="block w-full mt-1 px-2.5 py-2 rounded-lg text-xs outline-none" style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.text }} />
                </label>
                <label className="f-body text-[10px]" style={{ color: c.textFaint }}>Cupo del rango
                  <input type="number" min="1" max="100" value={agenda.cupoMaximo} onChange={e => setAgenda({ ...agenda, cupoMaximo: e.target.value })} className="block w-full mt-1 px-2.5 py-2 rounded-lg text-xs outline-none" style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.text }} />
                </label>
              </div>
              <div className="rounded-xl p-3 flex flex-wrap items-center gap-3" style={{ background: c.accentSoft, border: `1px solid ${c.accent}33` }}>
                <div className="flex-1"><p className="f-body text-xs font-medium" style={{ color: c.text }}>Rango que verá el cliente</p><p className="f-body text-[10px] mt-1" style={{ color: c.textFaint }}>{zona ? `Se aplicará solamente a ${zona.barrio}. ${zona.camionNombre ? `El reparto está asignado a ${zona.camionNombre}.` : "Todavía falta asignarle un camión."}` : "Elegí un barrio para configurar sus entregas."}</p></div>
                {franjas.length ? <span className="f-mono text-sm rounded-xl px-3 py-2" style={{ background: c.surface, color: c.accent, border: `1px solid ${c.border}` }}>{agenda.horaDesde}–{agenda.horaHasta}</span> : <span className="f-body text-[11px]" style={{ color: c.amber }}>Revisá las horas.</span>}
              </div>
              <ErrorBanner mensaje={error} />
              {error && <p className="f-body text-xs" style={{ color: c.danger }}>{error}</p>}
              {ok && <p className="f-body text-xs" style={{ color: c.success }}>{ok}</p>}
              <button disabled={guardando || !zona || !agenda.diasSemana.length || !franjas.length} onClick={guardar} className="f-body w-full px-3 py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-2 disabled:opacity-40" style={{ background: c.accent, color: c.bgAlt }}>{guardando ? <Spinner size={13} /> : <Save size={13} />} Guardar horario de {zona?.barrio || "este barrio"}</button>
              <p className="f-body text-[10px]" style={{ color: c.textFaint }}>Cuando el cliente elija este barrio, verá únicamente sus fechas y el rango completo disponible. El chofer seguirá recibiendo los pedidos ordenados por horario y recorrido.</p>
            </>
          )}
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
      <AgendaBarrios token={token} zonas={zonas} onGuardado={() => cargar(false)} />

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
  const [logistica, setLogistica] = useState({ direccionBase: "", configurada: false });
  const [guardandoLogistica, setGuardandoLogistica] = useState(false);
  const [okLogistica, setOkLogistica] = useState(""); const [errorLogistica, setErrorLogistica] = useState("");

  useEffect(() => {
    api("/admin/perfil", { token }).then(p => { setPerfil(p); setNombre(p.nombre); setUsuario(p.usuario); });
    api("/admin/configuracion", { token }).then(d => { setAreaPrivadaConfigurada(d.areaPrivadaConfigurada); setDatosBanco(d.transferencia || { titular: "", banco: "", alias: "", cbu: "", cuit: "" }); setLogistica(d.logistica || { direccionBase: "", configurada: false }); });
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

  const guardarLogistica = async () => {
    setGuardandoLogistica(true); setOkLogistica(""); setErrorLogistica("");
    try {
      const d = await api("/admin/configuracion", { method: "PATCH", token, body: { logistica: { direccionBase: logistica.direccionBase } } });
      setLogistica(d.logistica); setOkLogistica(d.logistica.configurada ? "Punto de salida ubicado. Las rutas se ordenarán automáticamente desde acá." : "Punto de salida desactivado.");
    } catch (e) { setErrorLogistica(e.message || "No se pudo ubicar el punto de salida."); }
    setGuardandoLogistica(false);
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
        <p className="f-body text-sm font-medium mb-1 flex items-center gap-1.5" style={{ color: c.text }}><MapPin size={15} /> Punto de salida del reparto</p>
        <p className="f-body text-[11px] mb-3" style={{ color: c.textFaint }}>Ingresá la dirección exacta del galpón. Dentro de cada franja, el sistema geolocaliza los pedidos y arma automáticamente el recorrido desde este punto.</p>
        <div className="flex flex-col sm:flex-row gap-2 max-w-2xl">
          <Input placeholder="Calle, altura y localidad del galpón" value={logistica.direccionBase || ""} onChange={e => setLogistica({ ...logistica, direccionBase: e.target.value, configurada: false })} />
          <button onClick={guardarLogistica} disabled={guardandoLogistica} className="f-body px-4 py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-2 disabled:opacity-70 shrink-0" style={{ background: c.accent, color: c.bgAlt }}>{guardandoLogistica ? <Spinner size={13} /> : <MapPin size={13} />} Ubicar galpón</button>
        </div>
        <ErrorBanner mensaje={errorLogistica} />
        {okLogistica && <p className="f-body text-[11px] mt-2" style={{ color: c.success }}>{okLogistica}</p>}
        {logistica.configurada && <p className="f-body text-[11px] mt-2 px-3 py-2 rounded-xl" style={{ color: c.accent, background: c.accentSoft }}>✓ Geolocalización activa para las hojas de ruta.</p>}
        <p className="f-body text-[10px] mt-2" style={{ color: c.textFaint }}>Ubicación aproximada obtenida mediante OpenStreetMap. Si cambiás el domicilio, volvé a guardarlo.</p>
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

function AdminCajas({ token }) {
  const c = useTheme();
  const [desde, setDesde] = useState(() => fechaIsoBuenosAires());
  const [hasta, setHasta] = useState(() => fechaIsoBuenosAires());
  const [cajas, setCajas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const moneda = valor => `$${Number(valor || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
  const cargar = useCallback(async (spinner = true) => {
    if (spinner) setCargando(true);
    try { setCajas((await api(`/admin/cajas?desde=${desde}&hasta=${hasta}`, { token })).cajas || []); }
    finally { if (spinner) setCargando(false); }
  }, [desde, hasta, token]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { const timer = setInterval(() => cargar(false), 15000); return () => clearInterval(timer); }, [cargar]);

  const reabrir = async caja => {
    const ok = await confirmarAccion({ titulo: `Reabrir caja de ${caja.camion.nombre}`, mensaje: "El chofer podrá corregirla y volver a rendirla. El próximo cierre recalculará ventas y cobros.", textoConfirmar: "Reabrir caja", peligro: false });
    if (!ok) return;
    await api(`/admin/cajas/${caja.id}/reabrir`, { method: "PATCH", token });
    cargar(false);
  };
  const totales = cajas.reduce((a, caja) => ({
    ventas: a.ventas + Number(caja.ventasTotal || 0), efectivo: a.efectivo + Number(caja.efectivoCobrado || 0), transferencias: a.transferencias + Number(caja.transferenciasCobradas || 0),
    remitos: a.remitos + Number(caja.remitosTotal || 0), extracciones: a.extracciones + Number(caja.extraccionesTotal || 0), rendir: a.rendir + Number(caja.efectivoEsperado || 0),
  }), { ventas: 0, efectivo: 0, transferencias: 0, remitos: 0, extracciones: 0, rendir: 0 });
  const hoyIso = fechaIsoBuenosAires();
  const inicioSemana = useMemo(() => {
    const fecha = new Date(`${hoyIso}T00:00:00Z`);
    fecha.setUTCDate(fecha.getUTCDate() - 6);
    return fecha.toISOString().slice(0, 10);
  }, [hoyIso]);
  const inicioMes = `${hoyIso.slice(0, 8)}01`;
  const presetActivo = desde === hoyIso && hasta === hoyIso
    ? "hoy"
    : desde === inicioSemana && hasta === hoyIso
      ? "semana"
      : desde === inicioMes && hasta === hoyIso
        ? "mes"
        : null;
  const estiloPreset = tipo => presetActivo === tipo
    ? { background: c.accentSoft, color: c.accent }
    : { background: c.surfaceAlt, color: c.textMuted };
  const aplicarPreset = tipo => {
    if (tipo === "hoy") { setDesde(hoyIso); setHasta(hoyIso); return; }
    if (tipo === "semana") { setDesde(inicioSemana); setHasta(hoyIso); return; }
    setDesde(inicioMes); setHasta(hoyIso);
  };

  return <div className="space-y-4">
    <div className="rounded-2xl p-4" style={{ background: c.surface, border: `1px solid ${c.border}` }}><div className="flex flex-wrap items-start justify-between gap-3 mb-3"><div><p className="f-body text-sm font-medium" style={{ color: c.text }}>Rendición por período</p><p className="f-body text-[11px] mt-1" style={{ color: c.textFaint }}>Elegí día, semana, mes o cualquier rango y descargalo en PDF.</p><p className="f-body text-[10px] mt-1" style={{ color: c.amber }}>Caja suma únicamente pedidos marcados como Entregados.</p></div><button onClick={async () => { const { descargarReporteCaja } = await import("./utils/reporteCajaPdf"); descargarReporteCaja({ desde, hasta, cajas }); }} disabled={cargando || !cajas.length} className="f-body inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold disabled:opacity-40" style={{ background: c.accent, color: c.bgAlt }}><Download size={14} /> Descargar PDF</button></div><div className="flex flex-wrap gap-2 items-center"><button onClick={() => aplicarPreset("hoy")} className="f-body px-3 py-2 rounded-xl text-xs" style={estiloPreset("hoy")}>Hoy</button><button onClick={() => aplicarPreset("semana")} className="f-body px-3 py-2 rounded-xl text-xs" style={estiloPreset("semana")}>Últimos 7 días</button><button onClick={() => aplicarPreset("mes")} className="f-body px-3 py-2 rounded-xl text-xs" style={estiloPreset("mes")}>Este mes</button><span className="f-body text-[11px] ml-1" style={{ color: c.textFaint }}>Desde</span><Input type="date" value={desde} max={hasta} onChange={e => setDesde(e.target.value)} className="max-w-[165px]" /><span className="f-body text-[11px]" style={{ color: c.textFaint }}>hasta</span><Input type="date" value={hasta} min={desde} max={fechaIsoBuenosAires()} onChange={e => setHasta(e.target.value)} className="max-w-[165px]" /></div></div>
    {cargando ? <Cargando label="Calculando cierres..." /> : <>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3"><ResumenCajaDato label="Ventas del período" valor={moneda(totales.ventas)} color={c.text} fondo={c.surface} /><ResumenCajaDato label="Efectivo cobrado" valor={moneda(totales.efectivo)} color={c.success} fondo={c.surface} /><ResumenCajaDato label="Transferencias" valor={moneda(totales.transferencias)} color={c.accent} fondo={c.surface} /><ResumenCajaDato label="Remitos" valor={moneda(totales.remitos)} color={c.amber} fondo={c.surface} /><ResumenCajaDato label="Extracciones" valor={`− ${moneda(totales.extracciones)}`} color={c.danger} fondo={c.surface} /><ResumenCajaDato label="Efectivo esperado" valor={moneda(totales.rendir)} color={c.text} fondo={c.surface} /></div>
      {!cajas.length && <div className="rounded-2xl p-8 text-center" style={{ background: c.surface, border: `1px solid ${c.border}` }}><p className="f-body text-xs" style={{ color: c.textFaint }}>No hay movimientos de caja en este período.</p></div>}
      <div className="grid lg:grid-cols-2 gap-4">{cajas.map(caja => <article key={`${caja.fecha}-${caja.camion.id}`} className="rounded-2xl p-4" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
        <div className="flex items-start justify-between gap-3 mb-4"><div><CamionChip camion={caja.camion} /><p className="f-body text-[11px] mt-1.5" style={{ color: c.textFaint }}>{formatearFechaEntrega(caja.fecha)} · {caja.choferNombre || "Sin chofer"} · {caja.pedidosEntregados} entregas</p></div><span className="f-body text-[11px] px-2.5 py-1 rounded-full" style={{ background: caja.cerrado ? c.successSoft : c.amberSoft, color: caja.cerrado ? c.success : c.amber }}>{caja.cerrado ? "Cerrada" : "Pendiente de cierre"}</span></div>
        <div className="grid grid-cols-2 gap-2 mb-4"><ResumenCajaDato label="Ventas" valor={moneda(caja.ventasTotal)} color={c.text} fondo={c.surfaceAlt} /><ResumenCajaDato label="Efectivo" valor={moneda(caja.efectivoCobrado)} color={c.success} fondo={c.successSoft} /><ResumenCajaDato label="Transferencias" valor={moneda(caja.transferenciasCobradas)} color={c.accent} fondo={c.accentSoft} /><ResumenCajaDato label="Remitos" valor={moneda(caja.remitosTotal)} color={caja.remitosTotal ? c.amber : c.textMuted} fondo={caja.remitosTotal ? c.amberSoft : c.surfaceAlt} /></div>
        <div className="mb-4"><p className="f-body text-xs font-medium mb-2" style={{ color: c.text }}>Unidades vendidas</p>{caja.productos.length ? <div className="space-y-1">{caja.productos.map(producto => <div key={producto.nombre} className="flex justify-between text-[11px]"><span className="f-body" style={{ color: c.textMuted }}>{producto.nombre}</span><span className="f-mono" style={{ color: c.text }}>{producto.cantidad}</span></div>)}</div> : <p className="f-body text-[11px]" style={{ color: c.textFaint }}>Sin entregas.</p>}</div>
        {!!caja.extracciones.length && <div className="mb-4"><p className="f-body text-xs font-medium mb-2" style={{ color: c.text }}>Extracciones</p>{caja.extracciones.map(item => <div key={item.id} className="flex justify-between gap-3 text-[11px] py-1"><span className="f-body" style={{ color: c.textMuted }}>{item.concepto} · {item.responsable}</span><span className="f-mono shrink-0" style={{ color: c.danger }}>− {moneda(item.monto)}</span></div>)}</div>}
        <div className="rounded-xl p-3" style={{ background: c.accentSoft }}><div className="flex justify-between"><span className="f-body text-xs" style={{ color: c.textMuted }}>Efectivo esperado</span><span className="f-mono font-semibold" style={{ color: c.accent }}>{moneda(caja.efectivoEsperado)}</span></div>{caja.cerrado && <><div className="flex justify-between mt-2"><span className="f-body text-xs" style={{ color: c.textMuted }}>Declarado</span><span className="f-mono" style={{ color: c.text }}>{moneda(caja.efectivoDeclarado)}</span></div><div className="flex justify-between mt-2"><span className="f-body text-xs" style={{ color: c.textMuted }}>Diferencia</span><span className="f-mono" style={{ color: caja.diferencia === 0 ? c.success : c.danger }}>{moneda(caja.diferencia)}</span></div></>}</div>
        {caja.observaciones && <p className="f-body text-[11px] mt-3 rounded-lg p-2" style={{ color: c.textMuted, background: c.surfaceAlt }}>{caja.observaciones}</p>}
        {caja.cerrado && <button onClick={() => reabrir(caja)} className="f-body mt-3 text-[11px] underline" style={{ color: c.textMuted }}>Reabrir caja para corregir</button>}
      </article>)}</div>
    </>}
  </div>;
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
    { id: "cajas", label: "Caja", Icon: Wallet },
    { id: "catalogo", label: "Catálogo", Icon: Boxes },
    { id: "camiones", label: "Camiones", Icon: Truck },
    { id: "calendario", label: "Días no hábiles", Icon: CalendarClock },
    { id: "configuracion", label: "Mi cuenta", Icon: Settings },
  ];
  const titles = { dashboard: "Dashboard general", pedidos: "Pedidos", clientes: "Base de clientes", cajas: "Cierres de caja", catalogo: "Catálogo de productos", camiones: "Camiones y zonas", calendario: "Días no hábiles", configuracion: "Mi cuenta y configuración" };

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
        <div className="max-w-[1480px] mx-auto px-4 md:px-6 xl:px-8 py-5 md:py-6">
          <div className="flex items-center gap-2 mb-5"><Sparkles size={15} color={c.accent} className="shrink-0" /><h1 className="f-display text-lg font-semibold" style={{ color: c.text }}>{titles[view]}</h1></div>
          {view === "dashboard" && <AdminDashboard token={session.token} />}
          {view === "pedidos" && <AdminPedidos token={session.token} camiones={camiones} />}
          {view === "clientes" && <AdminClientes token={session.token} />}
          {view === "cajas" && <AdminCajas token={session.token} />}
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
  else contenido = <ClientePortal onAccesoInterno={() => setView("gate")} modo={modo} setModo={setModo} />;

  return (
    <ThemeContext.Provider value={c}>
      <div className={`f-body min-h-screen flex flex-col ${modo === "dark" ? "theme-dark" : "theme-light"}`} style={{ background: c.bg }}>
        {fonts}
        <ErrorModal />
        <ConfirmModal />
        {view !== "admin" && view !== "vidriera" && <ThemeToggleFlotante modo={modo} setModo={setModo} c={c} />}
        <main className="flex-1 flex flex-col">{contenido}</main>
        <SystemFooter />
      </div>
    </ThemeContext.Provider>
  );
}
