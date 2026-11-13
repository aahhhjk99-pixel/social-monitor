
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
import Sources from "./pages/Sources";

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
      <Route
        path="/login"
        element={
          user ? <Navigate to="/" replace /> : <Login />
        }
      />

      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />

        <Route
          path="monitoring"
          element={<Monitoring />}
        />

        <Route
          path="groups"
          element={<Groups />}
        />

        <Route
          path="groups/:id"
          element={<GroupDetail />}
        />

        <Route
          path="mentions"
          element={<Mentions />}
        />

        <Route
          path="keywords"
          element={<Keywords />}
        />

        <Route
          path="notifications"
          element={<Notifications />}
        />

        <Route
          path="analytics"
          element={<Analytics />}
        />

        <Route
          path="sources"
          element={<Sources />}
        />

        <Route
          path="settings"
          element={<Settings />}
        />
      </Route>

      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  );
}
