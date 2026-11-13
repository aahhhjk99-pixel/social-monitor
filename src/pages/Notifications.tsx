
import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  ExternalLink,
  CheckCheck,
  AlertCircle
} from "lucide-react";

import { useAuth } from "../auth/AuthContext";
import { supabase } from "../lib/supabase";
import type { NotificationRecord } from "../types";

function mapNotification(row: Record<string, unknown>): NotificationRecord {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    detectedItemId: String(row.detected_item_id),
    title: String(row.title ?? "تنبيه جديد"),
    message: String(row.message ?? ""),
    sourceUrl:
      typeof row.source_url === "string"
        ? row.source_url
        : undefined,
    readAt:
      typeof row.read_at === "string"
        ? new Date(row.read_at).getTime()
        : undefined,
    sentAt:
      typeof row.sent_at === "string"
        ? new Date(row.sent_at).getTime()
        : undefined,
    deliveryStatus:
      row.delivery_status === "sent" ||
      row.delivery_status === "failed"
        ? row.delivery_status
        : "pending",
    deliveryError:
      typeof row.delivery_error === "string"
        ? row.delivery_error
        : undefined,
    createdAt:
      typeof row.created_at === "string"
        ? new Date(row.created_at).getTime()
        : Date.now()
  };
}

export default function Notifications() {
  const { user } = useAuth();

  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const { data, error: queryError } = await supabase
      .from("monitoring_notifications")
      .select("*")
      .eq("owner_id", user.uid)
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setItems([]);
    } else {
      setItems((data ?? []).map((row) =>
        mapNotification(row as Record<string, unknown>)
      ));
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  async function markAsRead(id: string) {
    if (!user || updatingId) return;

    setUpdatingId(id);
    setError("");

    const readAt = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("monitoring_notifications")
      .update({ read_at: readAt })
      .eq("id", id)
      .eq("owner_id", user.uid);

    if (updateError) {
      setError(updateError.message);
    } else {
      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, readAt: Date.now() }
            : item
        )
      );
    }

    setUpdatingId(null);
  }

  async function markAllAsRead() {
    if (!user || updatingId) return;

    const unreadIds = items
      .filter((item) => !item.readAt)
      .map((item) => item.id);

    if (unreadIds.length === 0) return;

    setUpdatingId("all");
    setError("");

    const { error: updateError } = await supabase
      .from("monitoring_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("owner_id", user.uid)
      .is("read_at", null);

    if (updateError) {
      setError(updateError.message);
    } else {
      const now = Date.now();

      setItems((current) =>
        current.map((item) =>
          item.readAt ? item : { ...item, readAt: now }
        )
      );
    }

    setUpdatingId(null);
  }

  const unreadCount = items.filter((item) => !item.readAt).length;

  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">مركز التنبيهات</span>
          <h1>الإشعارات</h1>
          <p>التنبيهات والنتائج المرتبطة بالكلمات المفتاحية.</p>
        </div>

        <span className="count-pill">
          {unreadCount} غير مقروء
        </span>
      </div>

      {error && (
        <div className="notice error" role="alert">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <section className="panel">
        <div className="toolbar">
          <div>
            <h2>سجل التنبيهات</h2>
            <p>التنبيهات المحفوظة في قاعدة البيانات.</p>
          </div>

          <button
            className="secondary-btn"
            onClick={markAllAsRead}
            disabled={unreadCount === 0 || updatingId !== null}
          >
            <CheckCheck size={16} />
            تحديد الكل كمقروء
          </button>
        </div>

        {loading ? (
          <div className="empty-state">
            جارٍ تحميل الإشعارات...
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <Bell size={28} />
            <b>لا توجد إشعارات</b>
            <p>ستظهر هنا التنبيهات عند تسجيلها في قاعدة البيانات.</p>
          </div>
        ) : (
          <div className="mention-list">
            {items.map((item) => (
              <article
                className="mention-row"
                key={item.id}
              >
                <div className="mention-type">
                  <Bell size={19} />
                </div>

                <div className="mention-body">
                  <div className="result-top">
                    <b>{item.title}</b>
                    <span>
                      {item.readAt ? "مقروء" : "جديد"}
                    </span>
                  </div>

                  <p>{item.message}</p>

                  <small>
                    {new Date(item.createdAt).toLocaleString("ar")}
                  </small>

                  {item.deliveryStatus === "failed" && (
                    <small className="notice error">
                      تعذر إرسال التنبيه: {item.deliveryError || "سبب غير محدد"}
                    </small>
                  )}

                  {item.sourceUrl && (
                    <a
                      className="secondary-btn inline-btn"
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      فتح المنشور
                      <ExternalLink size={15} />
                    </a>
                  )}
                </div>

                {!item.readAt && (
                  <button
                    className="icon-btn"
                    title="تحديد كمقروء"
                    disabled={updatingId !== null}
                    onClick={() => void markAsRead(item.id)}
                  >
                    <CheckCheck size={18} />
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
