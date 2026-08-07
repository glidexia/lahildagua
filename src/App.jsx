import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Droplet, Droplets, Package, Truck, User, MapPin, Building2, Home, Briefcase,
  CheckCircle2, XCircle, Clock, LayoutDashboard, Users, ChevronRight, ChevronLeft,
  Minus, Plus, CalendarClock, LogOut, BarChart3, Lock, Search, ArrowUpDown,
  ClipboardList, Boxes, Pencil, Save, Sparkles, ArrowLeftRight, TrendingUp, Sun, Moon,
  Loader2, AlertCircle
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip, Cell } from "recharts";

/* ---------------------------------- API ---------------------------------- */
const API_BASE = "https://hilda-production.up.railway.app";

async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}
function decodeJwt(token) {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(atob(b64).split("").map(ch => "%" + ch.charCodeAt(0).toString(16).padStart(2, "0")).join("")));
  } catch { return {}; }
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

const fonts = (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap');
    .f-display{font-family:'Space Grotesk',sans-serif}.f-body{font-family:'Inter',sans-serif}.f-mono{font-family:'JetBrains Mono',monospace}
    .theme-dark input,.theme-dark select{color-scheme:dark}
    .theme-light input,.theme-light select{color-scheme:light}
    @keyframes spin{to{transform:rotate(360deg)}}
  `}</style>
);

const PAGOS = ["Efectivo", "Transferencia", "Mercado Pago"];
const TIPOS_LUGAR = [{ id: "casa", label: "Casa", Icon: Home }, { id: "oficina", label: "Oficina", Icon: Briefcase }, { id: "empresa", label: "Empresa", Icon: Building2 }];
function fmtDate(d) { return d.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" }); }
const HOY = new Date(), AYER = new Date(HOY), MANANA = new Date(HOY);
AYER.setDate(HOY.getDate() - 1); MANANA.setDate(HOY.getDate() + 1);
const DIAS = { ayer: { label: "Ayer", fecha: fmtDate(AYER) }, hoy: { label: "Hoy", fecha: fmtDate(HOY) }, manana: { label: "Mañana", fecha: fmtDate(MANANA) } };

/* ---------------------------------- HELPERS UI ---------------------------------- */
function Spinner({ size = 16 }) { const c = useTheme(); return <Loader2 size={size} color={c.textFaint} style={{ animation: "spin 0.9s linear infinite" }} />; }
function Cargando({ label = "Cargando..." }) { const c = useTheme(); return <div className="flex items-center justify-center gap-2 py-10"><Spinner /><span className="f-body text-xs" style={{ color: c.textFaint }}>{label}</span></div>; }
function ErrorBanner({ mensaje }) { const c = useTheme(); if (!mensaje) return null; return <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3" style={{ background: c.dangerSoft }}><AlertCircle size={14} color={c.danger} /><span className="f-body text-xs" style={{ color: c.danger }}>{mensaje}</span></div>; }
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

/* ---------------------------------- ZONE MAP ---------------------------------- */
function ZoneMap({ highlightBarrio, zonas }) {
  const c = useTheme();
  const cells = [
    { barrio: "Alta Córdoba" }, { barrio: "General Paz" }, { barrio: "Colón" },
    { barrio: "Cerro de las Rosas" }, { barrio: "Centro" }, { barrio: "Nueva Córdoba" }, { barrio: "Rogelio Martínez" },
    { barrio: "Villa Belgrano" }, { barrio: "Güemes" }, { barrio: "Providencia" }, { barrio: "Villa Allende" },
    { barrio: "Jardín" }, { barrio: "Alberdi" }, { barrio: "San Vicente" }, { barrio: "Talleres" },
  ];
  const find = (barrio) => (zonas || []).find(z => z.barrio === barrio);
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
      <p className="f-body text-[11px] mt-3" style={{ color: c.textFaint }}>Mapa ilustrativo — la versión con geolocalización real es una mejora de fase 2.</p>
    </div>
  );
}

/* ---------------------------------- VIDRIERA (CLIENTE) ---------------------------------- */
function ClientePortal({ onAccesoInterno }) {
  const c = useTheme();
  const [productos, setProductos] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [cant, setCant] = useState({});
  const [form, setForm] = useState({ nombre: "", telefono: "", barrio: "", calle: "", tipo: "casa", pago: "Efectivo" });
  const [confirmado, setConfirmado] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [prods, zs] = await Promise.all([api("/public/productos"), api("/public/zonas")]);
        setProductos(prods);
        setZonas(zs.map(z => ({ barrio: z.barrio, camionId: z.camionId, nombre: z.camionNombre, color: colorDeCamion(z.camionId) })));
      } catch (e) { setError("No pudimos cargar el catálogo. Refrescá la página."); }
      setCargando(false);
    })();
  }, []);

  const totalItems = Object.values(cant).reduce((a, b) => a + b, 0);
  const totalPrecio = Object.entries(cant).reduce((sum, [id, q]) => sum + (productos.find(p => p.id === Number(id))?.precio ? Number(productos.find(p => p.id === Number(id)).precio) * q : 0), 0);
  const camionAsignado = useMemo(() => { const z = zonas.find(x => x.barrio === form.barrio); return z ? { id: z.camionId, nombre: z.nombre, color: z.color } : null; }, [form.barrio, zonas]);
  const setQty = (id, delta) => setCant(prev => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + delta) }));

  const confirmar = async () => {
    setEnviando(true); setError("");
    try {
      const items = Object.entries(cant).filter(([, q]) => q > 0).map(([id, q]) => ({ productoId: Number(id), cantidad: q }));
      const resp = await api("/public/pedidos", { method: "POST", body: { nombre: form.nombre, telefono: form.telefono, barrio: form.barrio, calle: form.calle, tipo: form.tipo, pago: form.pago, items } });
      setConfirmado(resp);
    } catch (e) { setError(e.message || "No pudimos registrar el pedido."); }
    setEnviando(false);
  };

  if (cargando) return <div className="min-h-screen flex items-center justify-center" style={{ background: c.bg }}><Cargando label="Cargando la tienda..." /></div>;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: c.bg }}>
      <div className="sticky top-0 z-10" style={{ background: `${c.bg}E6`, borderBottom: `1px solid ${c.borderSoft}`, backdropFilter: "blur(6px)" }}>
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: c.accent }}><Droplet size={14} color={c.bgAlt} fill={c.bgAlt} /></div>
          <span className="f-display text-sm font-semibold" style={{ color: c.text }}>La Hilda</span>
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
              <div className="flex justify-between f-body text-sm"><span style={{ color: c.textMuted }}>Entrega</span><span style={{ color: c.text }}>{new Date(confirmado.fechaEntrega).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</span></div>
              <div className="flex justify-between f-body text-sm items-center"><span style={{ color: c.textMuted }}>Camión asignado</span><CamionChip camion={camionAsignado} small /></div>
              <div className="h-px" style={{ background: c.border }} />
              <div className="flex justify-between f-display text-base font-semibold"><span style={{ color: c.text }}>Total</span><span style={{ color: c.accent }}>${Number(confirmado.total).toLocaleString("es-AR")}</span></div>
            </div>
            <button onClick={() => { setConfirmado(null); setStep(1); setCant({}); setForm({ nombre: "", telefono: "", barrio: "", calle: "", tipo: "casa", pago: "Efectivo" }); }} className="f-body mt-6 text-sm underline" style={{ color: c.textMuted }}>Hacer otro pedido</button>
          </div>
        ) : (
          <div className="max-w-md mx-auto px-4 py-6">
            <div className="mb-6"><p className="f-body text-xs tracking-wide uppercase" style={{ color: c.accent }}>Pedí online</p><h2 className="f-display text-2xl font-semibold" style={{ color: c.text }}>Agua para mañana</h2></div>
            <div className="flex items-center gap-2 mb-6">{[1, 2, 3].map(n => <div key={n} className="flex-1 h-1 rounded-full" style={{ background: step >= n ? c.accent : c.border }} />)}</div>
            <ErrorBanner mensaje={error} />

            {step === 1 && (
              <div className="space-y-3">
                {productos.map(p => (
                  <div key={p.id} className="rounded-2xl p-4 flex items-center gap-3" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: c.accentSoft }}><Droplet size={18} color={c.accent} /></div>
                    <div className="flex-1 min-w-0"><p className="f-body text-sm font-medium" style={{ color: c.text }}>{p.nombre}</p><p className="f-body text-xs" style={{ color: c.textFaint }}>{p.descripcion}</p><p className="f-mono text-xs mt-0.5" style={{ color: c.accent }}>${Number(p.precio).toLocaleString("es-AR")}</p></div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setQty(p.id, -1)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: c.surfaceAlt }}><Minus size={13} color={c.textMuted} /></button>
                      <span className="f-mono text-sm w-4 text-center" style={{ color: c.text }}>{cant[p.id] || 0}</span>
                      <button onClick={() => setQty(p.id, 1)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: c.accentSoft }}><Plus size={13} color={c.accent} /></button>
                    </div>
                  </div>
                ))}
                <button disabled={totalItems === 0} onClick={() => setStep(2)} className="f-body w-full mt-2 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-40" style={{ background: c.accent, color: c.bgAlt }}>Continuar ({totalItems}) <ChevronRight size={15} /></button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <Input placeholder="Nombre y apellido" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
                <Input placeholder="Teléfono" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
                <Input placeholder="Calle y altura" value={form.calle} onChange={e => setForm({ ...form, calle: e.target.value })} />
                <select value={form.barrio} onChange={e => setForm({ ...form, barrio: e.target.value })} className="f-body w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ background: c.surface, border: `1px solid ${c.border}`, color: form.barrio ? c.text : c.textFaint }}>
                  <option value="">Barrio (define tu zona de reparto)</option>
                  {zonas.map(z => <option key={z.barrio} value={z.barrio}>{z.barrio}</option>)}
                </select>
                {form.barrio && <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: c.accentSoft }}><MapPin size={14} color={c.accent} /><span className="f-body text-xs" style={{ color: c.text }}>Tu zona corresponde a</span><CamionChip camion={camionAsignado} small /></div>}
                <div><p className="f-body text-xs mb-1.5" style={{ color: c.textMuted }}>Tipo de destino</p><div className="flex gap-2">{TIPOS_LUGAR.map(t => <button key={t.id} onClick={() => setForm({ ...form, tipo: t.id })} className="f-body flex-1 py-2.5 rounded-xl text-xs flex flex-col items-center gap-1" style={{ background: form.tipo === t.id ? c.accentSoft : c.surface, border: `1px solid ${form.tipo === t.id ? c.accent : c.border}`, color: form.tipo === t.id ? c.accent : c.textMuted }}><t.Icon size={16} /> {t.label}</button>)}</div></div>
                <div><p className="f-body text-xs mb-1.5" style={{ color: c.textMuted }}>Cómo vas a pagar</p><div className="flex gap-2 flex-wrap">{PAGOS.map(p => <button key={p} onClick={() => setForm({ ...form, pago: p })} className="f-body px-3 py-2 rounded-lg text-xs" style={{ background: form.pago === p ? c.accentSoft : c.surface, border: `1px solid ${form.pago === p ? c.accent : c.border}`, color: form.pago === p ? c.accent : c.textMuted }}>{p}</button>)}</div><p className="f-body text-[11px] mt-1.5" style={{ color: c.textFaint }}>El pago se coordina con el chofer, no se procesa en la web.</p></div>
                <div className="flex gap-2 pt-1"><button onClick={() => setStep(1)} className="f-body py-3 px-4 rounded-xl text-sm" style={{ background: c.surface, color: c.textMuted, border: `1px solid ${c.border}` }}><ChevronLeft size={15} /></button><button disabled={!form.nombre || !form.barrio || !form.calle} onClick={() => setStep(3)} className="f-body flex-1 py-3 rounded-xl text-sm font-medium disabled:opacity-40" style={{ background: c.accent, color: c.bgAlt }}>Revisar pedido</button></div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <ZoneMap highlightBarrio={form.barrio} zonas={zonas} />
                <div className="rounded-2xl p-4 space-y-2.5" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
                  {Object.entries(cant).filter(([, q]) => q > 0).map(([id, q]) => { const p = productos.find(x => x.id === Number(id)); if (!p) return null; return <div key={id} className="flex justify-between f-body text-sm"><span style={{ color: c.text }}>{q}× {p.nombre}</span><span className="f-mono" style={{ color: c.textMuted }}>${(Number(p.precio) * q).toLocaleString("es-AR")}</span></div>; })}
                  <div className="h-px my-1" style={{ background: c.border }} />
                  <div className="flex justify-between f-display text-base font-semibold"><span style={{ color: c.text }}>Total</span><span style={{ color: c.accent }}>${totalPrecio.toLocaleString("es-AR")}</span></div>
                </div>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: c.amberSoft }}><CalendarClock size={15} color={c.amber} /><span className="f-body text-xs" style={{ color: c.text }}>Entrega estimada: <b>próximo día hábil</b> con {camionAsignado?.nombre}</span></div>
                <div className="flex gap-2"><button onClick={() => setStep(2)} className="f-body py-3 px-4 rounded-xl text-sm" style={{ background: c.surface, color: c.textMuted, border: `1px solid ${c.border}` }}><ChevronLeft size={15} /></button><button disabled={enviando} onClick={confirmar} className="f-body flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: c.accent, color: c.bgAlt }}>{enviando && <Spinner size={14} />} Confirmar pedido</button></div>
              </div>
            )}
          </div>
        )}
      </div>

      <button onClick={onAccesoInterno} className="f-body flex items-center justify-center gap-1.5 py-4 text-[11px] opacity-60 hover:opacity-100 transition-opacity" style={{ color: c.textFaint }}>
        <Lock size={11} /> Acceso interno
      </button>
    </div>
  );
}

/* ---------------------------------- CANDADO PREVIO AL ACCESO INTERNO ---------------------------------- */
function AccesoPrivadoGate({ onDesbloqueado, onVolver }) {
  const c = useTheme();
  const [clave, setClave] = useState("");
  const [error, setError] = useState(false);
  const validar = () => { if (clave.trim() === "") { setError(true); return; } setError(false); onDesbloqueado(); };
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: c.bgAlt }}>
      <div className="w-full max-w-sm">
        <button onClick={onVolver} className="f-body flex items-center gap-1 text-xs mb-6" style={{ color: c.textFaint }}><ChevronLeft size={13} /> Volver a la tienda</button>
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3" style={{ background: c.amberSoft }}><Lock size={20} color={c.amber} /></div>
          <h2 className="f-display text-lg font-semibold" style={{ color: c.text }}>Área privada</h2>
          <p className="f-body text-xs mt-1" style={{ color: c.textFaint }}>Ingresá la contraseña del apartado para continuar</p>
        </div>
        <div className="space-y-2.5">
          <Input placeholder="Contraseña de acceso" type="password" value={clave} onChange={e => { setClave(e.target.value); setError(false); }} onKeyDown={e => e.key === "Enter" && validar()} style={error ? { borderColor: c.danger } : {}} />
          {error && <p className="f-body text-[11px] flex items-center gap-1" style={{ color: c.danger }}><XCircle size={11} /> Ingresá una contraseña para continuar.</p>}
          <button onClick={validar} className="f-body w-full py-3 rounded-xl text-sm font-medium" style={{ background: c.accent, color: c.bgAlt }}>Continuar</button>
        </div>
        <p className="f-body text-[11px] text-center mt-4" style={{ color: c.textFaint }}>Filtro de acceso al apartado — el login real de admin/chofer que sigue después sí valida contra la base de datos.</p>
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
    if (!usuario.trim() || !pass.trim()) { setError("Completá usuario y contraseña."); return; }
    setCargando(true); setError("");
    try {
      const resp = await api(`/auth/${role}/login`, { method: "POST", body: { usuario: usuario.trim(), password: pass } });
      const payload = decodeJwt(resp.token);
      onLogin({ role, token: resp.token, nombre: resp.nombre, camion: resp.camion, camionId: payload.camionId });
    } catch (e) { setError(e.message || "Usuario o contraseña incorrectos."); }
    setCargando(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: c.bgAlt }}>
      <div className="w-full max-w-sm">
        <button onClick={onVolver} className="f-body flex items-center gap-1 text-xs mb-6" style={{ color: c.textFaint }}><ChevronLeft size={13} /> Volver a la tienda</button>
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3" style={{ background: c.accentSoft }}><Lock size={20} color={c.accent} /></div>
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
          {error && <p className="f-body text-[11px] flex items-center gap-1" style={{ color: c.danger }}><XCircle size={11} /> {error}</p>}
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
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const camionColor = colorDeCamion(session.camionId);

  const cargar = useCallback(async (mostrarSpinner) => {
    if (mostrarSpinner) setCargando(true);
    try { setPedidos(await api(`/chofer/pedidos?dia=${dia}`, { token: session.token })); setError(""); }
    catch (e) { setError("No pudimos cargar tu ruta."); }
    if (mostrarSpinner) setCargando(false);
  }, [dia, session.token]);

  useEffect(() => { cargar(true); }, [cargar]);
  useEffect(() => { const t = setInterval(() => cargar(false), 8000); return () => clearInterval(t); }, [cargar]);

  const hoyPend = dia === "hoy" ? pedidos.filter(o => o.estado === "pendiente").length : null;
  const hoyEnt = dia === "hoy" ? pedidos.filter(o => o.estado === "entregado").length : null;

  const marcar = async (id, estado) => {
    setPedidos(prev => prev.map(o => o.id === id ? { ...o, estado } : o)); // optimista
    try { await api(`/chofer/pedidos/${id}/estado`, { method: "PATCH", token: session.token, body: { estado } }); }
    catch (e) { cargar(false); } // si falla, recargo de verdad
  };

  return (
    <div className="min-h-screen" style={{ background: c.bg }}>
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${camionColor}22` }}><Truck size={16} color={camionColor} /></div>
            <div><p className="f-display text-sm font-semibold" style={{ color: c.text }}>{session.camion || "Tu camión"}</p><p className="f-body text-[11px]" style={{ color: c.textFaint }}>{session.nombre}</p></div>
          </div>
          <button onClick={onLogout} className="f-body flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs" style={{ background: c.surface, color: c.textMuted }}><LogOut size={14} /> Salir</button>
        </div>

        {dia === "hoy" && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="rounded-xl p-3" style={{ background: c.amberSoft }}><p className="f-display text-xl font-semibold" style={{ color: c.amber }}>{hoyPend}</p><p className="f-body text-xs" style={{ color: c.textMuted }}>Pendientes hoy</p></div>
            <div className="rounded-xl p-3" style={{ background: c.successSoft }}><p className="f-display text-xl font-semibold" style={{ color: c.success }}>{hoyEnt}</p><p className="f-body text-xs" style={{ color: c.textMuted }}>Entregados hoy</p></div>
          </div>
        )}

        <div className="flex rounded-xl p-1 mb-4" style={{ background: c.surface }}>
          {Object.entries(DIAS).map(([k, v]) => (
            <button key={k} onClick={() => setDia(k)} className="f-body flex-1 py-2 rounded-lg text-xs" style={{ background: dia === k ? c.accentSoft : "transparent", color: dia === k ? c.accent : c.textMuted, fontWeight: dia === k ? 600 : 400 }}>{v.label}<span className="block text-[10px] opacity-70">{v.fecha}</span></button>
          ))}
        </div>

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
                      <div><p className="f-body text-sm font-medium" style={{ color: c.text }}>{o.cliente}</p><p className="f-body text-xs flex items-center gap-1 mt-0.5" style={{ color: c.textFaint }}><MapPin size={11} /> {o.direccion}</p></div>
                    </div>
                    <EstadoBadge estado={o.estado} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    {(o.productos || []).map(p => <span key={p} className="f-body text-[11px] px-2 py-0.5 rounded-full" style={{ background: c.surfaceAlt, color: c.textMuted }}>{p}</span>)}
                    <span className="f-body text-[11px] px-2 py-0.5 rounded-full" style={{ background: c.surfaceAlt, color: c.textMuted }}>{o.pago}</span>
                  </div>
                  {dia === "hoy" && o.estado === "pendiente" && (
                    <div className="flex gap-2">
                      <button onClick={() => marcar(o.id, "entregado")} className="f-body flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1" style={{ background: c.successSoft, color: c.success }}><CheckCircle2 size={13} /> Entregado</button>
                      <button onClick={() => marcar(o.id, "no_atendido")} className="f-body flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1" style={{ background: c.dangerSoft, color: c.danger }}><XCircle size={13} /> No había nadie</button>
                    </div>
                  )}
                  {dia === "hoy" && o.estado !== "pendiente" && <button onClick={() => marcar(o.id, "pendiente")} className="f-body text-[11px] underline" style={{ color: c.textFaint }}>Revertir a pendiente</button>}
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
  const [d, setD] = useState(null);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    try { setD(await api("/admin/dashboard", { token })); setError(""); }
    catch (e) { setError("No pudimos cargar el dashboard."); }
  }, [token]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { const t = setInterval(cargar, 10000); return () => clearInterval(t); }, [cargar]);

  if (error) return <ErrorBanner mensaje={error} />;
  if (!d) return <Cargando />;

  const porCamion = (d.porCamion || []).map(x => ({ nombre: x.camion.replace("Camión ", ""), pedidos: x.pedidos, color: x.color }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Clientes totales", val: d.clientesTotales, color: c.text, Icon: Users },
          { label: "Pedidos de hoy", val: d.pedidosHoy, color: c.accent, Icon: ClipboardList },
          { label: "Ingresos del mes", val: `$${(d.ingresosMes / 1000).toFixed(0)}k`, color: c.amber, Icon: TrendingUp },
          { label: "Entrega efectiva hoy", val: `${d.tasaEntrega}%`, color: c.success, Icon: CheckCircle2 },
        ].map(k => (
          <div key={k.label} className="rounded-2xl p-4" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
            <k.Icon size={15} color={c.textFaint} className="mb-2" />
            <p className="f-display text-xl font-semibold" style={{ color: k.color }}>{k.val}</p>
            <p className="f-body text-[11px] mt-0.5" style={{ color: c.textFaint }}>{k.label}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl p-4" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
        <p className="f-body text-xs font-medium mb-3 flex items-center gap-1.5" style={{ color: c.textMuted }}><BarChart3 size={13} /> Pedidos de hoy por camión</p>
        <div style={{ height: 200 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={porCamion}><CartesianGrid strokeDasharray="3 3" stroke={c.borderSoft} vertical={false} /><XAxis dataKey="nombre" tick={{ fill: c.textFaint, fontSize: 11 }} axisLine={{ stroke: c.border }} tickLine={false} /><YAxis tick={{ fill: c.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip contentStyle={{ background: c.bgAlt, border: `1px solid ${c.border}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: c.text }} /><Bar dataKey="pedidos" radius={[6, 6, 0, 0]}>{porCamion.map((e, i) => <Cell key={i} fill={e.color} />)}</Bar></BarChart></ResponsiveContainer></div>
      </div>
      <p className="f-body text-[11px]" style={{ color: c.textFaint }}>Se actualiza solo cada 10 segundos. El histórico por rango de fechas es una mejora pendiente (necesita un endpoint nuevo en el backend).</p>
    </div>
  );
}

/* ---------------------------------- ADMIN: PEDIDOS ---------------------------------- */
function AdminPedidos({ token, camiones }) {
  const c = useTheme();
  const [q, setQ] = useState(""); const [fCamion, setFCamion] = useState("todos"); const [fEstado, setFEstado] = useState("todos"); const [fDia, setFDia] = useState("hoy");
  const [grupos, setGrupos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async (mostrarSpinner) => {
    if (mostrarSpinner) setCargando(true);
    try {
      const params = new URLSearchParams();
      if (fDia !== "todos") params.set("dia", fDia);
      if (fCamion !== "todos") params.set("camionId", fCamion);
      if (fEstado !== "todos") params.set("estado", fEstado);
      if (q) params.set("q", q);
      setGrupos(await api(`/admin/pedidos?${params.toString()}`, { token }));
      setError("");
    } catch (e) { setError("No pudimos cargar los pedidos."); }
    if (mostrarSpinner) setCargando(false);
  }, [token, fDia, fCamion, fEstado, q]);

  useEffect(() => { cargar(true); }, [cargar]);
  useEffect(() => { const t = setInterval(() => cargar(false), 10000); return () => clearInterval(t); }, [cargar]);

  const reasignar = async (id, newCamionId) => {
    try { await api(`/admin/pedidos/${id}/camion`, { method: "PATCH", token, body: { camionId: Number(newCamionId) } }); cargar(false); }
    catch (e) { setError("No se pudo reasignar el pedido."); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: c.accentSoft }}>
        <ArrowLeftRight size={14} color={c.accent} />
        <p className="f-body text-xs" style={{ color: c.text }}>Los pedidos vienen agrupados por camión y ordenados como hoja de ruta desde el servidor. Reasignalos desde el selector de cada fila.</p>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px]"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" color={c.textFaint} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar cliente..." className="f-body w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.text }} /></div>
        <Select value={fDia} onChange={e => setFDia(e.target.value)}><option value="todos">Todos los días</option><option value="ayer">Ayer</option><option value="hoy">Hoy</option><option value="manana">Mañana</option></Select>
        <Select value={fCamion} onChange={e => setFCamion(e.target.value)}><option value="todos">Todos los camiones</option>{camiones.map(cm => <option key={cm.id} value={cm.id}>{cm.nombre}</option>)}</Select>
        <Select value={fEstado} onChange={e => setFEstado(e.target.value)}><option value="todos">Todos los estados</option><option value="pendiente">Pendiente</option><option value="entregado">Entregado</option><option value="no_atendido">No había nadie</option></Select>
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
                    <thead><tr>{["Parada", "Cliente", "Barrio", "Día", "Camión", "Estado"].map(h => <th key={h} className="text-left px-4 py-2 font-medium" style={{ color: c.textFaint, borderBottom: `1px solid ${c.borderSoft}` }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {items.map(o => (
                        <tr key={o.id} style={{ borderTop: `1px solid ${c.borderSoft}` }}>
                          <td className="px-4 py-2.5"><span className="f-mono text-[11px] w-5 h-5 rounded-full inline-flex items-center justify-center" style={{ background: `${cm.color}22`, color: cm.color }}>{o.parada}</span></td>
                          <td className="px-4 py-2.5" style={{ color: c.text }}>{o.cliente}</td>
                          <td className="px-4 py-2.5" style={{ color: c.textMuted }}>{o.barrio}</td>
                          <td className="px-4 py-2.5" style={{ color: c.textMuted }}>{new Date(o.fechaEntrega).toLocaleDateString("es-AR")}</td>
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
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px]"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" color={c.textFaint} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre..." className="f-body w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.text }} /></div>
        <div className="flex items-center gap-1.5"><span className="f-body text-[11px]" style={{ color: c.textFaint }}>Último pedido</span><input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="f-body text-xs px-2 py-1.5 rounded-lg outline-none" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.text }} /><span className="f-body text-[11px]" style={{ color: c.textFaint }}>a</span><input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="f-body text-xs px-2 py-1.5 rounded-lg outline-none" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.text }} /></div>
        <button onClick={() => setOrden(orden === "desc" ? "asc" : "desc")} className="f-body flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg" style={{ background: c.surfaceAlt, color: c.textMuted, border: `1px solid ${c.border}` }}><ArrowUpDown size={12} /> Consumo</button>
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
                    <td className="px-4 py-2.5" style={{ color: c.textMuted }}>{cl.pago}</td>
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

/* ---------------------------------- ADMIN: CATÁLOGO ---------------------------------- */
function AdminCatalogo({ token }) {
  const c = useTheme();
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [nuevo, setNuevo] = useState({ nombre: "", precio: "" });

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
  const agregar = async () => {
    if (!nuevo.nombre || !nuevo.precio) return;
    try { await api("/admin/productos", { method: "POST", token, body: { nombre: nuevo.nombre, descripcion: "", precio: Number(nuevo.precio) } }); setNuevo({ nombre: "", precio: "" }); cargar(); }
    catch (e) { setError("No se pudo crear el producto."); }
  };

  if (cargando) return <Cargando />;
  return (
    <div className="space-y-4">
      <p className="f-body text-xs" style={{ color: c.textMuted }}>Estos son los productos que ve el cliente en la vidriera al hacer su pedido.</p>
      <ErrorBanner mensaje={error} />
      <div className="space-y-2">
        {productos.map(p => (
          <div key={p.id} className="rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center gap-3" style={{ background: c.surface, border: `1px solid ${c.border}`, opacity: p.activo ? 1 : 0.5 }}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: c.accentSoft }}><Package size={16} color={c.accent} /></div>
              <div className="flex-1 min-w-0"><p className="f-body text-sm font-medium" style={{ color: c.text }}>{p.nombre}</p><p className="f-body text-[11px]" style={{ color: c.textFaint }}>{p.descripcion || "—"}</p></div>
            </div>
            <div className="flex items-center gap-2 justify-between sm:justify-end shrink-0">
              <div className="flex items-center gap-1"><span className="f-mono text-xs" style={{ color: c.textFaint }}>$</span><input type="number" defaultValue={p.precio} onBlur={e => editarPrecio(p.id, e.target.value)} className="f-mono text-xs w-20 px-2 py-1.5 rounded-lg outline-none" style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.text }} /></div>
              <button onClick={() => toggleActivo(p.id, p.activo)} className="f-body text-[11px] px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap" style={{ background: p.activo ? c.successSoft : c.dangerSoft, color: p.activo ? c.success : c.danger }}>{p.activo ? "Activo" : "Oculto"}</button>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl p-3.5 flex flex-col sm:flex-row gap-2" style={{ background: c.bgAlt, border: `1px dashed ${c.border}` }}>
        <Input placeholder="Nombre del producto" value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} className="flex-1" />
        <div className="flex gap-2">
          <input type="number" placeholder="Precio" value={nuevo.precio} onChange={e => setNuevo({ ...nuevo, precio: e.target.value })} className="f-body flex-1 sm:w-24 px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.text }} />
          <button onClick={agregar} className="f-body px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center gap-1 shrink-0" style={{ background: c.accent, color: c.bgAlt }}><Plus size={14} /> Agregar</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- ADMIN: CAMIONES ---------------------------------- */
function CamionCard({ cm, zonas, todosLosCamiones, onGuardar, onAsignarZona, onQuitarZona }) {
  const c = useTheme();
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(cm.nombre);
  const [choferNombre, setChoferNombre] = useState(cm.chofer?.nombre || "");

  const misZonas = zonas.filter(z => z.camionId === cm.id);
  const disponibles = zonas.filter(z => z.camionId !== cm.id).map(z => ({ id: z.id, label: z.camionId ? `${z.barrio} — ya en ${z.camionNombre}` : z.barrio }));

  const guardar = () => { onGuardar(cm.id, { nombre: nombre.trim(), choferNombre: choferNombre.trim() }); setEditando(false); };
  const cancelar = () => { setNombre(cm.nombre); setChoferNombre(cm.chofer?.nombre || ""); setEditando(false); };

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
        {!editando && <button onClick={() => setEditando(true)} className="p-1.5 rounded-lg shrink-0" style={{ background: c.surfaceAlt }}><Pencil size={13} color={c.textMuted} /></button>}
      </div>

      {cm.chofer && <p className="f-mono text-[11px] mb-3 px-2.5 py-1.5 rounded-lg" style={{ background: c.surfaceAlt, color: c.textMuted }}>usuario: {cm.chofer.usuario}</p>}

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

      {editando ? (
        <div className="flex gap-2">
          <button onClick={guardar} className="f-body flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1" style={{ background: c.successSoft, color: c.success }}><Save size={12} /> Guardar</button>
          <button onClick={cancelar} className="f-body flex-1 py-2 rounded-lg text-xs" style={{ background: c.surfaceAlt, color: c.textMuted }}>Cancelar</button>
        </div>
      ) : <div style={{ height: 1 }} />}
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

  const guardarCamion = async (id, cambios) => { try { await api(`/admin/camiones/${id}`, { method: "PATCH", token, body: cambios }); cargar(false); } catch { setError("No se pudo guardar el camión."); } };
  const asignarZona = async (zonaId, camionId) => { try { await api(`/admin/zonas/${zonaId}/camion`, { method: "PATCH", token, body: { camionId } }); cargar(false); } catch { setError("No se pudo asignar la zona."); } };
  const quitarZona = async (zonaId) => { try { await api(`/admin/zonas/${zonaId}/camion`, { method: "PATCH", token, body: { camionId: null } }); cargar(false); } catch { setError("No se pudo soltar la zona."); } };
  const agregarZona = async (barrio) => { try { await api("/admin/zonas", { method: "POST", token, body: { barrio } }); cargar(false); } catch (e) { setError(e.message || "No se pudo crear la zona."); } };
  const renombrarZona = async (id, barrio) => { try { await api(`/admin/zonas/${id}`, { method: "PATCH", token, body: { barrio } }); cargar(false); } catch (e) { setError(e.message || "No se pudo renombrar."); } };
  const eliminarZona = async (id) => { try { await api(`/admin/zonas/${id}`, { method: "DELETE", token }); cargar(false); } catch { setError("No se pudo eliminar la zona."); } };

  const agregarCamion = async () => {
    if (!nuevo.nombre.trim() || !nuevo.choferNombre.trim() || !nuevo.usuario.trim() || !nuevo.password.trim()) { setError("Completá todos los campos del camión nuevo."); return; }
    try { await api("/admin/camiones", { method: "POST", token, body: { nombre: nuevo.nombre.trim(), choferNombre: nuevo.choferNombre.trim(), usuario: nuevo.usuario.trim(), password: nuevo.password.trim() } }); setNuevo({ nombre: "", choferNombre: "", usuario: "", password: "" }); cargar(false); }
    catch (e) { setError(e.message || "No se pudo crear el camión."); }
  };

  if (cargando) return <Cargando />;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: c.accentSoft }}>
        <MapPin size={14} color={c.accent} />
        <p className="f-body text-xs" style={{ color: c.text }}>Las zonas de cada camión son editables. La asignación automática de pedidos se actualiza al instante.</p>
      </div>
      <ErrorBanner mensaje={error} />

      <ZonasOperativas zonas={zonas} onAgregar={agregarZona} onRenombrar={renombrarZona} onEliminar={eliminarZona} />

      <div className="grid sm:grid-cols-2 gap-3">
        {camiones.map(cm => <CamionCard key={cm.id} cm={cm} zonas={zonas} todosLosCamiones={camiones} onGuardar={guardarCamion} onAsignarZona={asignarZona} onQuitarZona={quitarZona} />)}
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

/* ---------------------------------- ADMIN PANEL (sidebar) ---------------------------------- */
function AdminPanel({ session, onLogout, modo, setModo }) {
  const c = useTheme();
  const [view, setView] = useState("dashboard");
  const [camiones, setCamiones] = useState([]);

  useEffect(() => { api("/admin/camiones", { token: session.token }).then(setCamiones).catch(() => {}); }, [session.token, view]);

  const NAV = [
    { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { id: "pedidos", label: "Pedidos", Icon: ClipboardList },
    { id: "clientes", label: "Clientes", Icon: Users },
    { id: "catalogo", label: "Catálogo", Icon: Boxes },
    { id: "camiones", label: "Camiones", Icon: Truck },
  ];
  const titles = { dashboard: "Dashboard general", pedidos: "Pedidos", clientes: "Base de clientes", catalogo: "Catálogo de productos", camiones: "Camiones y zonas" };

  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: c.bg }}>
      <div className="hidden md:flex w-56 shrink-0 flex-col" style={{ background: c.bgAlt, borderRight: `1px solid ${c.borderSoft}` }}>
        <div className="flex items-center gap-2 px-4 py-4"><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: c.accent }}><Droplet size={14} color={c.bgAlt} fill={c.bgAlt} /></div><span className="f-display text-sm font-semibold" style={{ color: c.text }}>La Hilda</span></div>
        <p className="f-body text-[11px] px-4 mb-2" style={{ color: c.textFaint }}>{session.nombre}</p>
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
          <div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: c.accent }}><Droplet size={14} color={c.bgAlt} fill={c.bgAlt} /></div><span className="f-display text-sm font-semibold" style={{ color: c.text }}>La Hilda</span></div>
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
  const [view, setView] = useState("vidriera");
  const [session, setSession] = useState(null);
  const [modo, setModo] = useState("dark");
  const c = modo === "dark" ? DARK : LIGHT;

  const login = (s) => { setSession(s); setView(s.role); };
  const logout = () => { setSession(null); setView("vidriera"); };

  let contenido;
  if (view === "gate") contenido = <AccesoPrivadoGate onDesbloqueado={() => setView("login")} onVolver={() => setView("vidriera")} />;
  else if (view === "login") contenido = <LoginGate onLogin={login} onVolver={() => setView("vidriera")} />;
  else if (view === "admin" && session) contenido = <AdminPanel session={session} onLogout={logout} modo={modo} setModo={setModo} />;
  else if (view === "chofer" && session) contenido = <ChoferPanel session={session} onLogout={logout} />;
  else contenido = <ClientePortal onAccesoInterno={() => setView("gate")} />;

  return (
    <ThemeContext.Provider value={c}>
      <div className={`f-body ${modo === "dark" ? "theme-dark" : "theme-light"}`}>
        {fonts}
        {view !== "admin" && <ThemeToggleFlotante modo={modo} setModo={setModo} c={c} />}
        {contenido}
      </div>
    </ThemeContext.Provider>
  );
}
