import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, API_BASE, assetUrl, getToken, setToken } from "../api";

const ORG_ID = import.meta.env.VITE_ORG_ID as string;

function onlyDigits(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "");
}

function isoDateLocal(d = new Date()) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}

function isoDateInTimeZone(d = new Date(), timeZone = "America/La_Paz") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
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
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);
  const [storeEnabled, setStoreEnabled] = useState(true);
  const [paymentQrUrl, setPaymentQrUrl] = useState<string | null>(null);
  const [paymentWhatsapp, setPaymentWhatsapp] = useState("59167794793");
  const [confirmedAppointment, setConfirmedAppointment] = useState<any>(null);

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
  const hasToken = !!getToken();
  const isCustomerSession = me?.role === "CUSTOMER";
  const loggedName = me?.fullName || me?.staffName || me?.email || "";
  const selectedBranch = useMemo(() => branches.find((branch) => branch.id === branchId), [branches, branchId]);
  const branchTimezone = selectedBranch?.timezone || "America/La_Paz";
  const today = isoDateInTimeZone(new Date(), branchTimezone);
  const visibleSlots = useMemo(
    () => slots.filter((slot) => new Date(slot.startAt).getTime() >= nowTick),
    [slots, nowTick]
  );

  useEffect(() => {
    if (getToken()) {
      api.authMe().then(r => setMe(r.user)).catch(()=>{});
    }
    if (!ORG_ID) {
      console.warn("Missing VITE_ORG_ID in frontend/.env");
      return;
    }
    api.orgPublic(ORG_ID)
      .then(r => {
        setOrgLogoUrl(r.org.logoUrl ?? null);
        setStoreEnabled(Boolean(r.org.store?.enabled ?? true));
        setPaymentQrUrl(r.org.paymentQrUrl ?? null);
        const configuredWhatsapp = onlyDigits(r.org.whatsappDisplayNumber);
        if (configuredWhatsapp) setPaymentWhatsapp(configuredWhatsapp);
      })
      .catch(() => {});
    api.branches(ORG_ID).then(r => {
      setBranches(r.branches);
      if (r.branches[0]) setBranchId(r.branches[0].id);
    });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 30 * 1000);
    return () => window.clearInterval(timer);
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

  useEffect(() => {
    if (date < today) setDate(today);
  }, [date, today]);

  useEffect(() => {
    if (selected && new Date(selected).getTime() < nowTick) {
      setSelected("");
    }
  }, [selected, nowTick]);

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

  function forgotPasswordMessage() {
    return [
      "Hola, olvide mi contraseña y necesito ayuda para restablecerla.",
      email.trim() ? `Email: ${email.trim()}` : "",
      phone.trim() ? `WhatsApp: ${phone.trim()}` : "",
      fullName.trim() ? `Nombre: ${fullName.trim()}` : "",
    ].filter(Boolean).join("\n");
  }

  async function book() {
    if (!selected) return;
    if (!isCustomerSession) {
      alert("Para confirmar una reserva necesitas iniciar sesion como cliente.");
      return;
    }
    try {
      const r = await api.createAppointment({ branchId, serviceId, staffId: staffId || undefined, startAt: selected });
      setConfirmedAppointment(r.appointment);
      setSelected("");
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
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Reservar</h2>
            <p className="text-sm text-slate-600 mt-1">Elige sucursal, servicio y horario disponible.</p>
          </div>
          {storeEnabled && (
            <Link to="/tienda" className="shrink-0 rounded-xl border px-3 py-2 text-sm font-bold">
              Tienda
            </Link>
          )}
        </div>

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
      className={`border rounded-2xl p-3 text-center ${staffId === "" ? "ring-2 ring-slate-900" : ""}`}
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-slate-100">
        <img src={orgLogoUrl ? assetUrl(orgLogoUrl) : "/bc-logo.png"} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="mt-2 font-semibold">Cualquiera</div>
    </button>
    {staff.map(s => (
      <button
        key={s.id}
        type="button"
        onClick={() => setStaffId(s.id)}
        className={`border rounded-2xl p-3 text-center ${staffId === s.id ? "ring-2 ring-slate-900" : ""}`}
      >
        <div className="mx-auto h-20 w-20 overflow-hidden rounded-full bg-slate-100 flex items-center justify-center">
          {s.photoUrl ? <img src={assetUrl(s.photoUrl)} className="w-full h-full object-cover" /> : <span className="text-xl font-bold">{String(s.name ?? "?").slice(0, 1)}</span>}
        </div>
        <div className="mt-2 font-semibold">{s.name}</div>
      </button>
    ))}
  </div>
</div>


          <div>
            <label className="text-sm">Fecha</label>
            <input className="w-full border rounded-xl px-3 py-2" type="date" min={today} value={date} onChange={e=>setDate(e.target.value)} />
          </div>
        </div>

        <div className="mt-5">
          <div className="text-sm font-semibold mb-2">Horarios</div>
          {loadingSlots ? (
            <div className="text-sm text-slate-600">Cargando...</div>
          ) : visibleSlots.length === 0 ? (
            <div className="text-sm text-slate-600">No hay horarios disponibles para esa fecha.</div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {visibleSlots.slice(0, 24).map(s => (
                <button
                  key={s.startAt}
                  className={"border rounded-xl px-3 py-2 text-sm " + (selected === s.startAt ? "bg-slate-900 text-white" : "bg-white")}
                  onClick={() => setSelected(s.startAt)}
                >
                  {new Date(s.startAt).toLocaleTimeString("es-BO", { timeZone: branchTimezone, hour: "2-digit", minute: "2-digit" })}
                </button>
              ))}
            </div>
          )}
          {visibleSlots.length > 24 && <div className="text-xs text-slate-500 mt-2">Mostrando primeros 24 horarios (MVP).</div>}
        </div>

        <div className="mt-5">
          {!hasToken ? (
            <div className="text-sm text-slate-700">🔒 Inicia sesión (o regístrate) para reservar.</div>
          ) : (
            <button disabled={!selected || !me || !isCustomerSession} className="w-full rounded-xl bg-slate-900 text-white py-2 disabled:opacity-40" onClick={book}>
              {!me ? "Verificando sesion..." : !isCustomerSession ? "Usa una cuenta de cliente" : "Confirmar reserva"}
            </button>
          )}
        </div>

        {confirmedAppointment && (
          <div className="mt-5 border border-emerald-300 bg-emerald-50 p-4">
            <div className="text-xs font-bold uppercase text-emerald-700">Reserva confirmada</div>
            <h3 className="mt-1 text-lg font-extrabold">Reserva #{confirmedAppointment.id.slice(-8).toUpperCase()}</h3>
            <p className="mt-2 text-sm text-emerald-950">
              Paga <b>Bs {confirmedAppointment.price}</b> mediante QR y envia tu comprobante para validar la reserva.
            </p>
            {paymentQrUrl ? (
              <img src={assetUrl(paymentQrUrl)} alt="QR de pago" className="mx-auto mt-4 max-h-[620px] w-full object-contain" />
            ) : (
              <div className="mt-4 border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">El QR de pago aun no fue configurado.</div>
            )}
            <a
              href={`https://wa.me/${paymentWhatsapp}?text=${encodeURIComponent(`Hola, envio el comprobante de la reserva #${confirmedAppointment.id.slice(-8).toUpperCase()} por Bs ${confirmedAppointment.price}.`)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 block bg-[#1f7a4d] px-4 py-3 text-center font-bold text-white"
            >
              Enviar comprobante
            </a>
          </div>
        )}
      </div>

      <div className="bg-white border rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-bold">Cuenta</h3>
        <p className="text-sm text-slate-600 mt-1">Para reservar necesitas sesión (cliente).</p>

        {!hasToken ? (
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
              <a
                href={`https://wa.me/${paymentWhatsapp}?text=${encodeURIComponent(forgotPasswordMessage())}`}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl border border-emerald-700 px-3 py-2 text-center text-sm font-bold text-emerald-800"
              >
                Olvide mi contraseña por WhatsApp
              </a>
              {authErr && <div className="text-sm text-red-600 break-words">{authErr}</div>}
              <button className="w-full rounded-xl bg-slate-900 text-white py-2" onClick={doAuth}>
                {mode === "login" ? "Entrar" : "Crear cuenta"}
              </button>

            </div>
          </>
        ) : (
          <div className="mt-4">
            <div className="rounded-xl border bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase text-slate-500">Sesion activa</div>
              <div className="mt-1 text-lg font-bold">{loggedName || "Usuario"}</div>
              {me?.email && <div className="text-xs text-slate-500">{me.email}</div>}
            </div>
            {me?.role && me.role !== "CUSTOMER" && (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Esta sesion es de Admin/Barbero. Para reservar, cierra sesion y entra como cliente.
              </div>
            )}
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
