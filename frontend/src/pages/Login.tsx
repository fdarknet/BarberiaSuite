import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setToken } from "../api";

type Mode = "login" | "change" | "reset";

export default function Login({ onLogin }: { onLogin: () => void }) {
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetRequested, setResetRequested] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validateNewPassword() {
    if (newPassword.length < 6) {
      setErr("La nueva contraseña debe tener al menos 6 caracteres.");
      return false;
    }
    if (newPassword !== confirmPassword) {
      setErr("Las contraseñas no coinciden.");
      return false;
    }
    return true;
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setErr(null);
    setMsg(null);
    setPassword("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setResetCode("");
    setResetRequested(false);
  }

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
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

  async function submitChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (!validateNewPassword()) return;

    setLoading(true);
    try {
      await api.changePassword({ email, currentPassword, newPassword });
      setMsg("Contraseña modificada. Ya puedes entrar con la nueva contraseña.");
      setPassword("");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMode("login");
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setLoading(true);
    try {
      await api.requestPasswordReset(email);
      setResetRequested(true);
      setMsg("Si el email existe, recibirás un código para restablecer la contraseña.");
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  async function confirmReset(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (!validateNewPassword()) return;

    setLoading(true);
    try {
      await api.confirmPasswordReset({ email, code: resetCode, newPassword });
      setMsg("Contraseña restablecida. Ya puedes entrar con la nueva contraseña.");
      setPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setResetCode("");
      setResetRequested(false);
      setMode("login");
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md bg-white border rounded-2xl p-6 shadow-sm">
      <h2 className="text-xl font-bold">Cuenta</h2>

      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <button type="button" className={tabClass(mode === "login")} onClick={() => switchMode("login")}>Entrar</button>
        <button type="button" className={tabClass(mode === "change")} onClick={() => switchMode("change")}>Modificar</button>
        <button type="button" className={tabClass(mode === "reset")} onClick={() => switchMode("reset")}>Restablecer</button>
      </div>

      {mode === "login" && (
        <form className="mt-4 space-y-3" onSubmit={submitLogin}>
          <EmailInput value={email} onChange={setEmail} />
          <PasswordInput label="Contraseña" value={password} onChange={setPassword} />
          <Status err={err} msg={msg} />
          <button disabled={loading} className="w-full rounded-xl bg-slate-900 text-white py-2 disabled:opacity-60">
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      )}

      {mode === "change" && (
        <form className="mt-4 space-y-3" onSubmit={submitChangePassword}>
          <EmailInput value={email} onChange={setEmail} />
          <PasswordInput label="Contraseña actual" value={currentPassword} onChange={setCurrentPassword} />
          <PasswordInput label="Nueva contraseña" value={newPassword} onChange={setNewPassword} />
          <PasswordInput label="Confirmar nueva contraseña" value={confirmPassword} onChange={setConfirmPassword} />
          <Status err={err} msg={msg} />
          <button disabled={loading} className="w-full rounded-xl bg-slate-900 text-white py-2 disabled:opacity-60">
            {loading ? "Guardando..." : "Modificar contraseña"}
          </button>
        </form>
      )}

      {mode === "reset" && (
        <form className="mt-4 space-y-3" onSubmit={resetRequested ? confirmReset : requestReset}>
          <EmailInput value={email} onChange={setEmail} />
          {resetRequested && (
            <>
              <div>
                <label className="text-sm">Código</label>
                <input className="w-full border rounded-xl px-3 py-2" value={resetCode} onChange={e => setResetCode(e.target.value)} />
              </div>
              <PasswordInput label="Nueva contraseña" value={newPassword} onChange={setNewPassword} />
              <PasswordInput label="Confirmar nueva contraseña" value={confirmPassword} onChange={setConfirmPassword} />
            </>
          )}
          <Status err={err} msg={msg} />
          <button disabled={loading} className="w-full rounded-xl bg-slate-900 text-white py-2 disabled:opacity-60">
            {loading ? "Procesando..." : resetRequested ? "Restablecer contraseña" : "Enviar código"}
          </button>
        </form>
      )}
    </div>
  );
}

function tabClass(active: boolean) {
  return `rounded-xl border px-3 py-2 ${active ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`;
}

function EmailInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="text-sm">Email</label>
      <input className="w-full border rounded-xl px-3 py-2" type="email" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function PasswordInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="text-sm">{label}</label>
      <input className="w-full border rounded-xl px-3 py-2" type="password" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function Status({ err, msg }: { err: string | null; msg: string | null }) {
  return (
    <>
      {err && <div className="text-sm text-red-600 break-words">{err}</div>}
      {msg && <div className="text-sm text-emerald-700 break-words">{msg}</div>}
    </>
  );
}
