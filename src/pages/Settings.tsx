
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { supabaseReady } from "../lib/supabase";
import { subscribeToPush } from "../lib/pushNotifications";

import {
  ShieldCheck,
  Database,
  Bell
} from "lucide-react";

export default function Settings() {
  const { user } = useAuth();

  const [pushLoading, setPushLoading] = useState(false);
  const [pushStatus, setPushStatus] = useState("");
  const [pushEnabled, setPushEnabled] = useState(
    typeof Notification !== "undefined" &&
    Notification.permission === "granted"
  );

  async function handleEnablePush() {
    if (!user?.uid) {
      setPushStatus("يجب تسجيل الدخول أولاً.");
      return;
    }

    setPushLoading(true);
    setPushStatus("");

    try {
      await subscribeToPush(user.uid);
      setPushEnabled(true);
      setPushStatus("تم تفعيل اشتراك إشعارات المتصفح بنجاح.");
    } catch (error) {
      setPushStatus(
        error instanceof Error
          ? error.message
          : "تعذر تفعيل إشعارات المتصفح."
      );
    } finally {
      setPushLoading(false);
    }
  }

  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">تفضيلات المنصة</span>
          <h1>الإعدادات</h1>
          <p>
            حالة حسابك والخدمات المرتبطة بالمشروع.
          </p>
        </div>
      </div>

      <section className="panel settings-panel">
        <div className="panel-head">
          <div>
            <h2>الحساب</h2>
            <p>بيانات تسجيل الدخول الحالية</p>
          </div>
          <ShieldCheck />
        </div>

        <div className="setting-row">
          <span>البريد الإلكتروني</span>
          <b>{user?.email || "غير متوفر"}</b>
        </div>

        <div className="setting-row">
          <span>معرّف المستخدم</span>
          <code>{user?.uid || "غير متوفر"}</code>
        </div>
      </section>

      <section className="panel settings-panel">
        <div className="panel-head">
          <div>
            <h2>الخدمات</h2>
            <p>حالة الاتصال</p>
          </div>
          <Database />
        </div>

        <div className="setting-row">
          <span>Supabase</span>
          <b
            className={
              supabaseReady ? "good-text" : "warn-text"
            }
          >
            {supabaseReady
              ? "تم إعداد الاتصال"
              : "إعدادات الاتصال ناقصة"}
          </b>
        </div>

        <div className="setting-row">
          <span>Facebook Source Adapter</span>
          <b className="warn-text">غير مربوط</b>
        </div>

        <div className="setting-row">
          <span>إشعارات المتصفح</span>
          <b className={pushEnabled ? "good-text" : "warn-text"}>
            {pushEnabled ? "تم منح إذن الإشعارات" : "غير مفعّلة"}
          </b>
        </div>

        <button
          type="button"
          onClick={handleEnablePush}
          disabled={pushLoading || pushEnabled}
        >
          {pushLoading
            ? "جارٍ التفعيل..."
            : pushEnabled
              ? "الإشعارات مفعّلة"
              : "تفعيل إشعارات المتصفح"}
        </button>

        {pushStatus && (
          <p className="muted" role="status">
            {pushStatus}
          </p>
        )}
      </section>

      <section className="panel settings-panel">
        <div className="panel-head">
          <div>
            <h2>الأمان والخصوصية</h2>
            <p>مبادئ حماية البيانات</p>
          </div>
          <Bell />
        </div>

        <p className="muted">
          لا تخزن كلمات مرور Facebook أو Cookies أو رموز
          جلسات. لا تضع مفاتيح الخادم السرية داخل الواجهة
          الأمامية.
        </p>
      </section>
    </div>
  );
}
