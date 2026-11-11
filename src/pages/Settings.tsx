import { useAuth } from "../auth/AuthContext";
import { firebaseReady } from "../firebase";
import { ShieldCheck, Database, Bell } from "lucide-react";

export default function Settings(){
  const {user}=useAuth();
  return <div><div className="page-heading"><div><span className="eyebrow">تفضيلات المنصة</span><h1>الإعدادات</h1><p>حالة حسابك والخدمات المرتبطة بالمشروع.</p></div></div>
    <section className="panel settings-panel"><div className="panel-head"><div><h2>الحساب</h2><p>بيانات تسجيل الدخول الحالية</p></div><ShieldCheck/></div><div className="setting-row"><span>البريد الإلكتروني</span><b>{user?.email}</b></div><div className="setting-row"><span>معرّف المستخدم</span><code>{user?.uid}</code></div></section>
    <section className="panel settings-panel"><div className="panel-head"><div><h2>الخدمات</h2><p>حالة الاتصال</p></div><Database/></div><div className="setting-row"><span>Firebase</span><b className={firebaseReady?"good-text":"warn-text"}>{firebaseReady?"تم إعداد المشروع":"غير مُعد"}</b></div><div className="setting-row"><span>Facebook Source Adapter</span><b className="warn-text">غير مربوط</b></div><div className="setting-row"><span>الإشعارات الفورية</span><b className="warn-text">لم تُفعّل بعد</b></div></section>
    <section className="panel settings-panel"><div className="panel-head"><div><h2>الأمان والخصوصية</h2><p>مبادئ حماية البيانات</p></div><Bell/></div><p className="muted">لا تخزن كلمات مرور Facebook أو Cookies أو رموز جلسات. لا تضع أسرار الخادم داخل الواجهة الأمامية.</p></section>
  </div>;
}
