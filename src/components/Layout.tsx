
import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  Activity,
  Bell,
  ChartNoAxesCombined,
  FileSearch,
  Gauge,
  LogOut,
  Search,
  Settings,
  Tags,
  Users,
} from "lucide-react";

import { useAuth } from "../auth/AuthContext";
import { supabase } from "../lib/supabase";

const links = [
  { to: "/", label: "الرئيسية", icon: Gauge, end: true },
  { to: "/monitoring", label: "المراقبة", icon: Activity },
  { to: "/groups", label: "المجموعات", icon: Users },
  { to: "/mentions", label: "الإشارات والنتائج", icon: FileSearch },
  { to: "/keywords", label: "الكلمات المفتاحية", icon: Tags },
  { to: "/notifications", label: "الإشعارات", icon: Bell },
  { to: "/analytics", label: "التحليلات", icon: ChartNoAxesCombined },
  { to: "/sources", label: "مصادر البيانات", icon: Search },
  { to: "/settings", label: "الإعدادات", icon: Settings },
];

export default function Layout() {
  const { user, logout } = useAuth();

  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(async () => {
    if (!user?.uid) {
      setUnreadCount(0);
      return;
    }

    const { count, error } = await supabase
      .from("monitoring_notifications")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.uid)
      .is("read_at", null);

    if (error) {
      console.error("Failed to load unread notifications:", error.message);
      return;
    }

    setUnreadCount(count ?? 0);
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setUnreadCount(0);
      return;
    }

    let active = true;

    const refreshCount = async () => {
      if (!active) return;
      await loadUnreadCount();
    };

    void refreshCount();

    const channel = supabase
      .channel(`layout-notifications-${user.uid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "monitoring_notifications",
          filter: `owner_id=eq.${user.uid}`,
        },
        () => {
          void refreshCount();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void refreshCount();
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error(
            "Notification realtime connection:",
            status
          );
        }
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [user?.uid, loadUnreadCount]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Activity size={22} />
          </div>

          <div>
            <strong>SOCIAL MONITOR</strong>
            <small>مراقبة وتحليل المحتوى</small>
          </div>
        </div>

        <div className="side-label">القائمة الرئيسية</div>

        <nav>
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              <Icon size={18} />

              <span>{label}</span>

              {to === "/notifications" && unreadCount > 0 && (
                <span
                  className="notification-badge"
                  aria-label={`${unreadCount} إشعار غير مقروء`}
                  style={{
                    marginInlineStart: "auto",
                    minWidth: 21,
                    height: 21,
                    padding: "0 6px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 20,
                    background: "#c99b45",
                    color: "#171717",
                    fontSize: 11,
                    fontWeight: 800,
                    lineHeight: 1,
                  }}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="user-chip">
            <div className="avatar">
              {user?.email?.[0]?.toUpperCase() || "U"}
            </div>

            <div className="user-meta">
              <b>{user?.email || "المستخدم"}</b>
              <small>الحساب الحالي</small>
            </div>
          </div>

          <button
            className="logout-btn"
            onClick={() => void logout()}
          >
            <LogOut size={17} />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <span className="breadcrumb">مساحة العمل</span>
            <span className="crumb-sep"> / </span>
            <b>Social Monitor</b>
          </div>

          <div className="top-actions">
            <span className="status-dot" />
            النظام جاهز للتهيئة
          </div>
        </header>

        <div className="page-content">
          <Outlet />
        </div>

        <footer className="footer">
          SOCIAL MONITOR
          <span>
            منصة مستقلة لمراقبة المحتوى المتاح بصورة مصرح بها
          </span>
        </footer>
      </main>
    </div>
  );
}
