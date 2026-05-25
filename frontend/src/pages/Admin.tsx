import { useEffect, useMemo, useState } from "react";
import { api, API_BASE, assetUrl, getToken, setToken } from "../api";
import { Link } from "react-router-dom";

type Tab = "agenda" | "sucursales" | "servicios" | "barberos" | "horarios" | "caja" | "pagos" | "cola" | "fidelizacion" | "ajustes" | "comisiones";

function isoDateLocal(d = new Date()) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}

export default function Admin() {
  const token = getToken();
  const [tab, setTab] = useState<Tab>("agenda");

  const [org, setOrg] = useState<any>(null);

  const [branches, setBranches] = useState<any[]>([]);
  const [branchId, setBranchId] = useState<string>("");
  const [date, setDate] = useState<string>(isoDateLocal());

  const [services, setServices] = useState<any[]>([]);
  const [branchServices, setBranchServices] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);

  const [appointments, setAppointments] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [paidToday, setPaidToday] = useState<any[]>([]);
  const [cash, setCash] = useState<any>(null);
  const [cashTotals, setCashTotals] = useState<any>(null);

  // Forms
const [branchFilter, setBranchFilter] = useState("");
const [staffFilter, setStaffFilter] = useState("");


  const [newBranchName, setNewBranchName] = useState("");
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState(50);
  const [newServiceDuration, setNewServiceDuration] = useState(30);

  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffPass, setNewStaffPass] = useState("123456");
  const [newStaffCommission, setNewStaffCommission] = useState(50);
  const [newStaffServiceIds, setNewStaffServiceIds] = useState<string[]>([]);

  const [selectedStaffId, setSelectedStaffId] = useState<string>("");

  const [openingCash, setOpeningCash] = useState(0);
  const [closingCash, setClosingCash] = useState(0);

  const [waNumber, setWaNumber] = useState("");
  const [cashPin, setCashPin] = useState("1234");

  // Empresa / impresión
  const [companyDisplayName, setCompanyDisplayName] = useState("");
  const [companyRazonSocial, setCompanyRazonSocial] = useState("");
  const [companyNit, setCompanyNit] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");

  const [printFooter, setPrintFooter] = useState("");
  const [showRS, setShowRS] = useState(true);
  const [showNIT, setShowNIT] = useState(true);
  const [showAddr, setShowAddr] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showWA, setShowWA] = useState(true);


// Portada / imágenes (Home)
const [coverDisplayMode, setCoverDisplayMode] = useState<"logo" | "name" | "both" | "none">("both");
const [coverUrl, setCoverUrl] = useState<string | null>(null);
const [orgImages, setOrgImages] = useState<any[]>([]);

  const [loyaltyEnabled, setLoyaltyEnabled] = useState(true);
  const [pointsPerBs, setPointsPerBs] = useState(1);

  async function loadOrg() {
    const r = await api.adminOrgSettings();
    setOrg(r.org);
    setWaNumber((r.org.settings?.whatsappDisplayNumber ?? "") as string);
    setCashPin(String(r.org.settings?.cashPin ?? "1234"));
const c = (r.org.settings?.company ?? {}) as any;
const p = (r.org.settings?.print ?? {}) as any;
setCompanyDisplayName(String(c.displayName ?? r.org.name ?? ""));
setCompanyRazonSocial(String(c.razonSocial ?? ""));
setCompanyNit(String(c.nit ?? ""));
setCompanyAddress(String(c.address ?? ""));
setCompanyPhone(String(c.phone ?? ""));
setCompanyEmail(String(c.email ?? ""));

setPrintFooter(String(p.footerText ?? ""));
setShowRS(Boolean(p.showRazonSocial ?? true));
setShowNIT(Boolean(p.showNit ?? true));
setShowAddr(Boolean(p.showAddress ?? false));
setShowPhone(Boolean(p.showPhone ?? false));
setShowEmail(Boolean(p.showEmail ?? false));
setShowWA(Boolean(p.showWhatsapp ?? true));
    setLoyaltyEnabled(Boolean(r.org.settings?.loyalty?.enabled ?? false));
    setPointsPerBs(Number(r.org.settings?.loyalty?.pointsPerBs ?? 0));

// Branding / portada
const b = (r.org.settings?.branding ?? {}) as any;
setCoverDisplayMode((b.displayMode ?? "both") as any);
setCoverUrl((b.coverUrl ?? null) as any);

// Carpeta de imágenes (portada)
try {
  const imgs = await api.adminOrgImages();
  setOrgImages(imgs.images ?? []);
  setCoverUrl((imgs.coverUrl ?? null) as any);
  setCoverDisplayMode((imgs.displayMode ?? b.displayMode ?? "both") as any);
} catch {}

  }

  async function loadCore() {
    await loadOrg();
    const b = await api.adminBranches();
    setBranches(b.branches);
    if (b.branches[0]) setBranchId(b.branches[0].id);

    const s = await api.adminServices();
    setServices(s.services);

    const st = await api.adminStaff();
    setStaff(st.staff);
  }

  useEffect(() => {
    if (!token) return;
    loadCore().catch(console.error);
  }, [token]);

  async function loadAgenda() {
    if (!branchId) return;
    const r = await api.adminAppointments(branchId, date);
    setAppointments(r.appointments);
  }

  async function loadBranchServices() {
    if (!branchId) return;
    const r = await api.adminBranchServices(branchId);
    setBranchServices(r.services);
  }

  async function loadQueue() {
    if (!branchId) return;
    const r = await api.queueTickets(branchId);
    setQueue(r.tickets);
  }

  async function loadPaidToday() {
    if (!branchId) return;
    const r = await api.queuePaidAppointments(branchId, date);
    setPaidToday(r.paidAppointments);
  }

  async function loadCash() {
    if (!branchId) return;
    const r = await api.cashCurrent(branchId);
    setCash(r.session);
    setCashTotals(r.totals ?? null);
  }

  useEffect(() => {
    if (!token || !branchId) return;
    loadAgenda().catch(console.error);
    loadBranchServices().catch(console.error);
    loadQueue().catch(console.error);
    loadPaidToday().catch(console.error);
    loadCash().catch(console.error);
  }, [token, branchId, date]);

  if (!token) {
    return (
      <div className="bg-white border rounded-2xl p-6">
        <h2 className="text-xl font-bold">Necesitas iniciar sesión</h2>
        <p className="text-sm text-slate-600 mt-2">Entra con tu usuario admin para usar el panel.</p>
        <Link className="underline" to="/login">Ir a Login</Link>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "agenda", label: "Agenda" },
    { id: "pagos", label: "Pagos" },
    { id: "caja", label: "Caja" },
    { id: "comisiones", label: "Comisiones" },
    { id: "cola", label: "Cola / Walk-ins" },
    { id: "sucursales", label: "Sucursales" },
    { id: "servicios", label: "Servicios" },
    { id: "barberos", label: "Barberos" },
    { id: "horarios", label: "Horarios" },
    { id: "fidelizacion", label: "Fidelización" },
    { id: "ajustes", label: "Ajustes" },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 overflow-hidden flex items-center justify-center">
              {org?.logoUrl ? <img src={assetUrl(org.logoUrl)} className="w-full h-full object-cover" /> : <span className="text-xl">💈</span>}
            </div>
            <div>
              <div className="text-xl font-bold">{org?.name ?? "Admin"}</div>
              <div className="text-xs text-slate-600">Multi-sucursal • PWA</div>
            </div>
          </div>

          <div className="flex gap-2">
            <select className="border rounded-xl p-2" value={branchId} onChange={e => setBranchId(e.target.value)}>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <input type="date" className="border rounded-xl p-2" value={date} onChange={e => setDate(e.target.value)} />
            <button className="border rounded-xl px-3" onClick={() => { setToken(null); location.href = "/"; }}>Salir</button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`px-3 py-2 rounded-xl border ${tab === t.id ? "bg-slate-900 text-white" : "bg-white"}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "agenda" && (
        <div className="bg-white border rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-bold">Agenda</h2>
          <p className="text-sm text-slate-600 mt-1">Reservas del día por sucursal.</p>
          <div className="mt-4 space-y-2">
            {appointments.map(a => (
              <div key={a.id} className="border rounded-2xl p-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{new Date(a.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — {a.service?.name}</div>
                  <div className="text-sm text-slate-600">{a.customer?.fullName} • {a.staff?.displayName}</div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-slate-100">{a.status}</span>
              </div>
            ))}
            {appointments.length === 0 && <div className="text-sm text-slate-600">Sin reservas.</div>}
          </div>
        </div>
      )}

      {tab === "pagos" && (
  <PaymentsPanel org={org} branches={branches} branchId={branchId} date={date} />
)}


      {tab === "caja" && (
  <CashProPanel branchId={branchId} branches={branches} org={org} />
)}


      {tab === "cola" && (
        <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-xl font-bold">Cola / Walk-ins</h2>
            <p className="text-sm text-slate-600 mt-1">Gestiona turnos sin reserva y pantalla "En espera".</p>
            <button className="mt-3 border rounded-xl px-3 py-2 text-sm" onClick={() => { loadQueue(); loadPaidToday(); }}>Refrescar</button>
          </div>

          {/* Reservas Pagadas */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-violet-500"></div>
              <h3 className="font-bold text-base">Reservas Pagadas — {date}</h3>
              <span className="text-xs bg-violet-100 text-violet-700 rounded-full px-2 py-0.5 font-semibold">{paidToday.length}</span>
            </div>
            {paidToday.length === 0 && <div className="text-sm text-slate-500 italic">Sin reservas pagadas para esta fecha.</div>}
            <div className="space-y-2">
              {paidToday.map((a: any) => {
                const hasTicket = a.ticketNumber != null;
                return (
                  <div key={a.id} className="border-2 border-violet-300 bg-violet-50 rounded-2xl p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`text-2xl font-extrabold w-14 text-center shrink-0 ${hasTicket ? "text-violet-700" : "text-violet-300"}`}>
                        {hasTicket ? `#${a.ticketNumber}` : "—"}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold truncate">{a.customerName}</div>
                        <div className="text-xs text-slate-600 truncate">{a.serviceName} · {a.staffName}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                          {a.startAt && <span className="font-semibold text-violet-700">{new Date(a.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
                          <span className="font-mono text-slate-400">Reserva #{a.appointmentId.slice(-6).toUpperCase()}</span>
                        </div>
                      </div>
                    </div>
                    <span className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-bold ${hasTicket ? "bg-violet-600 text-white" : "bg-violet-100 text-violet-700 border border-violet-300"}`}>
                      {hasTicket ? "En cola" : "Pendiente turno"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cola activa */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <h3 className="font-bold text-base">Cola activa</h3>
              <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-semibold">{queue.length}</span>
            </div>
            <div className="space-y-2">
              {queue.map((t: any) => {
                const isAppt = !!t.fromAppointment;
                return (
                  <div key={t.id} className={`rounded-2xl p-3 flex items-center justify-between gap-3 ${isAppt ? "border-2 border-violet-400 bg-violet-50" : "border border-slate-200 bg-white"}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`text-2xl font-extrabold w-10 text-center shrink-0 ${isAppt ? "text-violet-700" : "text-slate-900"}`}>#{t.n}</div>
                      <div className="min-w-0">
                        <div className="font-bold truncate flex items-center gap-1">
                          {t.name}
                          {isAppt && <span className="text-xs bg-violet-600 text-white rounded-full px-1.5 py-0.5 font-bold">RESERVA</span>}
                        </div>
                        <div className="text-xs text-slate-600 truncate">{t.service} · {t.staff ?? "Sin barbero"}</div>
                        {isAppt && t.scheduledAt && <div className="text-xs text-violet-700 font-semibold">{new Date(t.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>}
                      </div>
                    </div>
                    <select className="border rounded-xl p-2 text-sm shrink-0" value={t.status} onChange={async e => { await api.queueUpdateTicket(t.id, e.target.value); await loadQueue(); }}>
                      <option value="WAITING">WAITING</option>
                      <option value="CALLED">CALLED</option>
                      <option value="IN_CHAIR">IN_CHAIR</option>
                      <option value="DONE">DONE</option>
                      <option value="CANCELED">CANCELED</option>
                    </select>
                  </div>
                );
              })}
              {queue.length === 0 && <div className="text-sm text-slate-500 italic">Sin turnos activos.</div>}
            </div>
          </div>
        </div>
      )}

