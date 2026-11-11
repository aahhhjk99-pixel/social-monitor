import { useEffect, useState } from "react";
import { Activity, AlertTriangle, FileText, MessageSquareText, RadioTower, Tags, Users } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { listGroups, listKeywords, listMentions } from "../lib/data";
import type { GroupRecord, KeywordRecord, MentionRecord } from "../types";

export default function Dashboard() {
  const { user } = useAuth();
  const [groups,setGroups] = useState<GroupRecord[]>([]);
  const [keywords,setKeywords] = useState<KeywordRecord[]>([]);
  const [mentions,setMentions] = useState<MentionRecord[]>([]);
  const [error,setError] = useState("");

  useEffect(() => {
    if (!user) return;
    Promise.all([listGroups(user.uid),listKeywords(user.uid),listMentions(user.uid)])
      .then(([g,k,m])=>{setGroups(g);setKeywords(k);setMentions(m);})
      .catch(e=>setError(e instanceof Error ? e.message : "تعذر تحميل البيانات."));
  },[user]);

  const today = mentions.filter(m => new Date(m.detectedAt).toDateString() === new Date().toDateString()).length;
  const cards = [
    {label:"إجمالي المجموعات",value:groups.length,icon:Users},
    {label:"المجموعات النشطة",value:groups.filter(g=>g.status==="active").length,icon:RadioTower},
    {label:"إجمالي التطابقات",value:mentions.length,icon:FileText},
    {label:"تطابقات اليوم",value:today,icon:Activity},
  ];

  return <div>
    <div className="page-heading"><div><span className="eyebrow">نظرة عامة</span><h1>لوحة القيادة</h1><p>ملخص نشاط مجموعاتك ونتائج الكلمات المفتاحية.</p></div><span className="live-pill"><i/> متصل بقاعدة البيانات عند الإعداد</span></div>
    {error && <div className="notice error">{error}</div>}
    <div className="stats-grid">{cards.map(c=><div className="stat-card" key={c.label}><div className="stat-icon"><c.icon size={19}/></div><span>{c.label}</span><strong>{c.value}</strong><small>حسب البيانات المسجلة</small></div>)}</div>
    <div className="content-grid">
      <section className="panel wide-panel"><div className="panel-head"><div><h2>أحدث النتائج</h2><p>آخر الإشارات المسجلة في قاعدة البيانات</p></div><FileText size={18}/></div>
        {mentions.length===0 ? <EmptyState text="لا توجد نتائج بعد. ستظهر هنا النتائج التي يضيفها مصدر بيانات مصرح به."/> :
          <div className="mention-list">{mentions.slice(0,6).map(m=><div className="mention-row" key={m.id}><div className="mention-type">{m.contentType==="post"?<FileText/>:<MessageSquareText/>}</div><div className="mention-body"><b>{m.matchedTerms.join("، ")}</b><p>{m.content}</p><small>{new Date(m.detectedAt).toLocaleString("ar")}</small></div></div>)}</div>}
      </section>
      <section className="panel"><div className="panel-head"><div><h2>حالة النظام</h2><p>جاهزية مكونات المشروع</p></div><Activity size={18}/></div>
        <div className="health-item"><span className="health-indicator good"/>واجهة الموقع <b>جاهزة</b></div>
        <div className="health-item"><span className="health-indicator good"/>إعداد Firebase <b>متصل عند التهيئة</b></div>
        <div className="health-item"><span className="health-indicator warn"/>مصدر Facebook <b>غير مربوط</b></div>
        <div className="health-item"><span className="health-indicator warn"/>الفحص السحابي <b>بانتظار الموصل</b></div>
        <div className="notice warning compact"><AlertTriangle size={15}/> لا توجد مراقبة حقيقية قبل ربط مصدر بيانات مصرح.</div>
      </section>
    </div>
    <div className="bottom-grid">
      <section className="panel"><div className="panel-head"><div><h2>الكلمات المفتاحية</h2><p>عدد الكلمات المعرفة</p></div><Tags size={18}/></div><div className="big-number">{keywords.length}</div><small className="muted">كلمة أو عبارة مسجلة</small></section>
      <section className="panel"><div className="panel-head"><div><h2>أنواع المحتوى</h2><p>التوزيع المسجل</p></div><MessageSquareText size={18}/></div><div className="type-stats"><span>منشورات <b>{mentions.filter(m=>m.contentType==="post").length}</b></span><span>تعليقات <b>{mentions.filter(m=>m.contentType==="comment").length}</b></span></div></section>
    </div>
  </div>;
}

function EmptyState({text}:{text:string}) { return <div className="empty-state"><div><FileText size={25}/></div><b>لا توجد بيانات للعرض</b><p>{text}</p></div>; }
