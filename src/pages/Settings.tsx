
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { supabase, supabaseReady } from "../lib/supabase";
import { subscribeToPush } from "../lib/pushNotifications";

import {
  ShieldCheck,
  Database,
  Bell
} from "lucide-react";

export default function Settings() {
  const { user } = useAuth();

  const [pushLoading, setPushLoading] = useState(false);
  const [pushChecking, setPushChecking] = useState(true);
  const [pushStatus, setPushStatus] = useState("");
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkPushSubscription() {
      setPushChecking(true);

      try {
        if (
          !user?.uid ||
          !supabaseReady ||
          !("serviceWorker" in navigator) ||
          !("PushManager" in window) ||
          !("Notification" in window)
        ) {
          if (active) setPushEnabled(false);
          return;
        }

        // إذن المتصفح وحده لا يعني وجود اشتراك.
        if (Notification.permission !== "granted") {
          if (active) setPushEnabled(false);
          return;
        }

        const registration = await navigator.serviceWorker.ready;
        const subscription =
          await registration.pushManager.getSubscription();

        if (!subscription) {
          if (active) setPushEnabled(false);
          return;
        }

        // التأكد من أن الاشتراك محفوظ فعلياً في قاعدة البيانات.
        const { data, error } = await supabase
          .from("push_subscriptions")
          .select("id")
          .eq("user_id", user.uid)
          .eq("endpoint", subscription.endpoint)
          .maybeSingle();

        if (error) throw error;

        if (active) {
          setPushEnabled(Boolean(data));
        }
      } catch (error) {
        console.error(
          "[Web Push] Subscription check failed:",
          error
        );

        if (active) {
          setPushEnabled(false);
        }
      } finally {
        if (active) {
          setPushChecking(false);
        }
      }
    }

    checkPushSubscription();

    return () => {
      active = false;
    };
  }, [user?.uid]);

  async function handleEnablePush() {
    if (!user?.uid) {
      setPushStatus("يجب تسجيل الدخول أولاً.");
      return;
    }

    if (!supabaseReady) {
      setPushStatus("إعدادات الاتصال بقاعدة البيانات غير مكتملة.");
      return;
    }

    setPushLoading(true);
    setPushStatus("");

    try {
      await subscribeToPush(user.uid);

      // إعادة التحقق من الاشتراك بعد الحفظ.
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        await registration.pushManager.getSubscription();

      if (!subscription) {
        throw new Error(
          "لم يتم العثور على اشتراك المتصفح بعد عملية التفعيل."
        );
      }

      const { data, error } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", user.uid)
        .eq("endpoint", subscription.endpoint)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(
          "لم يتم تأكيد حفظ الاشتراك في قاعدة البيانات."
        );
      }

      setPushEnabled(true);
      setPushStatus(
        "تم تفعيل اشتراك إشعارات المتصفح وحفظه بنجاح."
      );
    } catch (error) {
      console.error("[Web Push] Activation failed:", error);

      setPushEnabled(false);

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
          <b
            className={
              pushChecking
                ? ""
                : pushEnabled
                  ? "good-text"
                  : "warn-text"
            }
          >
            {pushChecking
              ? "جارٍ التحقق..."
              : pushEnabled
                ? "الاشتراك محفوظ ومفعّل"
                : Notification.permission === "granted"
                  ? "الإذن ممنوح، الاشتراك غير مكتمل"
                  : "غير مفعّلة"}
          </b>
        </div>

        <button
          type="button"
          onClick={handleEnablePush}
          disabled={pushLoading || pushChecking || pushEnabled}
        >
          {pushLoading
            ? "جارٍ تفعيل الاشتراك..."
            : pushEnabled
              ? "الاشتراك مفعّل"
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
