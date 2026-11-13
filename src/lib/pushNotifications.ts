import { supabase } from "./supabase";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }

  return output;
}

export async function subscribeToPush(userId: string) {
  if (!userId) {
    throw new Error("يجب تسجيل الدخول أولاً.");
  }

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("المتصفح لا يدعم إشعارات Web Push.");
  }

  if (!("Notification" in window)) {
    throw new Error("الإشعارات غير مدعومة في هذا المتصفح.");
  }

  if (!window.isSecureContext) {
    throw new Error("يجب فتح الموقع عبر اتصال HTTPS.");
  }

  if (!VAPID_PUBLIC_KEY) {
    throw new Error("مفتاح VAPID العام غير مضبوط.");
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("لم يتم السماح بإرسال الإشعارات.");
  }

  const registration = await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        VAPID_PUBLIC_KEY
      ) as BufferSource,
    });
  }

  const subscriptionData = subscription.toJSON();

  const p256dh = subscriptionData.keys?.p256dh;
  const auth = subscriptionData.keys?.auth;

  if (!subscription.endpoint || !p256dh || !auth) {
    throw new Error("تعذر استخراج بيانات اشتراك الإشعارات.");
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh,
        auth,
        subscription_json: subscriptionData,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "endpoint",
      }
    );

  if (error) {
    throw new Error(`فشل حفظ اشتراك الإشعارات: ${error.message}`);
  }

  return subscription;
}
