
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clock3,
  Database,
  Facebook,
  RefreshCw,
  RadioTower,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

import { useAuth } from "../auth/AuthContext";
import { supabase, supabaseReady } from "../lib/supabase";

type GroupRow = {
  id: string;
  name: string | null;
  url: string | null;
  status: string | null;
};

type JobRow = {
  id: string;
  group_id: string;
  enabled: boolean;
  interval_hours: number | null;
  last_status: string | null;
  last_run_at: string | null;
  last_error: string | null;
  next_run_at: string | null;
};

type RunRow = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  posts_checked: number | null;
  comments_checked: number | null;
  matches_found: number | null;
};

type LoadState = {
  groups: GroupRow[];
  jobs: JobRow[];
  runs: RunRow[];
};

const emptyData: LoadState = {
  groups: [],
  jobs: [],
  runs: [],
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "لم يسجل بعد";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "غير متوفر";
  }

  return date.toLocaleString("ar-LY", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function readableError(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return "حدث خطأ غير متوقع أثناء تحميل البيانات.";
}

export default function Sources() {
  const { user } = useAuth();

  const [data, setData] = useState<LoadState>(emptyData);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.uid) {
      setData(emptyData);
      setLoading(false);
      return;
    }

    if (!supabaseReady) {
      throw new Error("إعدادات اتصال Supabase غير مكتملة.");
    }

    const [groupsResult, jobsResult, runsResult] = await Promise.all([
      supabase
        .from("groups")
        .select("id, name, url, status, created_at")
        .eq("owner_id", user.uid)
        .order("created_at", { ascending: false }),

      supabase
        .from("monitoring_jobs")
        .select(
          "id, group_id, enabled, interval_hours, last_status, last_run_at, last_error, next_run_at, created_at"
        )
        .eq("owner_id", user.uid)
        .order("created_at", { ascending: false }),

      supabase
        .from("monitoring_runs")
        .select(
          "id, started_at, finished_at, status, posts_checked, comments_checked, matches_found"
        )
        .eq("owner_id", user.uid)
        .order("started_at", { ascending: false })
        .limit(20),
    ]);

    const failures = [
      groupsResult.error,
      jobsResult.error,
      runsResult.error,
    ].filter(Boolean);

    if (failures.length) {
      throw new Error(
        failures
          .map((item) => item?.message)
          .filter(Boolean)
          .join(" — ")
      );
    }

    setData({
      groups: (groupsResult.data ?? []) as GroupRow[],
      jobs: (jobsResult.data ?? []) as JobRow[],
      runs: (runsResult.data ?? []) as RunRow[],
    });

    setCheckedAt(new Date().toISOString());
  }, [user?.uid]);

  useEffect(() => {
    let active = true;

    async function initialLoad() {
      setLoading(true);
      setError("");

      try {
        await loadData();
      } catch (err) {
        if (active) {
          setError(readableError(err));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void initialLoad();

    return () => {
      active = false;
    };
  }, [loadData]);

  async function refresh() {
    if (refreshing) return;

    setRefreshing(true);
    setError("");

    try {
      await loadData();
    } catch (err) {
      setError(readableError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const activeJobs = data.jobs.filter((job) => job.enabled);

  const latestRun = data.runs[0] ?? null;

  const latestSuccessfulRun =
    data.runs.find((run) => run.status === "success") ?? null;

  const hasSuccessfulFetch = Boolean(latestSuccessfulRun);

  const failedJobs = activeJobs.filter(
    (job) =>
      job.last_status === "failed" ||
      Boolean(job.last_error)
  ).length;

  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            الاتصالات والتكاملات
          </span>

          <h1>مصادر البيانات</h1>

          <p>
            متابعة مصادر المنشورات وحالة الربط وقاعدة البيانات من مكان واحد.
          </p>
        </div>

        <button
          className="secondary-btn"
          type="button"
          onClick={() => void refresh()}
          disabled={loading || refreshing}
        >
          <RefreshCw size={16} />
          {refreshing ? "جارٍ التحديث..." : "تحديث الحالة"}
        </button>
      </div>

      {error && (
        <div className="notice error" role="alert">
          <AlertTriangle size={17} />
          <span>{error}</span>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <RadioTower size={19} />
          </div>
          <span>المجموعات المسجلة</span>
          <strong>{data.groups.length}</strong>
          <small>في حسابك الحالي</small>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Activity size={19} />
          </div>
          <span>مهام المراقبة النشطة</span>
          <strong>{activeJobs.length}</strong>
          <small>المهام المفعّلة حالياً</small>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <CheckCircle2 size={19} />
          </div>
          <span>عمليات ناجحة</span>
          <strong>
            {
              data.runs.filter(
                (run) => run.status === "success"
              ).length
            }
          </strong>
          <small>ضمن آخر 20 عملية</small>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Database size={19} />
          </div>
          <span>العمليات المسجلة</span>
          <strong>{data.runs.length}</strong>
          <small>ضمن سجل الفحص الأخير</small>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>موصل SocialAPIs</h2>
            <p>
              مصدر جلب منشورات مجموعات فيسبوك المستخدم في نظام المراقبة.
            </p>
          </div>

          <RadioTower size={20} />
        </div>

        <div className="health-item">
          <span
            className={
              hasSuccessfulFetch
                ? "health-indicator good"
                : "health-indicator warn"
            }
          />
          حالة جلب البيانات

          <b>
            {hasSuccessfulFetch
              ? "يوجد تشغيل ناجح مسجل"
              : "لا يوجد تشغيل ناجح في السجل المحمّل"}
          </b>
        </div>

        <div className="health-item">
          <span
            className={
              activeJobs.length > 0
                ? "health-indicator good"
                : "health-indicator warn"
            }
          />
          جدولة المراقبة

          <b>
            {activeJobs.length > 0
              ? `${activeJobs.length} مهمة مفعّلة`
              : "لا توجد مهام مفعّلة"}
          </b>
        </div>

        <div className="health-item">
          <span
            className={
              failedJobs === 0
                ? "health-indicator good"
                : "health-indicator warn"
            }
          />
          أخطاء المهام النشطة

          <b>{failedJobs}</b>
        </div>

        <div className="notice compact">
          <ShieldCheck size={17} />

          <div>
            <b>حماية بيانات الاتصال</b>
            <p>
              مفاتيح SocialAPIs تبقى في إعدادات الخدمات الخلفية
              ولا يتم عرضها داخل صفحة الموقع.
            </p>
          </div>
        </div>

        {latestSuccessfulRun && (
          <div className="result-panel">
            <b>آخر تشغيل ناجح مسجل</b>

            <p>
              {formatDate(
                latestSuccessfulRun.finished_at ||
                latestSuccessfulRun.started_at
              )}
            </p>

            <div className="result-details">
              <span>
                منشورات: {latestSuccessfulRun.posts_checked ?? 0}
              </span>

              <span>
                تعليقات: {latestSuccessfulRun.comments_checked ?? 0}
              </span>

              <span>
                تطابقات: {latestSuccessfulRun.matches_found ?? 0}
              </span>
            </div>
          </div>
        )}

        {latestRun && latestRun.status !== "success" && (
          <div className="notice warning compact">
            <Clock3 size={16} />

            آخر عملية مسجلة حالتها: {latestRun.status}
            — {formatDate(latestRun.started_at)}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>مجموعات فيسبوك المرتبطة</h2>
            <p>
              المجموعات التي أُضيفت إلى حسابك ومهام مراقبتها.
            </p>
          </div>

          <Facebook size={20} />
        </div>

        {loading ? (
          <div className="empty-state">
            <RefreshCw size={24} />
            <b>جارٍ تحميل مصادر البيانات...</b>
          </div>
        ) : data.groups.length === 0 ? (
          <div className="empty-state">
            <Facebook size={26} />
            <b>لا توجد مجموعات مسجلة</b>
            <p>
              أضف مجموعة من صفحة المجموعات لتظهر هنا.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>المجموعة</th>
                  <th>حالة المجموعة</th>
                  <th>المراقبة</th>
                  <th>الفاصل</th>
                  <th>آخر تشغيل</th>
                </tr>
              </thead>

              <tbody>
                {data.groups.map((group) => {
                  const job = data.jobs.find(
                    (item) => item.group_id === group.id
                  );

                  return (
                    <tr key={group.id}>
                      <td>
                        <div>
                          <b>
                            {group.name || "مجموعة بدون اسم"}
                          </b>

                          {group.url && (
                            <div>
                              <a
                                href={group.url}
                                target="_blank"
                                rel="noreferrer"
                                className="muted"
                              >
                                فتح رابط المجموعة
                                <ExternalLink size={12} />
                              </a>
                            </div>
                          )}
                        </div>
                      </td>

                      <td>{group.status || "غير محدد"}</td>

                      <td>
                        {job
                          ? job.enabled
                            ? "مفعّلة"
                            : "متوقفة"
                          : "لا توجد مهمة"}
                      </td>

                      <td>
                        {job?.interval_hours
                          ? `كل ${job.interval_hours} ساعات`
                          : "—"}
                      </td>

                      <td>{formatDate(job?.last_run_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>قاعدة البيانات</h2>
            <p>
              مصدر تخزين المجموعات والمهام وسجل عمليات الفحص.
            </p>
          </div>

          <Database size={20} />
        </div>

        <div className="health-item">
          <span
            className={
              supabaseReady
                ? "health-indicator good"
                : "health-indicator warn"
            }
          />
          إعداد اتصال Supabase

          <b>
            {supabaseReady
              ? "الإعدادات موجودة"
              : "الإعدادات ناقصة"}
          </b>
        </div>

        <div className="health-item">
          <span
            className={
              error
                ? "health-indicator warn"
                : checkedAt
                  ? "health-indicator good"
                  : "health-indicator warn"
            }
          />
          قراءة بيانات الحساب

          <b>
            {error
              ? "تعذر التحميل"
              : checkedAt
                ? "تم التحميل بنجاح"
                : "بانتظار التحقق"}
          </b>
        </div>

        <p className="muted">
          آخر تحديث للصفحة: {formatDate(checkedAt)}
        </p>
      </section>
    </div>
  );
}
