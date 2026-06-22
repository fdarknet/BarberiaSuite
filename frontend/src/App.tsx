import { Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { api, assetUrl, getToken, setToken } from "./api";
import Home from "./pages/Home";
import Booking from "./pages/Booking";
import Kiosk from "./pages/Kiosk";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import Shop from "./pages/Shop";

const ORG_ID = import.meta.env.VITE_ORG_ID as string;

export default function App() {
  const nav = useNavigate();
  const location = useLocation();
  const [token, setTokState] = useState<string | null>(getToken());
  const [brand, setBrand] = useState<{ name: string; logoUrl: string | null }>({
    name: "Camarguinho Barber Club",
    logoUrl: null,
  });
  const [storeEnabled, setStoreEnabled] = useState(true);

  useEffect(() => {
    const h = () => setTokState(getToken());
    window.addEventListener("storage", h);
    return () => window.removeEventListener("storage", h);
  }, []);

  useEffect(() => {
    if (!ORG_ID) return;
    api.orgPublic(ORG_ID)
      .then((r) => {
        const companyName = r.org.company?.displayName;
        setBrand({
          name: companyName || r.org.name || "Camarguinho Barber Club",
          logoUrl: r.org.logoUrl ?? null,
        });
        setStoreEnabled(Boolean(r.org.store?.enabled ?? true));
      })
      .catch(() => {});
  }, []);

  const isAuthed = useMemo(() => !!token, [token]);
  const isHome = location.pathname === "/";
  const isBooking = location.pathname === "/reservar";
  const isShop = location.pathname === "/tienda";
  const headerLogo = brand.logoUrl ? assetUrl(brand.logoUrl) : "/bc-logo.png";

  return (
    <div className={isHome ? "min-h-screen bg-[#050505]" : "min-h-screen"}>
      {!isHome && (
        <header className="bg-white border-b">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link to="/" className="flex min-w-0 items-center gap-3 font-semibold">
              <span className="flex h-10 w-10 shrink-0 overflow-hidden rounded-full border bg-slate-100">
                <img src={headerLogo} alt="" className="h-full w-full object-cover" />
              </span>
              <span className="truncate">{brand.name}</span>
            </Link>
            {!isBooking && (
              <nav className="flex gap-3 text-sm">
                <Link to="/reservar" className="hover:underline">Reservar</Link>
                {storeEnabled && <Link to="/tienda" className="hover:underline">Tienda</Link>}
                {!isShop && <Link to="/admin" className="hover:underline">Admin</Link>}
                {isAuthed ? (
                  <button
                    className="px-3 py-1 rounded bg-slate-900 text-white"
                    onClick={() => { setToken(null); setTokState(null); nav("/"); }}
                  >
                    Salir
                  </button>
                ) : (
                  <Link to="/login" className="px-3 py-1 rounded bg-slate-900 text-white">Entrar</Link>
                )}
              </nav>
            )}
          </div>
        </header>
      )}

      <main className={isHome ? "" : "max-w-4xl mx-auto px-4 py-6"}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/reservar" element={<Booking />} />
          <Route path="/tienda" element={<Shop />} />
          <Route path="/login" element={<Login onLogin={() => setTokState(getToken())} />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/kiosk" element={<Kiosk />} />
        </Routes>
      </main>

      {!isHome && (
        <footer className="max-w-4xl mx-auto px-4 py-8 text-xs text-slate-500">
          Powered by LinkTEC - Compunet Cotoca
        </footer>
      )}
    </div>
  );
}
