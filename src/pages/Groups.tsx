import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Pause, Play, Plus, Users, Trash2 } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { createGroup, listGroups, removeGroup, setGroupStatus } from "../lib/data";
import type { GroupRecord } from "../types";

export default function Groups() {
  const {user}=useAuth();
  const [groups,setGroups]=useState<GroupRecord[]>([]);
  const [name,setName]=useState("");
  const [url,setUrl]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);

  async function refresh(){ if(user) setGroups(await listGroups(user.uid)); }
  useEffect(()=>{void refresh().catch(e=>setError(e.message));},[user]);

  async function submit(e:FormEvent){
    e.preventDefault(); if(!user)return;
    setBusy(true);setError("");
    try{await createGroup(user.uid,name,url);setName("");setUrl("");await refresh();}
    catch(e){setError(e instanceof Error?e.message:"تعذر إضافة المجموعة.");}
    finally{setBusy(false);}
  }
  async function toggle(g:GroupRecord){
    try{await setGroupStatus(g.id,g.status==="active"?"paused":"unverified");await refresh();}
    catch(e){setError(e instanceof Error?e.message:"تعذر تحديث الحالة.");}
  }
  async function remove(g:GroupRecord){
    if(!confirm("هل تريد حذف المجموعة؟"))return;
    try{await removeGroup(g.id);await refresh();}
    catch(e){setError(e instanceof Error?e.message:"تعذر حذف المجموعة.");}
  }

  return <div>
    <div className="page-heading"><div><span className="eyebrow">إدارة المصادر</span><h1>المجموعات</h1><p>أضف مجموعاتك ونظّم إعدادات كل مجموعة بشكل مستقل.</p></div><span className="count-pill">{groups.length} مجموعة</span></div>
    {error&&<div className="notice error">{error}</div>}
    <form className="panel add-form" onSubmit={submit}>
      <div className="panel-head"><div><h2>إضافة مجموعة</h2><p>أدخل الاسم والرابط. الإضافة لا تعني أن الوصول للمحتوى قد تم التحقق منه.</p></div><Plus size={19}/></div>
      <div className="form-grid"><label>اسم المجموعة<input required value={name} onChange={e=>setName(e.target.value)} placeholder="مثال: أخبار وخدمات ليبيا"/></label><label>رابط المجموعة<input required type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://www.facebook.com/groups/..."/></label></div>
      <button className="primary-btn" disabled={busy}><Plus size={16}/>{busy?"جارٍ الإضافة":"إضافة المجموعة"}</button>
    </form>
    <div className="section-title"><h2>مجموعاتي</h2><span>{groups.length} نتيجة</span></div>
    {groups.length===0?<div className="panel empty-state"><Users size={28}/><b>لم تضف أي مجموعة بعد</b><p>أضف رابط مجموعة لبدء تنظيم إعداداتها.</p></div>:
      <div className="groups-grid">{groups.map(g=><article className="group-card" key={g.id}><div className="group-card-top"><div className="group-avatar"><Users/></div><span className={`status-pill ${g.status}`}>{g.status==="active"?"مفعّلة":g.status==="paused"?"متوقفة":"غير متحقق منها"}</span></div><h3>{g.name}</h3><p className="group-url">{g.url}</p><div className="group-meta"><span>أضيفت {new Date(g.createdAt).toLocaleDateString("ar")}</span></div><div className="card-actions"><Link className="secondary-btn" to={`/groups/${g.id}`}>فتح الصفحة</Link><button className="icon-btn" title="تغيير الحالة" onClick={()=>void toggle(g)}>{g.status==="active"?<Pause size={16}/>:<Play size={16}/>}</button><a className="icon-btn" href={g.url} target="_blank" rel="noreferrer" title="فتح المجموعة"><ExternalLink size={16}/></a><button className="icon-btn danger-icon" title="حذف" onClick={()=>void remove(g)}><Trash2 size={16}/></button></div></article>)}</div>}
  </div>;
}
