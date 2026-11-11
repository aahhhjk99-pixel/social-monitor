import { FormEvent, useEffect, useState } from "react";
import { Plus, Tags, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { createKeyword, listGroups, listKeywords, removeKeyword, updateKeyword } from "../lib/data";
import type { GroupRecord, KeywordRecord } from "../types";

export default function Keywords(){
  const {user}=useAuth();const [items,setItems]=useState<KeywordRecord[]>([]);const [groups,setGroups]=useState<GroupRecord[]>([]);
  const [term,setTerm]=useState("");const [groupId,setGroupId]=useState("all");const [error,setError]=useState("");
  async function refresh(){if(!user)return;const [k,g]=await Promise.all([listKeywords(user.uid),listGroups(user.uid)]);setItems(k);setGroups(g);}
  useEffect(()=>{void refresh().catch(e=>setError(e.message));},[user]);
  async function submit(e:FormEvent){e.preventDefault();if(!user)return;try{await createKeyword(user.uid,term,groupId);setTerm("");await refresh();}catch(e){setError(e instanceof Error?e.message:"تعذر إضافة الكلمة.");}}
  async function toggle(k:KeywordRecord){try{await updateKeyword(k.id,{enabled:!k.enabled});await refresh();}catch(e){setError(e instanceof Error?e.message:"تعذر التحديث.");}}
  async function remove(k:KeywordRecord){if(!confirm("حذف هذه الكلمة؟"))return;try{await removeKeyword(k.id);await refresh();}catch(e){setError(e instanceof Error?e.message:"تعذر الحذف.");}}
  return <div><div className="page-heading"><div><span className="eyebrow">محرك المطابقة</span><h1>الكلمات المفتاحية</h1><p>أنشئ كلمات عامة أو اربطها بمجموعة محددة.</p></div><span className="count-pill">{items.length} كلمة</span></div>
    {error&&<div className="notice error">{error}</div>}
    <form className="panel add-form" onSubmit={submit}><div className="panel-head"><div><h2>إضافة كلمة جديدة</h2><p>تُحفظ في حسابك وتُستخدم عند معالجة محتوى متاح من مصدر مصرح.</p></div><Plus/></div><div className="form-grid"><label>الكلمة أو العبارة<input required value={term} onChange={e=>setTerm(e.target.value)} placeholder="مثال: شركة توصيل"/></label><label>نطاق التطبيق<select value={groupId} onChange={e=>setGroupId(e.target.value)}><option value="all">كل المجموعات</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label></div><button className="primary-btn"><Plus size={16}/> إضافة الكلمة</button></form>
    <section className="panel"><div className="panel-head"><div><h2>قائمة الكلمات</h2><p>إدارة الكلمات المضافة</p></div><Tags/></div>{items.length===0?<div className="empty-state">لا توجد كلمات بعد.</div>:<div className="table-wrap"><table><thead><tr><th>الكلمة</th><th>النطاق</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody>{items.map(k=><tr key={k.id}><td><b>{k.term}</b></td><td>{k.groupId==="all"?"كل المجموعات":groups.find(g=>g.id===k.groupId)?.name||"مجموعة محذوفة"}</td><td><span className={`status-pill ${k.enabled?"active":"paused"}`}>{k.enabled?"مفعّلة":"متوقفة"}</span></td><td><div className="row-actions"><button className="icon-btn" onClick={()=>void toggle(k)} title="تبديل الحالة">{k.enabled?<ToggleRight/>:<ToggleLeft/>}</button><button className="icon-btn danger-icon" onClick={()=>void remove(k)} title="حذف"><Trash2/></button></div></td></tr>)}</tbody></table></div>}</section>
  </div>;
}
