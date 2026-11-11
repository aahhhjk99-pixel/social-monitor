import { Activity } from "lucide-react";
export default function Placeholder({title,description}:{title:string;description:string}) {
  return <div><div className="page-heading"><div><span className="eyebrow">قريباً</span><h1>{title}</h1><p>{description}</p></div></div><section className="panel empty-state"><Activity size={28}/><b>هذا القسم لم يُفعّل بعد</b><p>سيتم ربطه بعد تجهيز مصدر البيانات والخدمات الخلفية المطلوبة.</p></section></div>;
}
