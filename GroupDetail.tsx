import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, ExternalLink, Users } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { listGroups, listKeywords, listMentions } from "../lib/data";
import type { GroupRecord, KeywordRecord, MentionRecord } from "../types";

export default function GroupDetail(){
  const {id}=useParams();const {user}=useAuth();
  const [group,setGroup]=useState<GroupRecord|null>(null);
  const [keywords,setKeywords]=useState<KeywordRecord[]>([]);
  const [mentions,setMentions]=useState<MentionRecord[]>([]);
  const [error,setError]=useState("");
  useEffect(()=>{if(!user||!id)return;Promise.all([listGroups(user.uid),listKeywords(user.uid),listMentions(user.uid)]).then(([g,k,m])=>{setGroup(g.find(x=>x.id===id)||null);setKeywords(k.filter(x=>x.groupId===id||x.groupId==="all"));setMentions(m.filter(x=>x.groupId===id));}).catch(e=>setError(e.message));},[user,id]);
  if(error)return <div className="notice error">{error}</div>;
  if(!group)return <div className="panel empty-state">جارٍ تحميل المجموعة أو أنها غير موجودة.</div>;
  return <div><Link className="back-link" to="/groups"><ArrowRight size={16}/> العودة للمجموعات</Link><div className="page-heading"><div><span className="eyebrow">صفحة المجموعة</span><h1>{group.name}</h1><p>{group.url}</p></div><span className={`status-pill ${group.status}`}>{group.status==="active"?"مفعّلة":group.status==="paused"?"متوقفة":"غير متحقق منها"}</span></div>
    <div className="stats-grid three"><div className="stat-card"><Users/><span>الكلمات المرتبطة</span><strong>{keywords.length}</strong></div><div className="stat-card"><span>النتائج المسجلة</span><strong>{mentions.length}</strong></div><div className="stat-card"><span>نوع المصدر</span><strong className="small-value">Facebook</strong></div></div>
    <section className="panel"><div className="panel-head"><div><h2>إعدادات الوصول</h2><p>حالة الوصول للمحتوى</p></div><ExternalLink size={18}/></div><div className="notice warning">هذه المجموعة مضافة يدوياً فقط. لم يتم التحقق من مصدر قادر على قراءة منشوراتها أو تعليقاتها.</div><a className="secondary-btn inline-btn" href={group.url} target="_blank" rel="noreferrer">فتح المجموعة الأصلية</a></section>
    <section className="panel"><div className="panel-head"><div><h2>الكلمات المرتبطة</h2><p>الكلمات العامة والخاصة بهذه المجموعة</p></div></div>{keywords.length?keywords.map(k=><span className="keyword-chip" key={k.id}>{k.term}</span>):<p className="muted">لا توجد كلمات مرتبطة.</p>}</section>
    <section className="panel"><h2>آخر النتائج</h2>{mentions.length?mentions.map(m=><div className="mention-row" key={m.id}><div className="mention-body"><b>{m.matchedTerms.join("، ")}</b><p>{m.content}</p></div></div>):<p className="muted">لا توجد نتائج لهذه المجموعة.</p>}</section>
  </div>;
}
