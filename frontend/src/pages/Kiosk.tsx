import { useEffect, useMemo, useRef, useState } from "react";
import { api, API_BASE, assetUrl } from "../api";

const ORG_ID = import.meta.env.VITE_ORG_ID as string;

function isoDateLocal(d = new Date()) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}

function getQS(key: string) {
  return new URLSearchParams(window.location.search).get(key) ?? "";
}

function statusStyle(status: string) {
  switch (status) {
    case "CALLED":
      return { card: "queue-ticket-card--called", badge: "queue-status-badge--called", label: "LLAMANDO" };
    case "IN_CHAIR":
      return { card: "queue-ticket-card--chair", badge: "queue-status-badge--chair", label: "EN SILLA" };
    case "DONE":
      return { card: "queue-ticket-card--done", badge: "queue-status-badge--done", label: "TERMINADO" };
    case "CANCELED":
      return { card: "queue-ticket-card--canceled", badge: "queue-status-badge--canceled", label: "CANCELADO" };
    case "WAITING":
    default:
      return { card: "queue-ticket-card--waiting", badge: "queue-status-badge--waiting", label: "EN ESPERA" };
  }
}

function safeParseInt(v: string, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function Kiosk() {
  const [branches, setBranches] = useState<any[]>([]);
  const [branchId, setBranchId] = useState<string>("");
  const [services, setServices] = useState<any[]>([]);
  const [serviceId, setServiceId] = useState<string>("");
  const [staff, setStaff] = useState<any[]>([]);
  const [staffId, setStaffId] = useState<string>("");
  const [date, setDate] = useState<string>(isoDateLocal());
  const [slots, setSlots] = useState<{ startAt: string; endAt: string }[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [paidAppointments, setPaidAppointments] = useState<any[]>([]);
  const [customerName, setCustomerName] = useState<string>("");

  const [locked, setLocked] = useState<boolean>(false);

  const [pinEnabled, setPinEnabled] = useState<boolean>(true);
  const [pin, setPin] = useState<string>("1234");
  const [askPin, setAskPin] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>("");

  const [isFs, setIsFs] = useState<boolean>(!!document.fullscreenElement);
  const [displayOnly, setDisplayOnly] = useState<boolean>(false);

  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [scrollSpeed, setScrollSpeed] = useState<number>(22);

  // Per-column scrolling refs (headers stay fixed)
  const calledRef  = useRef<HTMLDivElement | null>(null);
  const chairRef   = useRef<HTMLDivElement | null>(null);
  const waitingRef = useRef<HTMLDivElement | null>(null);
  const paidRef    = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {}
  }

  // Init from querystring + localStorage
  useEffect(() => {
    const qsLock = getQS("lock");
    const qsBranch = getQS("branchId");
    const qsService = getQS("serviceId");
    const qsPin = getQS("pin");
    const qsPinEnabled = getQS("pinEnabled");
    const qsDisplay = getQS("display");
    const qsAutoScroll = getQS("autoScroll");
    const qsSpeed = getQS("speed");

    const storedLocked = localStorage.getItem("kiosk.locked");
    const storedBranch = localStorage.getItem("kiosk.branchId");
    const storedService = localStorage.getItem("kiosk.serviceId");
    const storedPin = localStorage.getItem("kiosk.pin") || "1234";
    const storedPinEnabled = localStorage.getItem("kiosk.pinEnabled");
    const storedDisplay = localStorage.getItem("kiosk.displayOnly");
    const storedAutoScroll = localStorage.getItem("kiosk.autoScroll");
    const storedSpeed = localStorage.getItem("kiosk.scrollSpeed");

    const initialLocked = qsLock === "1" || storedLocked === "1";
    setLocked(initialLocked);

    const pe = qsPinEnabled ? qsPinEnabled === "1" : storedPinEnabled ? storedPinEnabled === "1" : true;
    setPinEnabled(pe);
    localStorage.setItem("kiosk.pinEnabled", pe ? "1" : "0");

    const finalPin = qsPin || storedPin;
    setPin(finalPin);
    localStorage.setItem("kiosk.pin", finalPin);

    const disp = qsDisplay ? qsDisplay === "1" : storedDisplay ? storedDisplay === "1" : false;
    setDisplayOnly(disp);
    localStorage.setItem("kiosk.displayOnly", disp ? "1" : "0");

    const as = qsAutoScroll ? qsAutoScroll === "1" : storedAutoScroll ? storedAutoScroll === "1" : true;
    setAutoScroll(as);
    localStorage.setItem("kiosk.autoScroll", as ? "1" : "0");

    const sp = qsSpeed ? safeParseInt(qsSpeed, 22) : storedSpeed ? safeParseInt(storedSpeed, 22) : 22;
    setScrollSpeed(sp);
    localStorage.setItem("kiosk.scrollSpeed", String(sp));

    if (qsBranch) localStorage.setItem("kiosk.branchId", qsBranch);
    if (qsService) localStorage.setItem("kiosk.serviceId", qsService);

    if (initialLocked) {
      if (qsBranch) setBranchId(qsBranch);
      else if (storedBranch) setBranchId(storedBranch);

      if (qsService) setServiceId(qsService);
      else if (storedService) setServiceId(storedService);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!locked) return;
    if (branchId) localStorage.setItem("kiosk.branchId", branchId);
    if (serviceId) localStorage.setItem("kiosk.serviceId", serviceId);
    localStorage.setItem("kiosk.locked", "1");
  }, [locked, branchId, serviceId]);

  function requestUnlock() {
    if (!pinEnabled) return unlockNow();
    setAskPin(true);
    setPinInput("");
  }

  function unlockNow() {
    setLocked(false);
    localStorage.setItem("kiosk.locked", "0");
  }

  function confirmPin() {
    if (pinInput.trim() === pin) {
      setAskPin(false);
      unlockNow();
      return;
    }
    alert("PIN incorrecto");
  }

  function lockNow() {
    setLocked(true);
    localStorage.setItem("kiosk.locked", "1");
    if (branchId) localStorage.setItem("kiosk.branchId", branchId);
    if (serviceId) localStorage.setItem("kiosk.serviceId", serviceId);
  }

  useEffect(() => {
    if (!ORG_ID) return;
    api.branches(ORG_ID).then((r) => {
      setBranches(r.branches);
      if (!branchId && r.branches[0]) setBranchId(r.branches[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!branchId) return;
    api.services(branchId).then((r) => {
      setServices(r.services);
      if (!serviceId && r.services[0]) setServiceId(r.services[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  useEffect(() => {
    if (!branchId || !serviceId) {
      setStaff([]);
      setStaffId("");
      return;
    }
    api.staff(branchId, serviceId).then((r) => setStaff(r.staff)).catch(() => setStaff([]));
  }, [branchId, serviceId]);

  async function loadAvailability() {
    if (!branchId || !serviceId) return;
    const r = await api.availability(branchId, serviceId, date, staffId || undefined);
    setSlots(r.slots);
  }

  async function loadQueue() {
    if (!branchId) return;
    const r = await api.queueTickets(branchId);
    setTickets(r.tickets);
  }

  async function loadPaidAppointments() {
    if (!branchId) return;
    const r = await api.queuePaidAppointments(branchId, isoDateLocal());
    setPaidAppointments(r.paidAppointments);
  }

  useEffect(() => {
    if (!displayOnly) loadAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, serviceId, date, staffId, displayOnly]);

  useEffect(() => {
    loadQueue();
    loadPaidAppointments();
    const t = setInterval(() => { loadQueue(); loadPaidAppointments(); }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  async function takeTicket() {
    if (!customerName.trim()) return alert("Pon tu nombre");
    if (!branchId || !serviceId) return;
    const r = await api.queueCreateTicket({ branchId, customerName, serviceId, staffId: staffId || undefined });
    alert(`✅ Tu turno es #${r.ticket.ticketNumber ?? r.ticket.n ?? "?"}`);
    setCustomerName("");
    await loadQueue();
  }

  const called = tickets.filter((t) => t.status === "CALLED");
  const inChair = tickets.filter((t) => t.status === "IN_CHAIR");
  const waiting = tickets.filter((t) => t.status === "WAITING");

  const branchName = useMemo(() => branches.find((b) => b.id === branchId)?.name ?? "", [branches, branchId]);
  const serviceName = useMemo(() => services.find((s) => s.id === serviceId)?.name ?? "", [services, serviceId]);

  // Auto-scroll per column (headers remain static)
  useEffect(() => {
    if (!autoScroll) return;

    const refs = [calledRef, chairRef, waitingRef, paidRef];
    const dirs = [1, 1, 1, 1];
    let raf = 0;
    let last = performance.now();

    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;

      refs.forEach((r, idx) => {
        const el = r.current;
        if (!el) return;
        const max = el.scrollHeight - el.clientHeight;
        if (max <= 0) {
          el.scrollTop = 0;
          return;
        }
        el.scrollTop += scrollSpeed * dt * dirs[idx];
        if (el.scrollTop >= max - 2) dirs[idx] = -1;
        if (el.scrollTop <= 2) dirs[idx] = 1;
      });

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [autoScroll, scrollSpeed, called.length, inChair.length, waiting.length, paidAppointments.length]);

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">Pantalla de Turnos</h1>
            <p className="text-lg text-slate-600 mt-1">
              {branchName ? `${branchName}` : "Selecciona sucursal"} {serviceName ? `• ${serviceName}` : ""}
            </p>

            {displayOnly && !locked && branches.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-sm text-slate-600 font-semibold">Sucursal:</span>
                <select className="border rounded-xl px-3 py-2 text-sm font-semibold" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-slate-500">Tip: usa lock=1 para fijar</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <button className="border rounded-xl px-5 py-3 text-base font-bold" onClick={toggleFullscreen}>
              {isFs ? "Salir pantalla completa" : "Pantalla completa"}
            </button>

            {!locked ? (
              <button className="bg-slate-900 text-white rounded-xl px-5 py-3 text-base font-extrabold" onClick={lockNow} disabled={!branchId || !serviceId}>
                Bloquear
              </button>
            ) : (
              <button className="bg-slate-900 text-white rounded-xl px-5 py-3 text-base font-extrabold" onClick={requestUnlock}>
                Desbloquear
              </button>
            )}
          </div>
        </div>

        {!displayOnly && (
          <>
            <div className="mt-6 grid md:grid-cols-3 gap-3">
              <div>
                <label className="text-base font-semibold">Sucursal</label>
                {locked ? (
                  <div className="mt-2 border rounded-xl p-3 bg-slate-50">
                    <div className="text-xl font-bold">{branchName || "—"}</div>
                    <div className="text-xs text-slate-500">Bloqueado</div>
                  </div>
                ) : (
                  <select className="w-full border rounded-xl p-3 mt-2 text-lg" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="text-base font-semibold">Servicio</label>
                {locked ? (
                  <div className="mt-2 border rounded-xl p-3 bg-slate-50">
                    <div className="text-xl font-bold">{serviceName || "—"}</div>
                    <div className="text-xs text-slate-500">Bloqueado</div>
                  </div>
                ) : (
                  <select className="w-full border rounded-xl p-3 mt-2 text-lg" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({Math.round(s.price ?? 0)} Bs)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="text-base font-semibold">Fecha</label>
                <input type="date" className="w-full border rounded-xl p-3 mt-2 text-lg" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>

            <div className="mt-5">
              <label className="text-base font-semibold">Barbero</label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`border rounded-xl px-4 py-3 text-base font-semibold ${staffId === "" ? "bg-slate-900 text-white" : ""}`}
                  onClick={() => setStaffId("")}
                >
                  Cualquiera
                </button>
                {staff.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`border rounded-xl px-4 py-3 flex items-center gap-3 text-base font-semibold ${staffId === s.id ? "bg-slate-900 text-white" : ""}`}
                    onClick={() => setStaffId(s.id)}
                  >
                    <span className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden inline-flex items-center justify-center">
                      {s.photoUrl ? <img src={assetUrl(s.photoUrl)} className="w-full h-full object-cover" /> : "👤"}
                    </span>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-7">
              <div className="text-2xl font-extrabold">Horarios disponibles</div>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-6 gap-2">
                {slots.slice(0, 36).map((s) => (
                  <div key={s.startAt} className="border rounded-xl p-3 text-center text-xl font-extrabold bg-white">
                    {new Date(s.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                ))}
                {slots.length === 0 && <div className="text-base text-slate-600">No hay disponibilidad.</div>}
              </div>
              {slots.length > 36 && <div className="text-xs text-slate-500 mt-2">Mostrando primeros 36 horarios.</div>}
            </div>

            <div className="mt-7">
              <h2 className="text-3xl font-extrabold">Sacar turno</h2>
              <div className="mt-4 flex flex-col md:flex-row gap-3">
                <input className="flex-1 border rounded-2xl p-4 text-2xl" placeholder="Tu nombre" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                <button className="bg-slate-900 text-white rounded-2xl px-8 py-4 text-2xl font-extrabold" onClick={takeTicket}>
                  Tomar número
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="bg-white border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-3xl font-extrabold">Turnos</div>
            <p className="text-sm text-slate-600 mt-1">Auto-actualiza cada 5 segundos.</p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
              Auto-scroll
            </label>
            <label className="text-sm text-slate-600">Velocidad</label>
            <input
              type="range"
              min="10"
              max="60"
              value={scrollSpeed}
              onChange={(e) => {
                const v = Number(e.target.value);
                setScrollSpeed(v);
                localStorage.setItem("kiosk.scrollSpeed", String(v));
              }}
            />
            <span className="text-sm font-semibold">{scrollSpeed}px/s</span>
          </div>
        </div>

        <div className="mt-5 grid lg:grid-cols-4 gap-4">
          <QueueSection title="LLAMANDO"  items={called}   bodyRef={calledRef} />
          <QueueSection title="EN SILLA"  items={inChair}  bodyRef={chairRef} />
          <QueueSection title="EN ESPERA" items={waiting}  bodyRef={waitingRef} />
          <PaidSection  paidAppointments={paidAppointments} bodyRef={paidRef} />
        </div>
      </div>

      {askPin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <div className="text-xl font-extrabold">PIN requerido</div>
            <p className="text-sm text-slate-600 mt-1">Ingresa el PIN para desbloquear.</p>

            <input
              className="mt-4 w-full border rounded-2xl p-4 text-2xl tracking-widest text-center"
              inputMode="numeric"
              placeholder="••••"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmPin();
                if (e.key === "Escape") setAskPin(false);
              }}
              autoFocus
            />

            <div className="mt-4 flex gap-2">
              <button className="flex-1 border rounded-2xl py-3 text-base font-bold" onClick={() => setAskPin(false)}>
                Cancelar
              </button>
              <button className="flex-1 bg-slate-900 text-white rounded-2xl py-3 text-base font-extrabold" onClick={confirmPin}>
                Desbloquear
              </button>
            </div>

            <div className="mt-3 text-xs text-slate-500">
              Tip: puedes definir PIN en la URL: <code>?pin=1234</code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QueueSection({ title, items, bodyRef }: { title: string; items: any[]; bodyRef: React.RefObject<HTMLDivElement> }) {
  const headerStyle =
    title === "LLAMANDO"
      ? "queue-column__header--called"
      : title === "EN SILLA"
      ? "queue-column__header--chair"
      : "queue-column__header--waiting";

  return (
    <div className="queue-column">
      <div className={`queue-column__header p-4 text-2xl font-extrabold ${headerStyle}`}>{title}</div>

      <div ref={bodyRef} className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
        {items.map((t) => {
          const st = statusStyle(t.status);
          // Reservas pagadas: borde violeta + badge especial
          const isAppt = !!t.fromAppointment;
          const cardCls = isAppt
            ? "queue-ticket-card queue-ticket-card--reserved"
            : `queue-ticket-card ${st.card}`;

          return (
            <div key={t.id} className={`rounded-2xl p-4 flex items-center justify-between ${cardCls}`}>
              <div>
                <div className="flex items-center gap-2">
                  <div className="queue-ticket-number text-5xl font-extrabold">#{t.n}</div>
                  {isAppt && (
                    <span className="queue-status-badge queue-status-badge--reserved text-xs px-2 py-1 font-bold leading-none">
                      RESERVA
                    </span>
                  )}
                </div>
                <div className="text-2xl font-semibold">{t.name}</div>
                <div className="text-base text-slate-800">{t.service}</div>
                <div className="text-base text-slate-700">
                  {t.staff ? `Con: ${t.staff}` : "Próximo barbero disponible"}
                </div>
                {isAppt && t.scheduledAt && (
                  <div className="text-sm text-violet-700 font-semibold mt-1">
                    🕐 {new Date(t.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
              </div>
              <span className={`queue-status-badge text-base px-4 py-2 font-extrabold ${isAppt ? "queue-status-badge--reserved" : st.badge}`}>
                {st.label}
              </span>
            </div>
          );
        })}
        {items.length === 0 && <div className="text-lg text-slate-600">Sin turnos.</div>}
      </div>
    </div>
  );
}

function PaidSection({
  paidAppointments,
  bodyRef,
}: {
  paidAppointments: {
    id: string;
    appointmentId: string;
    customerName: string;
    ticketNumber: number | null;
    serviceName: string;
    staffName: string;
    startAt: string | null;
    paidAt: string;
  }[];
  bodyRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div className="queue-column">
      <div className="queue-column__header queue-column__header--paid p-4 text-2xl font-extrabold flex items-center gap-2">
        <span>✅</span> Reservas Pagadas
      </div>

      <div ref={bodyRef} className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
        {paidAppointments.map((a) => (
          <div
            key={a.id}
            className="queue-ticket-card queue-ticket-card--reserved rounded-2xl p-4 flex items-start justify-between gap-2"
          >
            <div className="flex-1 min-w-0">
              {/* Número de turno en cola (asignado 10 min antes) */}
              {a.ticketNumber != null ? (
                <div className="queue-ticket-number text-5xl font-extrabold">#{a.ticketNumber}</div>
              ) : (
                <div className="text-2xl font-bold text-violet-400 italic">Turno pendiente</div>
              )}

              {/* Nombre */}
              <div className="text-2xl font-semibold mt-1 truncate">{a.customerName}</div>

              {/* Servicio */}
              <div className="text-base text-slate-700">{a.serviceName}</div>

              {/* Barbero */}
              <div className="text-base text-slate-700 flex items-center gap-1 mt-0.5">
                <span>✂️</span> {a.staffName}
              </div>

              {/* Horario reservado */}
              {a.startAt && (
                <div className="text-sm font-bold text-violet-800 mt-1 flex items-center gap-1">
                  <span>🕐</span>
                  {new Date(a.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}

              {/* Ticket de reserva (ID corto) */}
              <div className="text-xs text-slate-400 mt-1 font-mono">
                Reserva #{a.appointmentId.slice(-6).toUpperCase()}
              </div>
            </div>

            <span className="queue-status-badge queue-status-badge--reserved shrink-0 text-sm px-3 py-2 font-extrabold">
              Pagado
            </span>
          </div>
        ))}
        {paidAppointments.length === 0 && (
          <div className="text-lg text-slate-600">Sin reservas pagadas hoy.</div>
        )}
      </div>
    </div>
  );
}
