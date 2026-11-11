import { useState } from "react";
import { Activity, LockKeyhole } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { firebaseReady } from "../firebase";

export default function Login() {
  const { signIn, register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      if (mode === "login") await signIn(email, password);
      else await register(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إكمال العملية.");
    } finally { setBusy(false); }
  }

  return <div className="login-screen">
    <form className="login-card" onSubmit={submit}>
      <div className="login-logo"><Activity size={28}/></div>
      <h1>SOCIAL MONITOR</h1>
      <p>منصة مراقبة وتحليل المحتوى</p>
      {!firebaseReady && <div className="notice warning">Firebase غير مُعد بعد. أضف بيانات المشروع إلى ملف .env.</div>}
      <label>البريد الإلكتروني<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/></label>
      <label>كلمة المرور<input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/></label>
      {error && <div className="notice error">{error}</div>}
      <button className="primary-btn full" disabled={busy || !firebaseReady}>{busy ? "يرجى الانتظار..." : mode === "login" ? "تسجيل الدخول" : "إنشاء الحساب"}</button>
      <button type="button" className="text-btn" onClick={()=>setMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "ليس لديك حساب؟ إنشاء حساب" : "لديك حساب؟ تسجيل الدخول"}</button>
      <div className="secure-note"><LockKeyhole size={14}/> تسجيل الدخول محمي عبر Firebase Authentication</div>
    </form>
  </div>;
}
