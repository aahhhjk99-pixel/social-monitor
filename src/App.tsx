
import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./auth/AuthContext";
import Layout from "./components/Layout";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Groups from "./pages/Groups";
import GroupDetail from "./pages/GroupDetail";
import Keywords from "./pages/Keywords";
import Mentions from "./pages/Mentions";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import Monitoring from "./pages/Monitoring";
import Analytics from "./pages/Analytics";
import Placeholder from "./pages/Placeholder";

function Protected({
  children
}: {
  children: ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        جارٍ تحميل Social Monitor...
      </div>
    );
  }

  return user ? (
    <>{children}</>
  ) : (
    <Navigate to="/login" replace />
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        جارٍ التحميل...
      </div>
    );
  }

  return (
    <Routes>
      {/* تسجيل الدخول */}
      <Route
        path="/login"
        element={
          user ? <Navigate to="/" replace /> : <Login />
        }
      />

      {/* الصفحات المحمية */}
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        {/* الرئيسية */}
        <Route index element={<Dashboard />} />

        {/* المراقبة */}
        <Route
          path="monitoring"
          element={<Monitoring />}
        />

        {/* المجموعات */}
        <Route
          path="groups"
          element={<Groups />}
        />

        <Route
          path="groups/:id"
          element={<GroupDetail />}
        />

        {/* المنشورات والتنبيهات */}
        <Route
          path="mentions"
          element={<Mentions />}
        />

        {/* الكلمات المفتاحية */}
        <Route
          path="keywords"
          element={<Keywords />}
        />

        {/* الإشعارات */}
        <Route
          path="notifications"
          element={<Notifications />}
        />

        {/* التحليلات الفعلية */}
        <Route
          path="analytics"
          element={<Analytics />}
        />

        {/* مصادر البيانات */}
        <Route
          path="sources"
          element={
            <Placeholder
              title="مصادر البيانات"
              description="إدارة موصلات البيانات المصرح بها."
            />
          }
        />

        {/* الإعدادات */}
        <Route
          path="settings"
          element={<Settings />}
        />
      </Route>

      {/* أي مسار غير معروف */}
      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  );
}