{tab === "sucursales" && (
  <div className="bg-white border rounded-2xl p-6 shadow-sm">
    <h2 className="text-xl font-bold">Sucursales</h2>
    <p className="text-sm text-slate-600 mt-1">Crea, edita, selecciona y elimina sucursales.</p>

    <div className="mt-5 grid lg:grid-cols-2 gap-4">
      {/* Lista */}
      <div className="border rounded-2xl p-4">
        <div className="font-semibold">Listado</div>

        <div className="mt-3">
          <input className="border rounded-xl p-2 w-full" placeholder="Buscar sucursal..." value={branchFilter} onChange={e => setBranchFilter(e.target.value)} />
        </div>

        <div className="mt-3 flex gap-2">
          <input className="border rounded-xl p-2 flex-1" placeholder="Nombre sucursal" value={newBranchName} onChange={e => setNewBranchName(e.target.value)} />
          <button className="bg-slate-900 text-white rounded-xl px-4 py-2" onClick={async () => {
            if (!newBranchName.trim()) return;
            await api.adminCreateBranch({ name: newBranchName, address: "", timezone: "America/La_Paz" });
            setNewBranchName("");
            const b = await api.adminBranches();
            setBranches(b.branches);
          }}>Crear</button>
        </div>

        <div className="mt-4 space-y-2">
          {branches.filter(b => !branchFilter.trim() || b.name.toLowerCase().includes(branchFilter.trim().toLowerCase())).map(b => (
            <div key={b.id} className={`border rounded-2xl p-3 flex items-center justify-between ${branchId === b.id ? "ring-2 ring-slate-900" : ""}`}>
              <div>
                <div className="font-semibold">{b.name}</div>
                <div className="text-xs text-slate-600">{b.address || "—"} • {b.timezone || "America/La_Paz"}</div>
              </div>
              <div className="flex gap-2">
                <button className="border rounded-xl px-3 py-2" onClick={() => setBranchId(b.id)}>Seleccionar</button>
                <button className="border rounded-xl px-3 py-2" onClick={async () => {
                  if (!confirm(`¿Eliminar sucursal "${b.name}"?`)) return;
                  try {
                    await api.adminDeleteBranch(b.id);
                    const bb = await api.adminBranches();
                    setBranches(bb.branches);
                    if (branchId === b.id && bb.branches[0]) setBranchId(bb.branches[0].id);
                  } catch (e:any) {
                    alert(e.message || "No se pudo eliminar");
                  }
                }}>Eliminar</button>
              </div>
            </div>
          ))}
          {branches.length === 0 && <div className="text-sm text-slate-600">No hay sucursales.</div>}
        </div>
      </div>

      {/* Editor */}
      <div className="border rounded-2xl p-4">
        <div className="font-semibold">Editar sucursal seleccionada</div>
        {(() => {
          const b = branches.find(x => x.id === branchId);
          if (!b) return <div className="text-sm text-slate-600 mt-3">Selecciona una sucursal.</div>;
          return (
            <div className="mt-3 space-y-3">
              <div>
                <label className="text-sm font-semibold">Nombre</label>
                <input className="border rounded-xl p-2 w-full mt-1" value={b.name} onChange={e => setBranches(prev => prev.map(x => x.id===b.id ? { ...x, name: e.target.value } : x))} />
              </div>
              <div>
                <label className="text-sm font-semibold">Dirección</label>
                <input className="border rounded-xl p-2 w-full mt-1" value={b.address ?? ""} onChange={e => setBranches(prev => prev.map(x => x.id===b.id ? { ...x, address: e.target.value } : x))} />
              </div>
              <div>
                <label className="text-sm font-semibold">Zona horaria</label>
                <input className="border rounded-xl p-2 w-full mt-1" placeholder="America/La_Paz" value={b.timezone ?? ""} onChange={e => setBranches(prev => prev.map(x => x.id===b.id ? { ...x, timezone: e.target.value } : x))} />
              </div>

              <button className="bg-slate-900 text-white rounded-xl px-4 py-2" onClick={async () => {
                try {
                  await api.adminUpdateBranch(b.id, { name: b.name, address: b.address, timezone: b.timezone });
                  const bb = await api.adminBranches();
                  setBranches(bb.branches);
                  alert("✅ Guardado");
                } catch (e:any) {
                  alert(e.message || "No se pudo guardar");
                }
              }}>Guardar cambios</button>
            </div>
          );
        })()}
      </div>
    </div>
  </div>
)}


{tab === "servicios" && (
  <div className="bg-white border rounded-2xl p-6 shadow-sm">
    <h2 className="text-xl font-bold">Servicios</h2>
    <p className="text-sm text-slate-600 mt-1">Crea, edita y elimina servicios base. Luego actívalos por sucursal con precio personalizado.</p>

    <div className="mt-5 grid lg:grid-cols-2 gap-4">
      {/* Base services CRUD */}
      <div className="border rounded-2xl p-4">
        <div className="font-semibold">Servicios base</div>

        <div className="mt-3 grid md:grid-cols-4 gap-2">
          <input className="border rounded-xl p-2 md:col-span-2" placeholder="Nombre" value={newServiceName} onChange={e => setNewServiceName(e.target.value)} />
          <input type="number" className="border rounded-xl p-2" placeholder="Precio" value={newServicePrice} onChange={e => setNewServicePrice(Number(e.target.value))} />
          <input type="number" className="border rounded-xl p-2" placeholder="Duración" value={newServiceDuration} onChange={e => setNewServiceDuration(Number(e.target.value))} />
          <button className="bg-slate-900 text-white rounded-xl px-4 py-2 md:col-span-4 disabled:opacity-50" disabled={!newServiceName.trim() || newServiceDuration<=0 || newServicePrice<0} onClick={async () => {
            if (!newServiceName.trim()) return;
            await api.adminCreateService({ name: newServiceName, basePrice: newServicePrice, durationMin: newServiceDuration });
            setNewServiceName("");
            const s = await api.adminServices();
            setServices(s.services);
            await loadBranchServices();
          }}>Crear servicio</button>
        </div>

        <div className="mt-4 space-y-2">
          {services.map(s => (
            <div key={s.id} className="border rounded-2xl p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <input className="border rounded-xl p-2 w-full" value={s.name} onChange={e => setServices(prev => prev.map(x => x.id===s.id ? { ...x, name: e.target.value } : x))} />
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input type="number" className="border rounded-xl p-2" value={s.basePrice} onChange={e => setServices(prev => prev.map(x => x.id===s.id ? { ...x, basePrice: Number(e.target.value) } : x))} />
                    <input type="number" className="border rounded-xl p-2" value={s.durationMin} onChange={e => setServices(prev => prev.map(x => x.id===s.id ? { ...x, durationMin: Number(e.target.value) } : x))} />
                  </div>
                  <div className="text-xs text-slate-600 mt-1">Precio base (Bs) • Duración (min)</div>
                </div>

                <div className="flex flex-col gap-2">
                  <button className="border rounded-xl px-3 py-2" onClick={async () => {
                    try {
                      await api.adminUpdateService(s.id, { name: s.name, basePrice: s.basePrice, durationMin: s.durationMin });
                      const ss = await api.adminServices();
                      setServices(ss.services);
                      await loadBranchServices();
                      alert("✅ Guardado");
                    } catch (e:any) { alert(e.message || "No se pudo guardar"); }
                  }}>Guardar</button>

                  <button className="border rounded-xl px-3 py-2" onClick={async () => {
                    if (!confirm(`¿Eliminar servicio "${s.name}"?`)) return;
                    try {
                      await api.adminDeleteService(s.id);
                      const ss = await api.adminServices();
                      setServices(ss.services);
                      await loadBranchServices();
                    } catch (e:any) { alert(e.message || "No se pudo eliminar"); }
                  }}>Eliminar</button>
                </div>
              </div>
            </div>
          ))}
          {services.length === 0 && <div className="text-sm text-slate-600">Sin servicios.</div>}
        </div>
      </div>

      {/* Branch activation */}
      <div className="border rounded-2xl p-4">
        <div className="font-semibold">Activar en sucursal seleccionada</div>
        <p className="text-sm text-slate-600 mt-1">Sucursal actual: <b>{branches.find(b => b.id === branchId)?.name ?? branchId}</b></p>

        <div className="mt-3 space-y-2">
          {branchServices.map(s => (
            <div key={s.id} className="border rounded-2xl p-3 flex items-center justify-between">
              <div>
                <div className="font-semibold">{s.name}</div>
                <div className="text-xs text-slate-600">Base: {s.basePrice} Bs • Duración: {s.durationMin} min</div>
              </div>
              <div className="flex gap-2 items-center">
                <label className="text-xs">Habilitado</label>
                <input type="checkbox" checked={!!s.enabled} onChange={async e => { await api.adminUpdateBranchService(branchId, s.id, { enabled: e.target.checked, priceOverride: s.priceOverride }); await loadBranchServices(); }} />
                <input type="number" className="border rounded-xl p-2 w-28" placeholder="Precio" value={s.priceOverride ?? ""} onChange={e => {
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  setBranchServices(prev => prev.map(x => x.id === s.id ? { ...x, priceOverride: v } : x));
                }} />
                <button className="border rounded-xl px-3 py-2" onClick={async () => { await api.adminUpdateBranchService(branchId, s.id, { enabled: !!s.enabled, priceOverride: s.priceOverride }); await loadBranchServices(); }}>Guardar</button>
              </div>
            </div>
          ))}
          {branchServices.length === 0 && <div className="text-sm text-slate-600">Sin servicios. Crea uno a la izquierda.</div>}
        </div>
      </div>
    </div>
  </div>
)}


