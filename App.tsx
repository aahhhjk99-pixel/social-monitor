import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Groups from "./pages/Groups";
import GroupDetail from "./pages/GroupDetail";
import Keywords from "./pages/Keywords";
import Mentions from "./pages/Mentions";
import Settings from "./pages/Settings";
import Placeholder from "./pages/Placeholder";

function Protected({children}:{children:React.ReactNode}) {
  const {user,loading}=useAuth();
  if(loading)return <div className="loading-screen">جارٍ تحميل Social Monitor...</div>;
  return user?<>{children}</>:<Navigate to="/login" replace/>;
}

export default function App(){
  const {user,loading}=useAuth();
  if(loading)return <div className="loading-screen">جارٍ التحميل...</div>;
  return <Routes>
    <Route path="/login" element={user?<Navigate to="/" replace/>:<Login/>}/>
    <Route path="/" element={<Protected><Layout/></Protected>}>
      <Route index element={<Dashboard/>}/>
      <Route path="monitoring" element={<Placeholder title="المراقبة" description="إدارة حالة الفحص ومهامه المجدولة."/>}/>
      <Route path="groups" element={<Groups/>}/>
      <Route path="groups/:id" element={<GroupDetail/>}/>
      <Route path="mentions" element={<Mentions/>}/>
      <Route path="keywords" element={<Keywords/>}/>
      <Route path="notifications" element={<Placeholder title="الإشعارات" description="سجل التنبيهات وإعدادات Web Push."/>}/>
      <Route path="analytics" element={<Placeholder title="التحليلات" description="مقارنات وإحصائيات المجموعات والكلمات."/>}/>
      <Route path="sources" element={<Placeholder title="مصادر البيانات" description="إدارة موصلات البيانات المصرح بها."/>}/>
      <Route path="settings" element={<Settings/>}/>
    </Route>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>;
}
