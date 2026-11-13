
import { useEffect, useState } from "react";

import {
  Activity,
  AlertTriangle,
  FileText,
  MessageSquareText,
  RadioTower,
  Tags,
  Users
} from "lucide-react";

import { useAuth } from "../auth/AuthContext";

import {
  listGroups,
  listKeywords,
  listMentions
} from "../lib/data";

import { supabase, supabaseReady } from "../lib/supabase";

import type {
  GroupRecord,
  KeywordRecord,
  MentionRecord
} from "../types";

type MonitoringJob = {
  id: string;
  enabled: boolean;
  last_status: string | null;
  last_run_at: string | null;
  last_error: string | null;
  next_run_at: string | null;
  interval_hours: number | null;
};

export default function Dashboard() {
  const { user } = useAuth();

  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [keywords, setKeywords] = useState<KeywordRecord[]>([]);
  const [mentions, setMentions] = useState<MentionRecord[]>([]);
  const [monitoringJobs, setMonitoringJobs] = useState<MonitoringJob[]>([]);
  const [databaseChecked, setDatabaseChecked] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadData() {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      setDatabaseChecked(false);

      try {
        const [
          groupData,
          keywordData,
          mentionData,
          jobsResult
        ] = await Promise.all([
          listGroups(user.uid),
          listKeywords(user.uid),
          listMentions(user.uid),
          supabaseReady
            ? supabase
                .from("monitoring_jobs")
                .select(
                  "id, enabled, last_status, last_run_at, last_error, next_run_at, interval_hours"
                )
                .eq("owner_id", user.uid)
                .order("last_run_at", { ascending: false })
            : Promise.resolve({
                data: null,
                error: new Error("Supabase غير مُعد.")
              })
        ]);

        if (!active) return;

        setGroups(groupData);
        setKeywords(keywordData);
        setMentions(mentionData);

        if (jobsResult.error) {
          setMonitoringJobs([]);
          setError(
            "تعذر قراءة حالة مهام المراقبة من قاعدة البيانات: " +
              jobsResult.error.message
          );
        } else {
          setMonitoringJobs(
            (jobsResult.data ?? []) as MonitoringJob[]
          );
        }

        setDatabaseChecked(!jobsResult.error);
      } catch (err) {
        if (!active) return;

        setError(
          err instanceof Error
            ? err.message
            : "تعذر تحميل البيانات."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [user]);

  const enabledJobs = monitoringJobs.filter(
    (job) => job.enabled
  );

  const successfulJobs = enabledJobs.filter(
    (job) =>
      job.last_status === "success" &&
      Boolean(job.last_run_at) &&
      !job.last_error
  );

  const latestSuccessfulJob = successfulJobs
    .slice()
    .sort(
      (a, b) =>
        new Date(b.last_run_at!).getTime() -
        new Date(a.last_run_at!).getTime()
    )[0];

  const hasActiveMonitor = enabledJobs.length > 0;
  const hasSuccessfulCheck = Boolean(latestSuccessfulJob);

  const facebookStatus = !databaseChecked
    ? "غير متحقق"
    : hasSuccessfulCheck
      ? "موصل عبر SocialAPIs"
      : hasActiveMonitor
        ? "مهمة مفعّلة، بانتظار فحص ناجح"
        : "لا توجد مراقبة نشطة";

  const cloudStatus = !databaseChecked
    ? "تعذر التحقق"
    : hasSuccessfulCheck
      ? "آخر تشغيل ناجح"
      : hasActiveMonitor
        ? "بانتظار أول فحص ناجح"
        : "لا توجد مهمة نشطة";

  const formatDate = (value: string | null) => {
    if (!value) return "غير متوفر";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "غير متوفر";
    }

    return date.toLocaleString("ar-LY");
  };

  const today = mentions.filter((mention) => {
    return (
      new Date(mention.detectedAt).toDateString() ===
      new Date().toDateString()
    );
  }).length;

  const cards = [
    {
      label: "إجمالي المجموعات",
      value: groups.length,
      icon: Users
    },
    {
      label: "المجموعات النشطة",
      value: groups.filter(
        (group) => group.status === "active"
      ).length,
      icon: RadioTower
    },
    {
      label: "إجمالي التطابقات",
      value: mentions.length,
      icon: FileText
    },
    {
      label: "تطابقات اليوم",
      value: today,
      icon: Activity
    }
  ];

  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">نظرة عامة</span>
          <h1>لوحة القيادة</h1>
          <p>
            ملخص نشاط مجموعاتك ونتائج الكلمات المفتاحية.
          </p>
        </div>

        <span className="live-pill">
          <i />
          {databaseChecked
            ? "Supabase متصل"
            : supabaseReady
              ? "جاري التحقق من Supabase"
              : "Supabase غير مُعد"}
        </span>
      </div>

      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}

      {loading && (
        <div className="notice warning">
          جارٍ تحميل بيانات حسابك...
        </div>
      )}

      <div className="stats-grid">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div className="stat-card" key={card.label}>
              <div className="stat-icon">
                <Icon size={19} />
              </div>

              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>حسب البيانات المسجلة</small>
            </div>
          );
        })}
      </div>

      <div className="content-grid">
        <section className="panel wide-panel">
          <div className="panel-head">
            <div>
              <h2>أحدث النتائج</h2>
              <p>
                آخر الإشارات المسجلة في قاعدة البيانات
              </p>
            </div>

            <FileText size={18} />
          </div>

          {mentions.length === 0 ? (
            <EmptyState
              text="لا توجد نتائج بعد. ستظهر هنا النتائج التي يضيفها مصدر البيانات عند العثور على تطابق."
            />
          ) : (
            <div className="mention-list">
              {mentions.slice(0, 6).map((mention) => (
                <div
                  className="mention-row"
                  key={mention.id}
                >
                  <div className="mention-type">
                    {mention.contentType === "post" ? (
                      <FileText />
                    ) : (
                      <MessageSquareText />
                    )}
                  </div>

                  <div className="mention-body">
                    <b>
                      {mention.matchedTerms.join("، ")}
                    </b>

                    <p>{mention.content}</p>

                    <small>
                      {new Date(
                        mention.detectedAt
                      ).toLocaleString("ar")}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>حالة النظام</h2>
              <p>حالة الاتصال ومهام المراقبة المسجلة</p>
            </div>

            <Activity size={18} />
          </div>

          <div className="health-item">
            <span className="health-indicator good" />
            واجهة الموقع
            <b>جاهزة</b>
          </div>

          <div className="health-item">
            <span
              className={
                databaseChecked
                  ? "health-indicator good"
                  : "health-indicator warn"
              }
            />
            Supabase
            <b>
              {databaseChecked
                ? "متصل"
                : supabaseReady
                  ? "غير متحقق"
                  : "غير مُعد"}
            </b>
          </div>

          <div className="health-item">
            <span
              className={
                hasSuccessfulCheck
                  ? "health-indicator good"
                  : "health-indicator warn"
              }
            />
            مصدر Facebook
            <b>{facebookStatus}</b>
          </div>

          <div className="health-item">
            <span
              className={
                hasSuccessfulCheck
                  ? "health-indicator good"
                  : "health-indicator warn"
              }
            />
            الفحص السحابي
            <b>{cloudStatus}</b>
          </div>

          {hasSuccessfulCheck && latestSuccessfulJob && (
            <div className="notice compact">
              <Activity size={15} />
              <div>
                <b>آخر فحص ناجح</b>
                <p>
                  {formatDate(latestSuccessfulJob.last_run_at)}
                </p>

                <b>الفاصل بين عمليات المراقبة</b>
                <p>
                  {latestSuccessfulJob.interval_hours ?? "غير محدد"} ساعة
                </p>

                <b>موعد التشغيل التالي المسجل</b>
                <p>
                  {formatDate(latestSuccessfulJob.next_run_at)}
                </p>
              </div>
            </div>
          )}

          {databaseChecked && !hasSuccessfulCheck && (
            <div className="notice warning compact">
              <AlertTriangle size={15} />
              {!hasActiveMonitor
                ? "لا توجد مهمة مراقبة مفعّلة لهذا الحساب."
                : "توجد مهمة مراقبة مفعّلة، لكن لا يوجد تشغيل ناجح مسجل لها حتى الآن."}
            </div>
          )}

          {!databaseChecked && !loading && (
            <div className="notice warning compact">
              <AlertTriangle size={15} />
              لم نتمكن من التحقق من حالة مهام المراقبة.
            </div>
          )}
        </section>
      </div>

      <div className="bottom-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>الكلمات المفتاحية</h2>
              <p>عدد الكلمات المعرفة</p>
            </div>

            <Tags size={18} />
          </div>

          <div className="big-number">
            {keywords.length}
          </div>

          <small className="muted">
            كلمة أو عبارة مسجلة
          </small>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>أنواع المحتوى</h2>
              <p>التوزيع المسجل</p>
            </div>

            <MessageSquareText size={18} />
          </div>

          <div className="type-stats">
            <span>
              منشورات
              <b>
                {
                  mentions.filter(
                    (item) => item.contentType === "post"
                  ).length
                }
              </b>
            </span>

            <span>
              تعليقات
              <b>
                {
                  mentions.filter(
                    (item) => item.contentType === "comment"
                  ).length
                }
              </b>
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <div>
        <FileText size={25} />
      </div>

      <b>لا توجد بيانات للعرض</b>
      <p>{text}</p>
    </div>
  );
}
