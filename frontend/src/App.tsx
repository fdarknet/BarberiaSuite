import { Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getToken, setToken } from "./api";
import Home from "./pages/Home";
import Booking from "./pages/Booking";
import Kiosk from "./pages/Kiosk";
import Login from "./pages/Login";
import Admin from "./pages/Admin";

export default function App() {
  const nav = useNavigate();
  const location = useLocation();
  const [token, setTokState] = useState<string | null>(getToken());

  useEffect(() => {
    const h = () => setTokState(getToken());
    window.addEventListener("storage", h);
    return () => window.removeEventListener("storage", h);
  }, []);

  const isAuthed = useMemo(() => !!token, [token]);
  const isHome = location.pathname === "/";

  return (
    <div className={isHome ? "min-h-screen bg-[#050505]" : "min-h-screen"}>
      {!isHome && (
        <header className="bg-white border-b">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link to="/" className="font-semibold">Camarguinho Barber Club</Link>
            <nav className="flex gap-3 text-sm">
              ##<Link to="/reservar" className="hover:underline"></Link>
              ##<Link to="/admin" className="hover:underline"></Link>
              {isAuthed ? (
                <button
                  className="px-3 py-1 rounded bg-slate-900 text-white"
                  onClick={() => { setToken(null); setTokState(null); nav("/"); }}
                >
                  Salir
                </button>
              ) : (
                <Link to="/login" className="px-3 py-1 rounded bg-slate-900 text-white"></Link>
              )}
            </nav>
          </div>
        </header>
      )}

      <main className={isHome ? "" : "max-w-4xl mx-auto px-4 py-6"}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/reservar" element={<Booking />} />
          <Route path="/login" element={<Login onLogin={() => setTokState(getToken())} />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/kiosk" element={<Kiosk />} />
        </Routes>
      </main>

      {!isHome && (
        <footer className="max-w-4xl mx-auto px-4 py-8 text-xs text-slate-500">
          Powered by LinkTEc - Compunet Cotoca
        </footer>
      )}
    </div>
  );
}
