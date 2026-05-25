import { useEffect, useMemo, useState } from "react";
import { api, API_BASE, getToken, setToken } from "../api";

const ORG_ID = import.meta.env.VITE_ORG_ID as string;

function isoDateLocal(d = new Date()) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}

export default function Booking() {
  const [branches, setBranches] = useState<any[]>([]);
  const [branchId, setBranchId] = useState<string>("");
  const [services, setServices] = useState<any[]>([]);
  const [serviceId, setServiceId] = useState<string>("");
  const [staff, setStaff] = useState<any[]>([]);
  const [staffId, setStaffId] = useState<string>(""); // "" = cualquiera
  const [date, setDate] = useState<string>(isoDateLocal());
  const [slots, setSlots] = useState<{ startAt: string; endAt: string }[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loadingSlots, setLoadingSlots] = useState(false);

  // auth for customers (simple): if no token, show register/login block
  const [mode, setMode] = useState<"login"|"register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [waOptIn, setWaOptIn] = useState(true);
  const [authErr, setAuthErr] = useState<string|null>(null);

  const authed = useMemo(() => !!getToken(), []);
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    if (getToken()) {
      api.authMe().then(r => setMe(r.user)).catch(()=>{});
    }
    if (!ORG_ID) {
      console.warn("Missing VITE_ORG_ID in frontend/.env");
      return;
    }
    api.branches(ORG_ID).then(r => {
      setBranches(r.branches);
      if (r.branches[0]) setBranchId(r.branches[0].id);
    });
  }, []);

  useEffect(() => {
    if (!branchId) return;
    api.services(branchId).then(r => {
      setServices(r.services);
      setServiceId(r.services[0]?.id ?? "");
    });
  }, [branchId]);

