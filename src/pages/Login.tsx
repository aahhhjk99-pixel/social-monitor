import { useState } from "react";
import type { FormEvent } from "react";

import { Activity, LockKeyhole } from "lucide-react";

import { useAuth } from "../auth/AuthContext";
import { supabaseReady } from "../lib/supabase";

export default function Login() {
  const { signIn, register } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setNotice("");
    setBusy(true);

    try {
      if (mode === "login") {
        await signIn(email, password);
      } else {
        const hasSession = await register(email, password);

        if (hasSession) {
          setNotice("تم إنشاء الحساب بنجاح.");
        } else {
          setNotice(
            "تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيد التسجيل قبل تسجيل الدخول."
          );
        }
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message.toLowerCase()
          : "";

      if (
        message.includes("invalid login credentials") ||
        message.includes("invalid credentials")
      ) {
        setError("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
      } else if (message.includes("user already registered")) {
        setError("هذا البريد الإلكتروني مسجل بالفعل.");
      } else if (message.includes("password should be at least")) {
        setError("كلمة المرور قصيرة جداً.");
      } else if (message.includes("unable to validate email")) {
        setError("البريد الإلكتروني غير صحيح.");
      } else if (
        message.includes("email not confirmed")
      ) {
        setError("يجب تأكيد البريد الإلكتروني أولاً.");
      } else if (
        message.includes("network") ||
        message.includes("fetch")
      ) {
        setError("تعذر الاتصال. تحقق من الإنترنت وحاول مرة أخرى.");
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "تعذر إكمال العملية. حاول مرة أخرى."
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">
          <Activity size={28} />
        </div>

        <h1>SOCIAL MONITOR</h1>
        <p>منصة مراقبة وتحليل المحتوى</p>

        {!supabaseReady && (
          <div className="notice warning">
            إعدادات Supabase غير مكتملة. تحقق من متغيرات البيئة.
          </div>
        )}

        <label>
          البريد الإلكتروني

          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            autoComplete="email"
          />
        </label>

        <label>
          كلمة المرور

          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={
              mode === "login"
                ? "current-password"
                : "new-password"
            }
          />
        </label>

        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}

        {notice && (
          <div className="notice warning" role="status">
            {notice}
          </div>
        )}

        <button
          className="primary-btn full"
          disabled={busy || !supabaseReady}
          type="submit"
        >
          {busy
            ? "يرجى الانتظار..."
            : mode === "login"
              ? "تسجيل الدخول"
              : "إنشاء الحساب"}
        </button>

        <button
          type="button"
          className="text-btn"
          disabled={busy}
          onClick={() => {
            setMode(
              mode === "login" ? "register" : "login"
            );
            setError("");
            setNotice("");
          }}
        >
          {mode === "login"
            ? "ليس لديك حساب؟ إنشاء حساب"
            : "لديك حساب؟ تسجيل الدخول"}
        </button>

        <div className="secure-note">
          <LockKeyhole size={14} />
          تسجيل الدخول محمي عبر Supabase Authentication
        </div>
      </form>
    </div>
  );
}
