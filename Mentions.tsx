import { useEffect, useState } from "react";
import { ExternalLink, FileText, MessageSquareText } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { listGroups, listMentions } from "../lib/data";
import type { GroupRecord, MentionRecord } from "../types";

export default function Mentions(){
  const {user}=useAuth();const [items,setItems]=useState<MentionRecord[]>([]);const [groups,setGroups]=useState<GroupRecord[]>([]);const [filter,setFilter]=useState("all");const [error,setError]=useState("");
  useEffect(()=>{if(!user)return;Promise.all([listMentions(user.uid),listGroups(user.uid)]).then(([m,g])=>{setItems(m);setGroups(g);}).catch(e=>setError(e.message));},[user]);
  const visible=items.filter(m=>filter==="all"||m.contentType===filter);
  return <div><div className="page-heading"><div><span className="eyebrow">مركز الرصد</span><h1>الإشارات والنتائج</h1><p>كل العناصر التي وصلت إلى قاعدة البيانات من مصادر البيانات.</p></div><span className="count-pill">{items.length} نتيجة</span></div>{error&&<div className="notice error">{error}</div>}
    <section className="panel"><div className="toolbar"><div><h2>سجل النتائج</h2><p>النتائج لا تُنشأ تلقائياً قبل ربط مصدر بيانات فعلي.</p></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">كل الأنواع</option><option value="post">منشورات</option><option value="comment">تعليقات</option></select></div>
      {visible.length===0?<div className="empty-state"><FileText size={28}/><b>لا توجد نتائج</b><p>ستظهر هنا النتائج بعد ربط مصدر مصرح وإدخال البيانات.</p></div>:visible.map(m=><article className="result-card" key={m.id}><div className="result-icon">{m.contentType==="post"?<FileText/>:<MessageSquareText/>}</div><div className="result-main"><div className="result-top"><b>{m.matchedTerms.join("، ")}</b><span>{m.contentType==="post"?"منشور":"تعليق"}</span></div><p>{m.content}</p><small>{groups.find(g=>g.id===m.groupId)?.name||"مجموعة غير معروفة"} · {new Date(m.detectedAt).toLocaleString("ar")}</small></div>{m.sourceUrl&&<a className="icon-btn" href={m.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink/></a>}</article>)}
    </section></div>;
}