useEffect(() => {
  if (!branchId || !serviceId) { setStaff([]); setStaffId(""); return; }
  api.staff(branchId, serviceId).then(r => setStaff(r.staff)).catch(() => setStaff([]));
}, [branchId, serviceId]);


  async function loadSlots() {
    if (!branchId || !serviceId || !date) return;
    setLoadingSlots(true);
    setSelected("");
    try {
      const r = await api.availability(branchId, serviceId, date, staffId || undefined);
      setSlots(r.slots);
    } finally {
      setLoadingSlots(false);
    }
  }

  useEffect(() => { loadSlots(); }, [branchId, serviceId, date, staffId]);

  async function doAuth() {
    setAuthErr(null);
    try {
      if (mode === "login") {
        const r = await api.login(email, password);
        setToken(r.token);
      } else {
        const r = await api.register({ orgId: ORG_ID, fullName, email, phone, password, whatsappOptIn: waOptIn });
        setToken(r.token);
      }
      location.reload();
    } catch (e:any) {
      setAuthErr(String(e?.message ?? e));
    }
  }

  async function book() {
    if (!selected) return;
    try {
      const r = await api.createAppointment({ branchId, serviceId, staffId: staffId || undefined, startAt: selected });
      alert("✅ Reserva creada: " + r.appointment.id);
      await loadSlots();
    } catch (e:any) {
      alert("Error: " + String(e?.message ?? e));
    }
  }

  if (!ORG_ID) {
    return (
      <div className="bg-white border rounded-2xl p-6">
        <h2 className="text-xl font-bold">Falta ORG_ID</h2>
        <p className="text-sm text-slate-600 mt-2">
          En <code className="bg-slate-100 px-1 rounded">frontend/.env</code> coloca el <b>ORG_ID</b> que imprime el seed del backend.
        </p>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-white border rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-bold">Reservar</h2>
        <p className="text-sm text-slate-600 mt-1">Elige sucursal, servicio y horario disponible.</p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-sm">Sucursal</label>
            <select className="w-full border rounded-xl px-3 py-2" value={branchId} onChange={e=>setBranchId(e.target.value)}>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm">Servicio</label>
            <select className="w-full border rounded-xl px-3 py-2" value={serviceId} onChange={e=>setServiceId(e.target.value)}>
              {services.map(s => <option key={s.id} value={s.id}>{s.name} · {s.durationMin}min · Bs{s.price}</option>)}
            </select>
          </div>
<div>
  <label className="text-sm">Elegir barbero</label>
  <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
    <button
      type="button"
      onClick={() => setStaffId("")}
      className={`border rounded-2xl p-3 text-left ${staffId === "" ? "ring-2 ring-slate-900" : ""}`}
    >
      <div className="font-semibold">Cualquiera</div>
      <div className="text-xs text-slate-600">Te asignamos uno disponible</div>
    </button>
    {staff.map(s => (
      <button
        key={s.id}
        type="button"
        onClick={() => setStaffId(s.id)}
        className={`border rounded-2xl p-3 flex gap-3 items-center ${staffId === s.id ? "ring-2 ring-slate-900" : ""}`}
      >
        <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center">
          {s.photoUrl ? <img src={assetUrl(s.photoUrl)} className="w-full h-full object-cover" /> : <span className="text-xs text-slate-500">👤</span>}
        </div>
        <div>
          <div className="font-semibold">{s.name}</div>
          <div className="text-xs text-slate-600">{s.commissionPct}% comisión</div>
        </div>
      </button>
    ))}
  </div>
</div>


          <div>
            <label className="text-sm">Fecha</label>
            <input className="w-full border rounded-xl px-3 py-2" type="date" value={date} onChange={e=>setDate(e.target.value)} />
          </div>
        </div>

        <div className="mt-5">
          <div className="text-sm font-semibold mb-2">Horarios</div>
          {loadingSlots ? (
            <div className="text-sm text-slate-600">Cargando...</div>
          ) : slots.length === 0 ? (
            <div className="text-sm text-slate-600">No hay horarios disponibles para esa fecha.</div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {slots.slice(0, 24).map(s => (
                <button
                  key={s.startAt}
                  className={"border rounded-xl px-3 py-2 text-sm " + (selected === s.startAt ? "bg-slate-900 text-white" : "bg-white")}
                  onClick={() => setSelected(s.startAt)}
                >
                  {new Date(s.startAt).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}
                </button>
              ))}
            </div>
          )}
          {slots.length > 24 && <div className="text-xs text-slate-500 mt-2">Mostrando primeros 24 horarios (MVP).</div>}
        </div>

        <div className="mt-5">
          {!getToken() ? (
            <div className="text-sm text-slate-700">🔒 Inicia sesión (o regístrate) para reservar.</div>
          ) : (
            <button disabled={!selected} className="w-full rounded-xl bg-slate-900 text-white py-2 disabled:opacity-40" onClick={book}>
              Confirmar reserva
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-bold">Cuenta</h3>
        <p className="text-sm text-slate-600 mt-1">Para reservar necesitas sesión (cliente).</p>

        {!getToken() ? (
          <>
            <div className="mt-3 flex gap-2">
              <button className={"px-3 py-1 rounded-xl border " + (mode==="login"?"bg-slate-900 text-white":"")} onClick={()=>setMode("login")}>Entrar</button>
              <button className={"px-3 py-1 rounded-xl border " + (mode==="register"?"bg-slate-900 text-white":"")} onClick={()=>setMode("register")}>Registrarme</button>
            </div>

            <div className="mt-4 space-y-3">
              {mode === "register" && (
                <>
                  <div>
                    <label className="text-sm">Nombre</label>
                    <input className="w-full border rounded-xl px-3 py-2" value={fullName} onChange={e=>setFullName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm">Teléfono (para WhatsApp)</label>
                    <input className="w-full border rounded-xl px-3 py-2" value={phone} onChange={e=>setPhone(e.target.value)} />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={waOptIn} onChange={e=>setWaOptIn(e.target.checked)} />
                    Acepto recibir notificaciones por WhatsApp
                  </label>
                </>
              )}

              <div>
                <label className="text-sm">Email</label>
                <input className="w-full border rounded-xl px-3 py-2" value={email} onChange={e=>setEmail(e.target.value)} />
              </div>
              <div>
                <label className="text-sm">Password</label>
                <input className="w-full border rounded-xl px-3 py-2" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
              </div>
              {authErr && <div className="text-sm text-red-600 break-words">{authErr}</div>}
              <button className="w-full rounded-xl bg-slate-900 text-white py-2" onClick={doAuth}>
                {mode === "login" ? "Entrar" : "Crear cuenta"}
              </button>

            </div>
          </>
        ) : (
          <div className="mt-4">
            <div className="text-sm">Sesión activa ✅</div>
            {me?.loyaltyPoints !== undefined && (
              <div className="mt-2 text-sm">⭐ Puntos: <b>{me.loyaltyPoints}</b></div>
            )}
            <button className="mt-3 px-3 py-2 rounded-xl border" onClick={()=>{ setToken(null); location.reload(); }}>
              Cerrar sesión
            </button>
          </div>
        )}

        <div className="mt-6 text-xs text-slate-500">
          Tip: en Android/Chrome toca ⋮ → “Agregar a pantalla de inicio” para instalar la PWA.
        </div>
      </div>
    </div>
  );
}