{tab === "barberos" && (
  <div className="bg-white border rounded-2xl p-6 shadow-sm">
    <h2 className="text-xl font-bold">Barberos</h2>
    <p className="text-sm text-slate-600 mt-1">Crea, edita, asigna servicios, sube foto y elimina barberos.</p>

    <div className="mt-5 grid lg:grid-cols-2 gap-4">
      {/* Crear */}
      <div className="border rounded-2xl p-4">
        <div className="font-semibold">Crear barbero</div>

        <div className="grid md:grid-cols-4 gap-2 mt-3">
          <input className="border rounded-xl p-2 md:col-span-2" placeholder="Nombre" value={newStaffName} onChange={e => setNewStaffName(e.target.value)} />
          <input type="number" className="border rounded-xl p-2" placeholder="% comisión" value={newStaffCommission} onChange={e => setNewStaffCommission(Number(e.target.value))} />
          <select className="border rounded-xl p-2" value={branchId} onChange={e => setBranchId(e.target.value)}>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>

          <input className="border rounded-xl p-2 md:col-span-2" placeholder="Email" value={newStaffEmail} onChange={e => setNewStaffEmail(e.target.value)} />
          <input className="border rounded-xl p-2 md:col-span-2" placeholder="Password" value={newStaffPass} onChange={e => setNewStaffPass(e.target.value)} />
        </div>

        <div className="mt-3">
          <div className="text-sm font-semibold">Servicios que atiende</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {services.map(s => (
              <button
                key={s.id}
                type="button"
                className={`border rounded-xl px-3 py-2 text-sm ${newStaffServiceIds.includes(s.id) ? "bg-slate-900 text-white" : ""}`}
                onClick={() => setNewStaffServiceIds(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id])}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        <button className="mt-4 bg-slate-900 text-white rounded-xl px-4 py-2 disabled:opacity-50" disabled={!newStaffName.trim() || !newStaffEmail.trim() || newStaffCommission<0 || newStaffCommission>100 || (newStaffPass && newStaffPass.length>0 && newStaffPass.length<6)} onClick={async () => {
          if (!newStaffName.trim() || !newStaffEmail.trim()) return alert("Nombre y email");
          await api.adminCreateStaff({
            branchId,
            displayName: newStaffName,
            email: newStaffEmail,
            phone: "",
            password: newStaffPass,
            commissionPct: newStaffCommission,
            serviceIds: newStaffServiceIds,
          });
          setNewStaffName(""); setNewStaffEmail(""); setNewStaffServiceIds([]);
          const st = await api.adminStaff();
          setStaff(st.staff);
          alert("✅ Creado");
        }}>Crear barbero</button>
      </div>

      {/* Lista + Editor */}
      <div className="border rounded-2xl p-4">
        <div className="font-semibold">Listado y edición</div>

        <div className="mt-3">
          <input className="border rounded-xl p-2 w-full" placeholder="Buscar barbero..." value={staffFilter} onChange={e => setStaffFilter(e.target.value)} />
        </div>

        <div className="mt-3 space-y-2 max-h-[55vh] overflow-y-auto pr-2">
          {staff.filter(s => !staffFilter.trim() || s.displayName.toLowerCase().includes(staffFilter.trim().toLowerCase())).map(s => (
            <div key={s.id} className={`border rounded-2xl p-3 ${selectedStaffId === s.id ? "ring-2 ring-slate-900" : ""}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center">
                    {s.photoUrl ? <img src={assetUrl(s.photoUrl)} className="w-full h-full object-cover" /> : "👤"}
                  </div>
                  <div>
                    <div className="font-semibold">{s.displayName}</div>
                    <div className="text-xs text-slate-600">{s.email} • {s.commissionPct}%</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="border rounded-xl px-3 py-2" onClick={() => setSelectedStaffId(s.id)}>Editar</button>
                  <button className="border rounded-xl px-3 py-2" onClick={() => { setSelectedStaffId(s.id); setTab("horarios"); }}>Horarios</button>
                </div>
              </div>

              {selectedStaffId === s.id && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold">Nombre</label>
                      <input className="border rounded-xl p-2 w-full mt-1" value={s.displayName} onChange={e => setStaff(prev => prev.map(x => x.id===s.id ? { ...x, displayName: e.target.value } : x))} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold">% comisión</label>
                      <input type="number" className="border rounded-xl p-2 w-full mt-1" value={s.commissionPct} onChange={e => setStaff(prev => prev.map(x => x.id===s.id ? { ...x, commissionPct: Number(e.target.value) } : x))} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold">Sucursal</label>
                      <select className="border rounded-xl p-2 w-full mt-1" value={s.branchId} onChange={e => setStaff(prev => prev.map(x => x.id===s.id ? { ...x, branchId: e.target.value } : x))}>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold">Teléfono</label>
                      <input className="border rounded-xl p-2 w-full mt-1" value={s.phone ?? ""} onChange={e => setStaff(prev => prev.map(x => x.id===s.id ? { ...x, phone: e.target.value } : x))} />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-semibold">Email</label>
                      <input className="border rounded-xl p-2 w-full mt-1" value={s.email} onChange={e => setStaff(prev => prev.map(x => x.id===s.id ? { ...x, email: e.target.value } : x))} />
                      <div className="text-[11px] text-slate-500 mt-1">Cambiar email requiere guardar (si está duplicado, fallará).</div>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-semibold">Reset password (opcional)</label>
                      <input className="border rounded-xl p-2 w-full mt-1" placeholder="Nuevo password (mín 6)" onChange={e => setStaff(prev => prev.map(x => x.id===s.id ? { ...x, _newPass: e.target.value } : x))} />
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold">Servicios asignados</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {services.map(sv => (
                        <button
                          key={sv.id}
                          type="button"
                          className={`border rounded-xl px-3 py-2 text-xs ${s.serviceIds?.includes(sv.id) ? "bg-slate-900 text-white" : ""}`}
                          onClick={() => setStaff(prev => prev.map(x => {
                            if (x.id !== s.id) return x;
                            const ids = x.serviceIds || [];
                            const next = ids.includes(sv.id) ? ids.filter((a:any) => a !== sv.id) : [...ids, sv.id];
                            return { ...x, serviceIds: next };
                          }))}
                        >
                          {sv.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 items-center">
                    <input type="file" accept=".jpg,.jpeg,.png,.bmp,.webp,image/jpeg,image/png,image/bmp,image/webp" className="text-xs" onChange={async e => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        await api.adminUploadStaffPhoto(s.id, f);
                        const st = await api.adminStaff();
                        setStaff(st.staff);
                      } catch (e:any) {
                        alert(e.message || "No se pudo subir la foto");
                      } finally {
                        e.currentTarget.value = "";
                      }
                    }} />

                    <button className="bg-slate-900 text-white rounded-xl px-4 py-2" onClick={async () => {
                      try {
                        await api.adminUpdateStaff(s.id, {
                          branchId: s.branchId,
                          displayName: s.displayName,
                          commissionPct: s.commissionPct,
                          serviceIds: s.serviceIds ?? [],
                          email: s.email,
                          phone: s.phone,
                          password: (s as any)._newPass || undefined,
                        });
                        const st = await api.adminStaff();
                        setStaff(st.staff);
                        alert("✅ Guardado");
                      } catch (e:any) { alert(e.message || "No se pudo guardar"); }
                    }}>Guardar</button>

                    <button className="border rounded-xl px-4 py-2" onClick={async () => {
                      if (!confirm(`¿Eliminar barbero "${s.displayName}"?`)) return;
                      try {
                        await api.adminDeleteStaff(s.id);
                        const st = await api.adminStaff();
                        setStaff(st.staff);
                        if (selectedStaffId === s.id) setSelectedStaffId("");
                      } catch (e:any) { alert(e.message || "No se pudo eliminar"); }
                    }}>Eliminar</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {staff.length === 0 && <div className="text-sm text-slate-600">No hay barberos.</div>}
        </div>
      </div>
    </div>
  </div>
)}


{tab === "horarios" && (
        <AvailabilityEditor staffId={selectedStaffId} staff={staff} onPickStaff={setSelectedStaffId} />
      )}

      {tab === "fidelizacion" && (
        <div className="bg-white border rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-bold">Fidelización por puntos</h2>
          <p className="text-sm text-slate-600 mt-1">Configura puntos por Bs pagado. Se suma al cobrar.</p>

          <div className="mt-4 flex items-center gap-3">
            <label className="text-sm">Activo</label>
            <input type="checkbox" checked={loyaltyEnabled} onChange={e => setLoyaltyEnabled(e.target.checked)} />
            <label className="text-sm ml-4">Puntos por Bs</label>
            <input type="number" className="border rounded-xl p-2 w-24" value={pointsPerBs} onChange={e => setPointsPerBs(Number(e.target.value))} />
            <button className="bg-slate-900 text-white rounded-xl px-4 py-2" onClick={async () => {
              await api.adminUpdateOrgSettings({ loyalty: { enabled: loyaltyEnabled, pointsPerBs } });
              await loadOrg();
              alert("✅ Guardado");
            }}>Guardar</button>
          </div>
        </div>
      )}

      {tab === "comisiones" && (
  <CommissionsPanel org={org} branches={branches} staff={staff} />
)}

{tab === "ajustes" && (
        <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-xl font-bold">Ajustes</h2>
            <p className="text-sm text-slate-600 mt-1">Logo, WhatsApp y otros parámetros.</p>
          </div>

          <div className="border rounded-2xl p-4">
            <div className="font-semibold">Logo de la barbería</div>
            <div className="mt-2 flex gap-2 items-center">
              <input type="file" accept=".jpg,.jpeg,.png,.bmp,.webp,image/jpeg,image/png,image/bmp,image/webp" onChange={async e => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  await api.adminUploadOrgLogo(f);
                  await loadOrg();
                } catch (e:any) {
                  alert(e.message || "No se pudo subir el logo");
                } finally {
                  e.currentTarget.value = "";
                }
              }} />
              {org?.logoUrl && <a className="underline text-sm" href={`${API_BASE}${org.logoUrl}`} target="_blank">Ver</a>}
            </div>
          

<div className="border rounded-2xl p-4 space-y-4">
  <div>
    <div className="font-semibold">Portada de la App</div>
    <p className="text-sm text-slate-600 mt-1">Sube imágenes (JPG, JPEG, PNG, BMP o WEBP), elige una como portada y define si se muestra el logo, el nombre, ambos o ninguno.</p>
  </div>

  <div className="grid md:grid-cols-2 gap-3">
    <div>
      <div className="text-sm font-semibold">Mostrar en portada</div>
      <select className="border rounded-xl p-2 w-full mt-1" value={coverDisplayMode} onChange={async (e) => {
        const v = e.target.value as any;
        setCoverDisplayMode(v);
        await api.adminSetOrgCover(coverUrl, v);
        await loadOrg();
      }}>
        <option value="both">Logo + Nombre</option>
        <option value="logo">Solo Logo</option>
        <option value="name">Solo Nombre</option>
        <option value="none">Nada</option>
      </select>
    </div>

    <div>
      <div className="text-sm font-semibold">Subir imagen</div>
      <input type="file" className="mt-1" accept=".jpg,.jpeg,.png,.bmp,image/jpeg,image/png,image/bmp" onChange={async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        try {
          await api.adminUploadOrgImage(f);
          const imgs = await api.adminOrgImages();
          setOrgImages(imgs.images ?? []);
        } catch (err: any) {
          alert(err?.message ?? "Error al subir imagen");
        } finally {
          (e.target as any).value = "";
        }
      }} />
    </div>
  </div>

  <div className="text-sm">
    <span className="font-semibold">Portada actual:</span>{" "}
    {coverUrl ? <a className="underline" href={`${API_BASE}${coverUrl}`} target="_blank">Ver</a> : <span className="text-slate-500">No seleccionada</span>}
  </div>

  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    {orgImages.map((img) => {
      const selected = coverUrl === img.url || coverUrl === img.coverUrl || (coverUrl && img.coverUrl && coverUrl.endsWith(img.coverUrl));
      return (
        <div key={img.filename} className={`border rounded-2xl overflow-hidden ${selected ? "ring-2 ring-slate-900" : ""}`}>
          <img src={assetUrl(img.url)} className="w-full h-28 object-cover" />
          <div className="p-2 flex gap-2">
            <button className="text-xs bg-slate-900 text-white rounded-lg px-2 py-1" onClick={async () => {
              await api.adminSetOrgCover(img.url, coverDisplayMode);
              const imgs = await api.adminOrgImages();
              setCoverUrl((imgs.coverUrl ?? null) as any);
              setOrgImages(imgs.images ?? []);
            }}>{selected ? "Seleccionada" : "Usar"}</button>

            <button className="text-xs border rounded-lg px-2 py-1" onClick={async () => {
              if (!confirm("¿Eliminar esta imagen?")) return;
              await api.adminDeleteOrgImage(img.filename);
              const imgs = await api.adminOrgImages();
              setCoverUrl((imgs.coverUrl ?? null) as any);
              setOrgImages(imgs.images ?? []);
            }}>Eliminar</button>
          </div>
        </div>
      );
    })}
  </div>

  {orgImages.length === 0 && <div className="text-sm text-slate-600">Aún no subiste imágenes.</div>}
</div>
</div>

          <div className="border rounded-2xl p-4">
            <div className="font-semibold">WhatsApp (número visible)</div>
            <p className="text-sm text-slate-600 mt-1">Este número se incluye en mensajes como “WhatsApp: …”.</p>
            <div className="mt-2 flex gap-2">
              <input className="border rounded-xl p-2 w-72" placeholder="+5917..." value={waNumber} onChange={e => setWaNumber(e.target.value)} />
              <button className="bg-slate-900 text-white rounded-xl px-4 py-2" onClick={async () => { await api.adminUpdateOrgSettings({ whatsappDisplayNumber: waNumber }); await loadOrg(); alert("✅ Guardado"); }}>Guardar</button>
            </div>
          </div>

<div className="border rounded-2xl p-4 space-y-3">
  <div className="font-semibold">PIN de caja (anular pagos)</div>
  <p className="text-sm text-slate-600">Se pide al anular un pago. Por defecto: 1234</p>
  <div className="flex gap-2 items-center">
    <input className="border rounded-xl p-2 w-40" value={cashPin} onChange={e => setCashPin(e.target.value)} />
    <button className="bg-slate-900 text-white rounded-xl px-4 py-2" onClick={async () => {
      await api.adminUpdateOrgSettings({ cashPin });
      await loadOrg();
      alert("✅ Guardado");
    }}>Guardar</button>
  </div>
</div>

<div className="border rounded-2xl p-4 space-y-4">
  <div>
    <div className="font-semibold">Datos de empresa</div>
    <p className="text-sm text-slate-600 mt-1">Se usan en tickets y reportes (facturación).</p>
  </div>

  <div className="grid md:grid-cols-2 gap-3">
    <div>
      <div className="text-sm font-semibold">Nombre comercial</div>
      <input className="border rounded-xl p-2 w-full" value={companyDisplayName} onChange={e => setCompanyDisplayName(e.target.value)} placeholder="Barbería X" />
    </div>
    <div>
      <div className="text-sm font-semibold">Razón Social</div>
      <input className="border rounded-xl p-2 w-full" value={companyRazonSocial} onChange={e => setCompanyRazonSocial(e.target.value)} placeholder="Barbería X S.R.L." />
    </div>
    <div>
      <div className="text-sm font-semibold">NIT</div>
      <input className="border rounded-xl p-2 w-full" value={companyNit} onChange={e => setCompanyNit(e.target.value)} placeholder="0000000000" />
    </div>
    <div>
      <div className="text-sm font-semibold">Dirección (empresa)</div>
      <input className="border rounded-xl p-2 w-full" value={companyAddress} onChange={e => setCompanyAddress(e.target.value)} placeholder="Av. ..." />
    </div>
    <div>
      <div className="text-sm font-semibold">Teléfono</div>
      <input className="border rounded-xl p-2 w-full" value={companyPhone} onChange={e => setCompanyPhone(e.target.value)} placeholder="+591..." />
    </div>
    <div>
      <div className="text-sm font-semibold">Email</div>
      <input className="border rounded-xl p-2 w-full" value={companyEmail} onChange={e => setCompanyEmail(e.target.value)} placeholder="info@..." />
    </div>
  </div>

  <div>
    <button className="bg-slate-900 text-white rounded-xl px-4 py-2" onClick={async () => {
      await api.adminUpdateOrgSettings({
        company: {
          displayName: companyDisplayName,
          razonSocial: companyRazonSocial,
          nit: companyNit,
          address: companyAddress,
          phone: companyPhone,
          email: companyEmail,
        }
      });
      await loadOrg();
      alert("✅ Guardado");
    }}>Guardar datos de empresa</button>
  </div>
</div>

<div className="border rounded-2xl p-4 space-y-4">
  <div>
    <div className="font-semibold">Impresión / Ticket</div>
    <p className="text-sm text-slate-600 mt-1">Configura qué campos aparecen en tickets y reportes.</p>
  </div>

  <div>
    <div className="text-sm font-semibold">Pie de página (texto libre)</div>
    <textarea className="border rounded-xl p-2 w-full h-24" value={printFooter} onChange={e => setPrintFooter(e.target.value)} placeholder="Ej: Gracias por su preferencia" />
    <div className="text-xs text-slate-500 mt-1">Si lo dejas vacío, se usa “Gracias por tu visita 💈”.</div>
  </div>

  <div className="grid md:grid-cols-3 gap-2">
    <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={showRS} onChange={e => setShowRS(e.target.checked)} /> Mostrar Razón Social</label>
    <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={showNIT} onChange={e => setShowNIT(e.target.checked)} /> Mostrar NIT</label>
    <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={showAddr} onChange={e => setShowAddr(e.target.checked)} /> Mostrar Dirección empresa</label>
    <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={showPhone} onChange={e => setShowPhone(e.target.checked)} /> Mostrar Teléfono</label>
    <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={showEmail} onChange={e => setShowEmail(e.target.checked)} /> Mostrar Email</label>
    <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={showWA} onChange={e => setShowWA(e.target.checked)} /> Mostrar WhatsApp</label>
  </div>

  <div>
    <button className="bg-slate-900 text-white rounded-xl px-4 py-2" onClick={async () => {
      await api.adminUpdateOrgSettings({
        print: {
          footerText: printFooter,
          showRazonSocial: showRS,
          showNit: showNIT,
          showAddress: showAddr,
          showPhone: showPhone,
          showEmail: showEmail,
          showWhatsapp: showWA,
        }
      });
      await loadOrg();
      alert("✅ Guardado");
    }}>Guardar configuración de impresión</button>
  </div>
</div>
        </div>
      )}
    </div>
  );
}

function PaymentRow({ org, branch, appt, onPaid }: { org: any; branch: any; appt: any; onPaid: () => Promise<void> }) {
  const [method, setMethod] = useState<"QR" | "CASH" | "MIXED">("QR");
  const [total, setTotal] = useState<number>(appt.price || appt.service?.basePrice || 0);
  const [cash, setCash] = useState<number>(0);
  const [qr, setQr] = useState<number>(total);
  const [paying, setPaying] = useState(false);

  const hasPayment = !!appt.payment && appt.payment.status !== "VOID";
  const isVoid = !!appt.payment && appt.payment.status === "VOID";

  useEffect(() => {
    if (method === "CASH") { setCash(total); setQr(0); }
    if (method === "QR") { setQr(total); setCash(0); }
    if (method === "MIXED") { const c = Math.floor(total / 2); setCash(c); setQr(total - c); }
  }, [method, total]);

  async function charge() {
    if (paying) return;
    setPaying(true);
    try {
      await api.createPayment({ appointmentId: appt.id, method, amountTotal: total, amountCash: cash, amountQr: qr });
      alert("✅ Pago registrado");
      await onPaid();
    } catch (e: any) {
      if (e?.status === 409) {
        alert("⚠️ Esta cita ya tiene un pago registrado.");
        await onPaid();
      } else {
        alert("Error: " + String(e?.message ?? e));
      }
    } finally {
      setPaying(false);
    }
  }

  async function voidPayment() {
  const pin = prompt("PIN para anular pago:");
  if (!pin) return;
  const reason = prompt("Motivo de anulación (obligatorio):");
  if (!reason || reason.trim().length < 3) return alert("Motivo requerido");
  try {
    await api.voidPayment(appt.payment.id, pin, reason.trim());
    alert("✅ Pago anulado");
    await onPaid();
  } catch (e: any) {
    alert("Error: " + String(e?.message ?? e));
  }
}


function printReceipt() {
  if (!appt.payment) return;
  const w = window.open("", "_blank");
  if (!w) return;

const settings = (org?.settings ?? {}) as any;
const company = (settings.company ?? {}) as any;
const pr = (settings.print ?? {}) as any;

const orgName = String(company.displayName ?? org?.name ?? "Barbería");
const logoUrl = org?.logoUrl ? `${API_BASE}${org.logoUrl}` : null;
const wa = String(settings.whatsappDisplayNumber ?? "");
const branchName = branch?.name ?? "";
const branchAddr = branch?.address ?? "";

const rs = String(company.razonSocial ?? "");
const nit = String(company.nit ?? "");
const phone = String(company.phone ?? "");
const email = String(company.email ?? "");
const companyAddr = String(company.address ?? "");

const showRS = Boolean(pr.showRazonSocial ?? true);
const showNIT = Boolean(pr.showNit ?? true);
const showAddr = Boolean(pr.showAddress ?? false);
const showPhone = Boolean(pr.showPhone ?? false);
const showEmail = Boolean(pr.showEmail ?? false);
const showWA = Boolean(pr.showWhatsapp ?? true);

const footerText = String(pr.footerText ?? "").trim();
const footerLines = [
  footerText || "",
  showWA && wa ? `WhatsApp: ${wa}` : "",
].filter(Boolean);

  const p = appt.payment;
  const dt = p.paidAt ? new Date(p.paidAt) : new Date();
  const time = dt.toLocaleString();
  const ticketNo = String(p.id ?? "").slice(-8).toUpperCase();

  const methodLabel = p.method === "CASH" ? "Efectivo" : p.method === "QR" ? "QR" : "Mixto";
  const footer = footerLines.length ? footerLines.join("<br/>") : "";

  w.document.write(`
    <html><head><title>Ticket</title><meta charset="utf-8"/>
    <style>
      body{font-family:Arial, sans-serif; color:#111; margin:0; padding:0}
      .ticket{width:80mm; padding:10px 10px 18px 10px}
      .center{text-align:center}
      .logo{width:48px;height:48px;object-fit:contain;margin:0 auto 6px auto;display:block}
      .title{font-size:14px;font-weight:800}
      .sub{font-size:11px;color:#444}
      .line{border-top:1px dashed #999;margin:8px 0}
      .row{display:flex;justify-content:space-between;font-size:12px;margin:3px 0}
      .big{font-size:12px;font-weight:800}
      .footer{margin-top:10px;font-size:10px;color:#555}
    </style></head><body>
      <div class="ticket">
        <div class="center">
          ${logoUrl ? `<img class="logo" src="${logoUrl}" />` : `<div style="font-size:26px">💈</div>`}
          <div class="title">${orgName}</div>
          ${showRS && rs ? `<div class="sub">Razón Social: ${rs}</div>` : ``}
          ${showNIT && nit ? `<div class="sub">NIT: ${nit}</div>` : ``}
          <div class="sub">Sucursal: ${branchName}${branchAddr ? " - " + branchAddr : ""}</div>
          ${showAddr && companyAddr ? `<div class="sub">${companyAddr}</div>` : ``}
          ${showPhone && phone ? `<div class="sub">Tel: ${phone}</div>` : ``}
          ${showEmail && email ? `<div class="sub">${email}</div>` : ``}
          <div class="sub">Ticket de pago</div>
        </div>
        <div class="line"></div>
        <div class="row"><span>Ticket</span><span class="big">${ticketNo}</span></div>
        <div class="row"><span>Fecha</span><span>${time}</span></div>
        <div class="line"></div>
        <div class="row"><span>Cliente</span><span>${appt.customer?.fullName ?? ""}</span></div>
        <div class="row"><span>Servicio</span><span>${appt.service?.name ?? ""}</span></div>
        <div class="row"><span>Barbero</span><span>${appt.staff?.displayName ?? ""}</span></div>
        <div class="line"></div>
        <div class="row"><span>Método</span><span class="big">${methodLabel}</span></div>
        <div class="row"><span>Total</span><span class="big">${p.amountTotal}</span></div>
        ${p.amountCash ? `<div class="row"><span>Efectivo</span><span>${p.amountCash}</span></div>` : ``}
        ${p.amountQr ? `<div class="row"><span>QR</span><span>${p.amountQr}</span></div>` : ``}
        ${p.qrReference ? `<div class="row"><span>Ref</span><span>${p.qrReference}</span></div>` : ``}
        <div class="line"></div>
        <div class="footer center">
          <div>${footer}</div>
          <div>${footerText ? "" : "Gracias por tu visita 💈"}</div>
        </div>
        <script>window.print();</script>
      </div>
    </body></html>
  `);
  w.document.close();
}

  return (
    <div className="border rounded-2xl p-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <div className="font-semibold">
            {new Date(appt.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — {appt.service?.name}
          </div>
          <div className="text-sm text-slate-600">{appt.customer?.fullName} • {appt.staff?.displayName}</div>
          <div className="text-xs text-slate-500">Estado: {appt.status}</div>
          {appt.payment && (
            <div className="text-xs text-slate-600 mt-1">
              Pago: {appt.payment.method} • Total {appt.payment.amountTotal} (Cash {appt.payment.amountCash} / QR {appt.payment.amountQr}) • {appt.payment.status}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <select className="border rounded-xl p-2" value={method} onChange={e => setMethod(e.target.value as any)} disabled={hasPayment || paying}>
            <option value="QR">QR</option>
            <option value="CASH">Efectivo</option>
            <option value="MIXED">Mixto</option>
          </select>
          <input type="number" className="border rounded-xl p-2 w-28" value={total} onChange={e => setTotal(Number(e.target.value))} disabled={hasPayment || paying} />
          {method === "MIXED" && (
            <>
              <input type="number" className="border rounded-xl p-2 w-24" title="Efectivo" value={cash} onChange={e => setCash(Number(e.target.value))} disabled={hasPayment || paying} />
              <input type="number" className="border rounded-xl p-2 w-24" title="QR" value={qr} onChange={e => setQr(Number(e.target.value))} disabled={hasPayment || paying} />
            </>
          )}

          <button
            className="bg-slate-900 text-white rounded-xl px-4 py-2 disabled:opacity-50"
            disabled={paying || hasPayment}
            onClick={charge}
          >
            {hasPayment ? "Ya pagado" : (paying ? "Procesando..." : "Cobrar")}
          </button>

          {hasPayment && (
            <div className="flex gap-2 items-center">
              <button className="border rounded-xl px-3 py-2" onClick={printReceipt}>Ticket</button>
              <button className="border rounded-xl px-3 py-2" onClick={voidPayment}>Anular</button>
            </div>
          )}
          {isVoid && (
            <div className="text-xs text-slate-500">
              Anulado{appt.payment?.voidReason ? ` • Motivo: ${appt.payment.voidReason}` : ""}{appt.payment?.voidedBy?.email ? ` • Por: ${appt.payment.voidedBy.email}` : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CashProPanel({ branchId, branches, org }: { branchId: string; branches: any[]; org: any }) {
  const [from, setFrom] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate()-7);
    return d.toISOString().slice(0,10);
  });
  const [to, setTo] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [sessions, setSessions] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [report, setReport] = useState<any | null>(null);
  const [openingCash, setOpeningCash] = useState<number>(0);
  const [countedCash, setCountedCash] = useState<number>(0);
  const [movementAmount, setMovementAmount] = useState<number>(0);
  const [movementReason, setMovementReason] = useState<string>("");
  const [movementType, setMovementType] = useState<"IN"|"OUT">("IN");

  async function loadSessions() {
    const r = await api.cashSessions({ branchId, from, to });
    setSessions(r.sessions);
    if (selected) {
      const still = r.sessions.find((s: any) => s.id === selected.id);
      setSelected(still ?? null);
    }
  }

  useEffect(() => { if (branchId) loadSessions().catch(()=>{}); }, [branchId, from, to]);

  async function openCash() {
    await api.cashOpen(branchId, openingCash);
    await loadSessions();
  }

  async function closeCash(sessionId: string) {
    await api.cashClose(branchId, countedCash, "Cierre desde Admin");
    await loadSessions();
  }

  async function loadReport(sessionId: string) {
    const r = await api.cashSessionReport(sessionId);
    setReport(r);
  }

  function printReport() {
  if (!report) return;
  const w = window.open("", "_blank");
  if (!w) return;

  const s = report.summary;
  const settings = (report.session?.org?.settings ?? org?.settings ?? {}) as any;
  const company = (settings.company ?? {}) as any;
  const pr = (settings.print ?? {}) as any;
  const orgName = String(company.displayName ?? report.session?.org?.name ?? org?.name ?? "Barbería");
  const rs = String(company.razonSocial ?? "");
  const nit = String(company.nit ?? "");
  const phone = String(company.phone ?? "");
  const email = String(company.email ?? "");
  const companyAddr = String(company.address ?? "");
  const showRS = Boolean(pr.showRazonSocial ?? true);
  const showNIT = Boolean(pr.showNit ?? true);
  const showAddr = Boolean(pr.showAddress ?? false);
  const showPhone = Boolean(pr.showPhone ?? false);
  const showEmail = Boolean(pr.showEmail ?? false);
  const showWA = Boolean(pr.showWhatsapp ?? true);
  const wa = String(settings.whatsappDisplayNumber ?? "");
  const footerText = String(pr.footerText ?? "").trim();

  const logoUrl = report.session?.org?.logoUrl ?? org?.logoUrl ?? null;

  const footer = footerLines.length ? footerLines.join("<br/>") : "";

  const branchLine = `${report.session.branch.name}${report.session.branch.address ? " • " + report.session.branch.address : ""}`;

  const payRows = (report.payments ?? [])
    .map((p: any) => `
      <tr>
        <td>${new Date(p.paidAt).toLocaleString()}</td>
        <td>${p.method}</td>
        <td style="text-align:right">${p.amountTotal}</td>
        <td style="text-align:right">${p.amountCash}</td>
        <td style="text-align:right">${p.amountQr}</td>
        <td>${p.service}</td>
        <td>${p.staff}</td>
      </tr>`).join("");

  const movRows = (report.movements ?? [])
    .map((m: any) => `
      <tr>
        <td>${new Date(m.createdAt).toLocaleString()}</td>
        <td>${m.type}</td>
        <td style="text-align:right">${m.amount}</td>
        <td>${m.reason}</td>
      </tr>`).join("");

  w.document.write(`
    <html><head><title>Cierre de Caja</title>
    <meta charset="utf-8"/>
    <style>
      body{font-family:Arial, sans-serif; padding:24px; color:#0f172a}
      .header{display:flex; align-items:center; gap:12px; margin-bottom:12px}
      .logo{width:56px; height:56px; object-fit:contain}
      .org{font-size:20px; font-weight:800}
      .sub{font-size:12px; color:#475569}
      .box{border:1px solid #e2e8f0; border-radius:14px; padding:12px; margin:10px 0}
      table{width:100%; border-collapse:collapse}
      th,td{border:1px solid #e2e8f0; padding:6px; font-size:12px}
      th{background:#f8fafc; text-align:left}
      .grid{display:grid; grid-template-columns:1fr 1fr; gap:10px}
      .kpi{font-size:12px}
      .kpi b{font-size:14px}
      .footer{margin-top:16px; font-size:11px; color:#64748b}
      @media print{
        body{padding:0}
        .noPrint{display:none}
      }
    </style></head><body>
    <div class="header">
      ${logoUrl ? `<img class="logo" src="${API_BASE}${logoUrl}" />` : `<div style="width:56px;height:56px;border:1px solid #e2e8f0;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800;">💈</div>`}
      <div>
        <div class="org">${orgName}</div>
        ${showRS && rs ? `<div class="sub">Razón Social: <b>${rs}</b></div>` : ``}
        ${showNIT && nit ? `<div class="sub">NIT: <b>${nit}</b></div>` : ``}
        ${showAddr && companyAddr ? `<div class="sub">${companyAddr}</div>` : ``}
        ${showPhone && phone ? `<div class="sub">Tel: ${phone}</div>` : ``}
        ${showEmail && email ? `<div class="sub">${email}</div>` : ``}
        <div class="sub">${branchLine}</div>
        <div class="sub">Sesión: <b>${report.session.id}</b> • Estado: <b>${report.session.status}</b></div>
        <div class="sub">Abrió: <b>${new Date(report.session.openedAt).toLocaleString()}</b> ${report.session.closedAt ? `• Cerró: <b>${new Date(report.session.closedAt).toLocaleString()}</b>` : ""}</div>
      </div>
    </div>

    <div class="box">
      <div class="grid">
        <div class="kpi">Apertura efectivo: <b>${s.openingCash}</b></div>
        <div class="kpi">Mov IN: <b>${s.movIn}</b> / Mov OUT: <b>${s.movOut}</b></div>
        <div class="kpi">Cash (pagos): <b>${s.cashFromPayments}</b> • QR (pagos): <b>${s.qrFromPayments}</b></div>
        <div class="kpi">Total ventas: <b>${s.totalSales}</b></div>
        <div class="kpi">Efectivo esperado: <b>${s.expectedCash}</b></div>
        <div class="kpi">Efectivo contado: <b>${s.counted ?? ""}</b> • Diff: <b>${s.diff ?? ""}</b></div>
      </div>
    </div>

    <div class="box">
      <div style="font-weight:800; margin-bottom:6px">Movimientos</div>
      <table>
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Monto</th><th>Motivo</th></tr></thead>
        <tbody>${movRows || `<tr><td colspan="4" style="color:#64748b">Sin movimientos.</td></tr>`}</tbody>
      </table>
    </div>

    <div class="box">
      <div style="font-weight:800; margin-bottom:6px">Pagos</div>
      <table>
        <thead><tr><th>Fecha</th><th>Método</th><th>Total</th><th>Cash</th><th>QR</th><th>Servicio</th><th>Barbero</th></tr></thead>
        <tbody>${payRows || `<tr><td colspan="7" style="color:#64748b">Sin pagos.</td></tr>`}</tbody>
      </table>
    </div>

    <div class="footer">
      ${footer ? `<div>${footer}</div>` : ``}
      <div>Generado: ${new Date().toLocaleString()}</div>
    </div>
    <script>window.print();</script>
    </body></html>
  `);
  w.document.close();
}

function printTicket() {
  if (!report) return;
  const w = window.open("", "_blank");
  if (!w) return;

  const s = report.summary;
  const settings = (report.session?.org?.settings ?? org?.settings ?? {}) as any;
  const company = (settings.company ?? {}) as any;
  const pr = (settings.print ?? {}) as any;
  const orgName = String(company.displayName ?? report.session?.org?.name ?? org?.name ?? "Barbería");
  const rs = String(company.razonSocial ?? "");
  const nit = String(company.nit ?? "");
  const phone = String(company.phone ?? "");
  const email = String(company.email ?? "");
  const companyAddr = String(company.address ?? "");
  const showRS = Boolean(pr.showRazonSocial ?? true);
  const showNIT = Boolean(pr.showNit ?? true);
  const showAddr = Boolean(pr.showAddress ?? false);
  const showPhone = Boolean(pr.showPhone ?? false);
  const showEmail = Boolean(pr.showEmail ?? false);
  const showWA = Boolean(pr.showWhatsapp ?? true);
  const wa = String(settings.whatsappDisplayNumber ?? "");
  const footerText = String(pr.footerText ?? "").trim();

  const logoUrl = report.session?.org?.logoUrl ?? org?.logoUrl ?? null;


  const branchLine = `${report.session.branch.name}${report.session.branch.address ? " - " + report.session.branch.address : ""}`;

  w.document.write(`
    <html><head><title>Ticket Cierre</title><meta charset="utf-8"/>
    <style>
      body{font-family:Arial, sans-serif; color:#111; margin:0; padding:0}
      .ticket{width:80mm; padding:10px 10px 18px 10px}
      .center{text-align:center}
      .logo{width:48px;height:48px;object-fit:contain;margin:0 auto 6px auto;display:block}
      .title{font-size:14px;font-weight:800}
      .sub{font-size:11px;color:#444}
      .line{border-top:1px dashed #999;margin:8px 0}
      .row{display:flex;justify-content:space-between;font-size:12px;margin:3px 0}
      .big{font-size:12px;font-weight:800}
      .footer{margin-top:10px;font-size:10px;color:#555}
    </style></head><body>
      <div class="ticket">
        <div class="center">
          ${logoUrl ? `<img class="logo" src="${API_BASE}${logoUrl}" />` : `<div style="font-size:26px">💈</div>`}
          <div class="title">${orgName}</div>
          ${showRS && rs ? `<div class="sub">Razón Social: ${rs}</div>` : ``}
          ${showNIT && nit ? `<div class="sub">NIT: ${nit}</div>` : ``}
          <div class="sub">${branchLine}</div>
          <div class="sub">Ticket de cierre</div>
        </div>
        <div class="line"></div>
        <div class="row"><span>Sesión</span><span class="big">${report.session.id.slice(-8)}</span></div>
        <div class="row"><span>Abrió</span><span>${new Date(report.session.openedAt).toLocaleString()}</span></div>
        ${report.session.closedAt ? `<div class="row"><span>Cerró</span><span>${new Date(report.session.closedAt).toLocaleString()}</span></div>` : ``}
        <div class="line"></div>
        <div class="row"><span>Total ventas</span><span class="big">${s.totalSales}</span></div>
        <div class="row"><span>QR</span><span>${s.qrFromPayments}</span></div>
        <div class="row"><span>Efectivo (pagos)</span><span>${s.cashFromPayments}</span></div>
        <div class="row"><span>Mov IN</span><span>${s.movIn}</span></div>
        <div class="row"><span>Mov OUT</span><span>${s.movOut}</span></div>
        <div class="row"><span>Esperado cash</span><span class="big">${s.expectedCash}</span></div>
        <div class="row"><span>Contado cash</span><span class="big">${s.counted ?? ""}</span></div>
        <div class="row"><span>Diff</span><span class="big">${s.diff ?? ""}</span></div>
        <div class="line"></div>
        <div class="footer center">
          <div>${wa ? `WhatsApp: ${wa}` : ""}</div>
          <div>Gracias por tu trabajo 💪</div>
          <div>${new Date().toLocaleString()}</div>
        </div>
        <script>window.print();</script>
      </div>
    </body></html>
  `);
  w.document.close();
}

async function addMovement() {
    if (!movementReason.trim() || movementAmount <= 0) return alert("Completa motivo y monto");
    await api.cashAddMovement({ branchId, type: movementType, amount: movementAmount, reason: movementReason });
    setMovementAmount(0); setMovementReason("");
    await loadSessions();
    if (selected) await loadReport(selected.id);
  }

  const openSession = sessions.find((s: any) => s.status === "OPEN");

  return (
    <div className="bg-white border rounded-2xl p-6 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Caja Pro</h2>
          <p className="text-sm text-slate-600 mt-1">Historial de sesiones, movimientos y reporte imprimible.</p>
        </div>
        <div className="flex gap-2 items-center">
          <label className="text-sm">Desde</label>
          <input type="date" className="border rounded-xl p-2" value={from} onChange={e=>setFrom(e.target.value)} />
          <label className="text-sm">Hasta</label>
          <input type="date" className="border rounded-xl p-2" value={to} onChange={e=>setTo(e.target.value)} />
          <button className="border rounded-xl px-3 py-2" onClick={loadSessions}>Refrescar</button>
        </div>
      </div>

      <div className="mt-5 grid md:grid-cols-2 gap-4">
        <div className="border rounded-2xl p-4">
          <div className="font-semibold">Sesiones</div>
          <div className="mt-3 space-y-2 max-h-[420px] overflow-auto">
            {sessions.map((s: any) => (
              <button key={s.id} className={`w-full text-left border rounded-xl p-3 ${selected?.id===s.id ? "bg-slate-900 text-white" : ""}`} onClick={async ()=>{ setSelected(s); await loadReport(s.id); }}>
                <div className="text-sm font-semibold">{new Date(s.openedAt).toLocaleString()} • {s.status}</div>
                <div className="text-xs">Cash: {s.summary.cashFromPayments} • QR: {s.summary.qrFromPayments} • Total: {s.summary.totalSales}</div>
              </button>
            ))}
            {sessions.length===0 && <div className="text-sm text-slate-600">Sin sesiones.</div>}
          </div>

          <div className="mt-4 border-t pt-4">
            <div className="font-semibold">Apertura / Cierre</div>
            <div className="mt-2 flex flex-wrap gap-2 items-center">
              <input type="number" className="border rounded-xl p-2 w-28" placeholder="Opening" value={openingCash} onChange={e=>setOpeningCash(Number(e.target.value))} />
              <button className="bg-slate-900 text-white rounded-xl px-3 py-2" disabled={!!openSession} onClick={openCash}>Abrir</button>
              <input type="number" className="border rounded-xl p-2 w-28" placeholder="Contado" value={countedCash} onChange={e=>setCountedCash(Number(e.target.value))} />
              <button className="border rounded-xl px-3 py-2" disabled={!openSession} onClick={()=> openSession && closeCash(openSession.id)}>Cerrar</button>
            </div>
            {openSession && <div className="text-xs text-slate-600 mt-2">Sesión abierta: {openSession.id}</div>}
          </div>

          <div className="mt-4 border-t pt-4">
            <div className="font-semibold">Movimiento de caja</div>
            <div className="mt-2 flex flex-wrap gap-2 items-center">
              <select className="border rounded-xl p-2" value={movementType} onChange={e=>setMovementType(e.target.value as any)}>
                <option value="IN">IN</option>
                <option value="OUT">OUT</option>
              </select>
              <input type="number" className="border rounded-xl p-2 w-28" placeholder="Monto" value={movementAmount} onChange={e=>setMovementAmount(Number(e.target.value))} />
              <input className="border rounded-xl p-2 flex-1 min-w-[180px]" placeholder="Motivo" value={movementReason} onChange={e=>setMovementReason(e.target.value)} />
              <button className="bg-slate-900 text-white rounded-xl px-3 py-2" onClick={addMovement}>Guardar</button>
            </div>
          </div>
        </div>

        <div className="border rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Reporte</div>
            <div className="flex gap-2"><button className="border rounded-xl px-3 py-2" disabled={!report} onClick={printTicket}>Ticket</button><button className="border rounded-xl px-3 py-2" disabled={!report} onClick={printReport}>Reporte</button></div>
          </div>
          {!report && <div className="text-sm text-slate-600 mt-3">Selecciona una sesión para ver reporte.</div>}
          {report && (
            <div className="mt-3 space-y-2">
              <div className="text-sm">Sucursal: <b>{report.session.branch.name}</b></div>
              <div className="text-sm">Estado: <b>{report.session.status}</b></div>
              <div className="text-sm">Opening cash: <b>{report.summary.openingCash}</b></div>
              <div className="text-sm">Cash pagos: <b>{report.summary.cashFromPayments}</b> • QR pagos: <b>{report.summary.qrFromPayments}</b></div>
              <div className="text-sm">Mov IN: <b>{report.summary.movIn}</b> • Mov OUT: <b>{report.summary.movOut}</b></div>
              <div className="text-sm">Expected cash: <b>{report.summary.expectedCash}</b></div>
              {report.summary.counted !== null && <div className="text-sm">Counted: <b>{report.summary.counted}</b> • Diff: <b>{report.summary.diff}</b></div>}
              <div className="mt-3 text-sm font-semibold">Pagos: {report.payments.length}</div>
              <div className="max-h-[320px] overflow-auto border rounded-xl">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="p-2 text-left">Hora</th>
                      <th className="p-2 text-left">Método</th>
                      <th className="p-2 text-right">Total</th>
                      <th className="p-2 text-right">Cash</th>
                      <th className="p-2 text-right">QR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.payments.map((p: any) => (
                      <tr key={p.id} className="border-t">
                        <td className="p-2">{new Date(p.paidAt).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}</td>
                        <td className="p-2">{p.method}{p.status==="VOID" ? " (VOID)" : ""}</td>
                        <td className="p-2 text-right">{p.amountTotal}</td>
                        <td className="p-2 text-right">{p.amountCash}</td>
                        <td className="p-2 text-right">{p.amountQr}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PaymentsPanel({ org, branches, branchId, date }: { org: any; branches: any[]; branchId: string; date: string }) {
  const [appts, setAppts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!branchId) return;
    setLoading(true);
    try {
      const r = await api.adminAppointments(branchId, date);
      setAppts(r.appointments);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load().catch(()=>{}); }, [branchId, date]);

  return (
    <div className="bg-white border rounded-2xl p-6 shadow-sm">
      <h2 className="text-xl font-bold">Pagos</h2>
      <p className="text-sm text-slate-600 mt-1">Cobra, ve pago existente y anula con PIN.</p>

      <div className="mt-4 space-y-3">
        {loading && <div className="text-sm text-slate-600">Cargando...</div>}
        {appts.map((a: any) => (
          <PaymentRow org={org} branch={branches.find((b:any)=>b.id===branchId)} appt={a} onPaid={load} />
        ))}
        {appts.length===0 && !loading && <div className="text-sm text-slate-600">No hay reservas para este día.</div>}
      </div>
    </div>
  );
}

function CommissionsPanel({ org, branches, staff }: { org: any; branches: any[]; staff: any[] }) {
  const [from, setFrom] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate()-14);
    return d.toISOString().slice(0,10);
  });
  const [to, setTo] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [branchId, setBranchId] = useState<string>("");
  const [staffId, setStaffId] = useState<string>("");
  const [rows, setRows] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>(null);

  async function load() {
    const r = await api.commissionsReport({ from, to, branchId: branchId || undefined, staffId: staffId || undefined });
    setRows(r.rows);
    setTotals(r.totals);
  }

  useEffect(() => { load().catch(()=>{}); }, [from, to, branchId, staffId]);

  function exportPdf() {
  const w = window.open("", "_blank");
  if (!w) return;

  const orgName = org?.name ?? "Barbería";
  const logoUrl = org?.logoUrl ? `${API_BASE}${org.logoUrl}` : null;
  const wa = org?.settings?.whatsappDisplayNumber ?? "";
  const branchName = branches.find((b:any)=>b.id===branchId)?.name ?? "Todas";
  const staffName = staff.find((s:any)=>s.id===staffId)?.displayName ?? "Todos";

  const bodyRows = rows.map((r: any) => `<tr><td>${r.staffName}</td><td style="text-align:right">${r.count}</td><td style="text-align:right">${r.amount}</td></tr>`).join("");

  w.document.write(`<html><head><title>Comisiones</title><meta charset="utf-8"/>
    <style>
      body{font-family:Arial, sans-serif; padding:24px; color:#0f172a}
      .header{display:flex; align-items:center; gap:12px; margin-bottom:12px}
      .logo{width:56px; height:56px; object-fit:contain}
      .org{font-size:20px; font-weight:800}
      .sub{font-size:12px; color:#475569}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{border:1px solid #e2e8f0;padding:6px;font-size:12px}
      th{background:#f8fafc;text-align:left}
      .footer{margin-top:14px;font-size:11px;color:#64748b}
    </style>
    </head><body>
      <div class="header">
        ${logoUrl ? `<img class="logo" src="${logoUrl}" />` : `<div style="width:56px;height:56px;border:1px solid #e2e8f0;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800;">💈</div>`}
        <div>
          <div class="org">${orgName}</div>
        ${showRS && rs ? `<div class="sub">Razón Social: <b>${rs}</b></div>` : ``}
        ${showNIT && nit ? `<div class="sub">NIT: <b>${nit}</b></div>` : ``}
        ${showAddr && companyAddr ? `<div class="sub">${companyAddr}</div>` : ``}
        ${showPhone && phone ? `<div class="sub">Tel: ${phone}</div>` : ``}
        ${showEmail && email ? `<div class="sub">${email}</div>` : ``}
          <div class="sub">Reporte de comisiones</div>
          <div class="sub">Desde: <b>${from}</b> — Hasta: <b>${to}</b></div>
          <div class="sub">Sucursal: <b>${branchName}</b> • Barbero: <b>${staffName}</b></div>
        </div>
      </div>

      <table>
        <thead><tr><th>Barbero</th><th style="text-align:right">Cantidad</th><th style="text-align:right">Comisión</th></tr></thead>
        <tbody>${bodyRows || `<tr><td colspan="3" style="color:#64748b">Sin datos.</td></tr>`}</tbody>
      </table>

      <div class="footer">
        <div>Total comisión: <b>${totals?.amount ?? 0}</b></div>
        ${wa ? `<div>WhatsApp: ${wa}</div>` : ``}
        <div>Generado: ${new Date().toLocaleString()}</div>
      </div>

      <script>window.print();</script>
    </body></html>`);
  w.document.close();
}

function exportCsv() {
  const branchName = branches.find((b:any)=>b.id===branchId)?.name ?? "Todas";
  const staffName = staff.find((s:any)=>s.id===staffId)?.displayName ?? "Todos";
  const header = ["Barbero","Cantidad","Comision"].join(",");
  const lines = rows.map((r:any)=> [r.staffName, r.count, r.amount].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(","));
  const meta = [
    `"# Reporte de Comisiones"`,
    `"# Desde: ${from} Hasta: ${to}"`,
    `"# Sucursal: ${branchName} Barbero: ${staffName}"`,
    `"# Total: ${totals?.amount ?? 0}"`,
    header,
    ...lines
  ].join("\n");
const blob = new Blob([meta], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `comisiones_${from}_a_${to}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}


  return (
    <div className="bg-white border rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold">Comisiones</h2>
          <p className="text-sm text-slate-600 mt-1">Reporte por rango. Incluye anulaciones (neto).</p>
        </div>
        <div className="flex gap-2"><button className="border rounded-xl px-3 py-2" onClick={exportCsv}>Exportar CSV</button><button className="border rounded-xl px-3 py-2" onClick={exportPdf}>Exportar PDF</button></div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 items-center">
        <label className="text-sm">Desde</label>
        <input type="date" className="border rounded-xl p-2" value={from} onChange={e=>setFrom(e.target.value)} />
        <label className="text-sm">Hasta</label>
        <input type="date" className="border rounded-xl p-2" value={to} onChange={e=>setTo(e.target.value)} />
        <select className="border rounded-xl p-2" value={branchId} onChange={e=>setBranchId(e.target.value)}>
          <option value="">Todas las sucursales</option>
          {branches.map((b:any)=> <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select className="border rounded-xl p-2" value={staffId} onChange={e=>setStaffId(e.target.value)}>
          <option value="">Todos los barberos</option>
          {staff.map((s:any)=> <option key={s.id} value={s.id}>{s.displayName}</option>)}
        </select>
        <button className="border rounded-xl px-3 py-2" onClick={load}>Refrescar</button>
      </div>

      <div className="mt-4 border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="p-2 text-left">Barbero</th>
              <th className="p-2 text-right">Cantidad</th>
              <th className="p-2 text-right">Comisión</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r:any)=> (
              <tr key={r.staffId} className="border-t">
                <td className="p-2">{r.staffName}</td>
                <td className="p-2 text-right">{r.count}</td>
                <td className="p-2 text-right">{r.amount}</td>
              </tr>
            ))}
            {rows.length===0 && <tr><td className="p-3 text-slate-600" colSpan={3}>Sin datos.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-sm">
        Total comisión: <b>{totals?.amount ?? 0}</b>
      </div>
    </div>
  );
}

function AvailabilityEditor({ staffId, staff, onPickStaff }: { staffId: string; staff: any[]; onPickStaff: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [days, setDays] = useState<any[]>([
    { weekday: 0, startTime: "09:00", endTime: "18:00", breaks: [] },
    { weekday: 1, startTime: "09:00", endTime: "18:00", breaks: [] },
    { weekday: 2, startTime: "09:00", endTime: "18:00", breaks: [] },
    { weekday: 3, startTime: "09:00", endTime: "18:00", breaks: [] },
    { weekday: 4, startTime: "09:00", endTime: "18:00", breaks: [] },
    { weekday: 5, startTime: "09:00", endTime: "14:00", breaks: [] },
    { weekday: 6, startTime: "00:00", endTime: "00:00", breaks: [] },
  ]);

  useEffect(() => {
    if (!staffId) return;
    api.adminGetAvailability(staffId).then(r => {
      const map = new Map(r.availability.map((a: any) => [a.weekday, a]));
      setDays(prev => prev.map(d => {
        const x = map.get(d.weekday);
        return x ? { weekday: x.weekday, startTime: x.startTime, endTime: x.endTime, breaks: x.breaks ?? [] } : d;
      }));
    }).catch(() => {});
  }, [staffId]);

  function labelDay(n: number) {
    return ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"][n] ?? String(n);
  }

  if (!staffId) {
    const filtered = staff.filter((s: any) => !q.trim() || (s.displayName ?? "").toLowerCase().includes(q.trim().toLowerCase()));
    return (
      <div className="bg-white border rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-bold">Horarios</h2>
        <p className="text-sm text-slate-600 mt-1">Elige un barbero para editar horarios.</p>

        <div className="mt-4">
          <input className="border rounded-xl p-2 w-full md:w-80" placeholder="Buscar barbero..." value={q} onChange={e => setQ(e.target.value)} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {filtered.map((s: any) => (
            <button key={s.id} className="border rounded-xl px-3 py-2" onClick={() => onPickStaff(s.id)}>{s.displayName}</button>
          ))}
          {filtered.length === 0 && <div className="text-sm text-slate-600">No hay coincidencias.</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Horarios</h2>
          <p className="text-sm text-slate-600 mt-1">Edita disponibilidad semanal y descansos.</p>
        </div>
        <button className="border rounded-xl px-3 py-2" onClick={() => onPickStaff("")}>Cambiar barbero</button>
      </div>

      <div className="mt-4 space-y-3">
        {days.map((d, idx) => (
          <div key={d.weekday} className="border rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="font-semibold">{labelDay(d.weekday)}</div>
              <div className="flex items-center gap-2">
                <input type="time" className="border rounded-xl p-2" value={d.startTime} onChange={e => setDays(prev => prev.map((x,i)=> i===idx ? { ...x, startTime: e.target.value } : x))} />
                <span className="text-sm text-slate-600">a</span>
                <input type="time" className="border rounded-xl p-2" value={d.endTime} onChange={e => setDays(prev => prev.map((x,i)=> i===idx ? { ...x, endTime: e.target.value } : x))} />
                <button className="border rounded-xl px-3 py-2 text-sm" onClick={() => setDays(prev => prev.map((x,i)=> i===idx ? { ...x, breaks: [...(x.breaks||[]), { startTime: "12:00", endTime: "13:00" }] } : x))}>+ Break</button>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {(d.breaks ?? []).map((b: any, bi: number) => (
                <div key={bi} className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">Break</span>
                  <input type="time" className="border rounded-xl p-2" value={b.startTime} onChange={e => setDays(prev => prev.map((x,i)=> i===idx ? { ...x, breaks: x.breaks.map((bb: any, j: number)=> j===bi ? { ...bb, startTime: e.target.value } : bb) } : x))} />
                  <input type="time" className="border rounded-xl p-2" value={b.endTime} onChange={e => setDays(prev => prev.map((x,i)=> i===idx ? { ...x, breaks: x.breaks.map((bb: any, j: number)=> j===bi ? { ...bb, endTime: e.target.value } : bb) } : x))} />
                  <button className="border rounded-xl px-3 py-2 text-sm" onClick={() => setDays(prev => prev.map((x,i)=> i===idx ? { ...x, breaks: x.breaks.filter((_: any, j: number)=> j!==bi) } : x))}>Eliminar</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <button className="bg-slate-900 text-white rounded-xl px-4 py-2" onClick={async () => {
          await api.adminSetAvailability(staffId, days);
          alert("✅ Horarios guardados");
        }}>Guardar horarios</button>
      </div>
    </div>
  );
}
