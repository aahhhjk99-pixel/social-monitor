import { NavLink, Outlet } from "react-router-dom";
import { Activity, Bell, ChartNoAxesCombined, CircleHelp, FileSearch, Folder, Gauge, LogOut, Search, Settings, Tags, Users } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

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
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Activity size={22}/></div>
          <div><strong>SOCIAL MONITOR</strong><small>مراقبة وتحليل المحتوى</small></div>
        </div>
        <div className="side-label">القائمة الرئيسية</div>
        <nav>{links.map(({to,label,icon:Icon,end}) => (
          <NavLink key={to} to={to} end={end} className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
            <Icon size={18}/><span>{label}</span>
          </NavLink>
        ))}</nav>
        <div className="sidebar-bottom">
          <div className="user-chip"><div className="avatar">{user?.email?.[0]?.toUpperCase() || "U"}</div><div className="user-meta"><b>{user?.email || "المستخدم"}</b><small>الحساب الحالي</small></div></div>
          <button className="logout-btn" onClick={() => void logout()}><LogOut size={17}/> تسجيل الخروج</button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div><span className="breadcrumb">مساحة العمل</span><span className="crumb-sep"> / </span><b>Social Monitor</b></div>
          <div className="top-actions"><span className="status-dot"/> النظام جاهز للتهيئة</div>
        </header>
        <div className="page-content"><Outlet /></div>
        <footer className="footer">SOCIAL MONITOR <span>منصة مستقلة لمراقبة المحتوى المتاح بصورة مصرح بها</span></footer>
      </main>
    </div>
  );
}
