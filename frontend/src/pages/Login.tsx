import { useState } from "react";
import { api, setToken } from "../api";
import { useNavigate } from "react-router-dom";

export default function Login({ onLogin }: { onLogin: () => void }) {
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@local.com");
  const [password, setPassword] = useState("admin123");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const r = await api.login(email, password);
      setToken(r.token);
      onLogin();
      nav("/admin");
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md bg-white border rounded-2xl p-6 shadow-sm">
      <h2 className="text-xl font-bold">Entrar</h2>
      <p className="text-sm text-slate-600 mt-1">Usa admin@local / admin123 (demo).</p>
      <form className="mt-4 space-y-3" onSubmit={submit}>
        <div>
          <label className="text-sm">Email</label>
          <input className="w-full border rounded-xl px-3 py-2" value={email} onChange={e=>setEmail(e.target.value)} />
        </div>
        <div>
          <label className="text-sm">Password</label>
          <input className="w-full border rounded-xl px-3 py-2" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        </div>
        {err && <div className="text-sm text-red-600 break-words">{err}</div>}
        <button disabled={loading} className="w-full rounded-xl bg-slate-900 text-white py-2">
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
