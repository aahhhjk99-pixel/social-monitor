
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Clock,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertCircle,
  Database,
  Radio,
  CalendarClock,
} from "lucide-react";

import { useAuth } from "../auth/AuthContext";
import { supabase } from "../lib/supabase";

type MonitoringJob = {
  id: string;
  group_id: string;
  enabled: boolean;
  interval_hours: number;
  next_run_at: string | null;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
};

type MonitoringRun = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  posts_checked: number;
  comments_checked: number;
  matches_found: number;
  error_message: string | null;
};

type FunctionResult = {
  success?: boolean;
  message?: string;
  mode?: string;
  active_jobs?: number;
  error?: string;
};

function formatDate(value: string | null): string {
  if (!value) return "لم يحدث بعد";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "غير متوفر";
  }

  return date.toLocaleString("ar-LY", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function jobStatus(value: string | null): string {
  if (value === "running") return "قيد التشغيل";
  if (value === "success") return "اكتمل";
  if (value === "pending") return "بانتظار التشغيل";
  return "لم يبدأ";
}

function runStatus(value: string): string {
  if (value === "running") return "قيد التشغيل";
  if (value === "success") return "ناجح";
  if (value === "failed") return "فشل";
  return value;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (
    error &&
    typeof error === "object" &&
    "message" in error
  ) {
    return String(error.message);
  }

  return "حدث خطأ غير متوقع.";
}

export default function Monitoring() {
  const { user } = useAuth();

  const [jobs, setJobs] = useState<MonitoringJob[]>([]);
  const [runs, setRuns] = useState<MonitoringRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [functionResult, setFunctionResult] =
    useState<FunctionResult | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.uid) {
      setJobs([]);
      setRuns([]);
      setLoading(false);
      return;
    }

    const [jobsResult, runsResult] = await Promise.all([
      supabase
        .from("monitoring_jobs")
        .select(
          "id, group_id, enabled, interval_hours, next_run_at, last_run_at, last_status, last_error"
        )
        .eq("owner_id", user.uid)
        .order("created_at", { ascending: false }),

      supabase
        .from("monitoring_runs")
        .select(
          "id, started_at, finished_at, status, posts_checked, comments_checked, matches_found, error_message"
        )
        .eq("owner_id", user.uid)
        .order("started_at", { ascending: false })
        .limit(10),
    ]);

    if (jobsResult.error) throw jobsResult.error;
    if (runsResult.error) throw runsResult.error;

    setJobs((jobsResult.data ?? []) as MonitoringJob[]);
    setRuns((runsResult.data ?? []) as MonitoringRun[]);
  }, [user?.uid]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        await loadData();
      } catch (err) {
        if (active) setError(errorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [loadData]);

  async function refresh() {
    setLoading(true);
    setError("");
    setNotice("");

    try {
      await loadData();
      setNotice("تم تحديث بيانات المراقبة.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function testFunction() {
    if (testing) return;

    setTesting(true);
    setError("");
    setNotice("");
    setFunctionResult(null);

    try {
      const { data, error: functionError } =
        await supabase.functions.invoke("monitor-groups", {
          body: { action: "check" },
        });

      if (functionError) throw functionError;

      const result = data as FunctionResult;

      setFunctionResult(result);

      if (result?.success) {
        setNotice(
          "نجح اختبار الوظيفة المساعدة والاتصال بقاعدة البيانات."
        );
        await loadData();
      } else {
        setError(
          result?.error || "لم يصل تأكيد نجاح من الوظيفة."
        );
      }
    } catch (err) {
      setError(
        "تعذر اختبار الوظيفة: " + errorMessage(err)
      );
    } finally {
      setTesting(false);
    }
  }

  const activeJobs = jobs.filter((job) => job.enabled).length;

  const successfulRuns = runs.filter(
    (run) => run.status === "success"
  ).length;

  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">مركز التحكم</span>
          <h1>المراقبة</h1>
          <p>
            متابعة مهام الفحص المجدولة وحالة الخدمات الخلفية.
          </p>
        </div>

        <span className="count-pill">
          {activeJobs} مهمة نشطة
        </span>
      </div>

      {error && (
        <div
          className="notice error"
          role="alert"
          style={{ whiteSpace: "pre-line" }}
        >
          <AlertCircle size={17} />
          {error}
        </div>
      )}

      {notice && (
        <div className="notice warning" role="status">
          <CheckCircle2 size={17} />
          {notice}
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <CalendarClock size={20} />
          </div>
          <span>إجمالي المهام</span>
          <strong>{jobs.length}</strong>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Activity size={20} />
          </div>
          <span>المهام النشطة</span>
          <strong>{activeJobs}</strong>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <CheckCircle2 size={20} />
          </div>
          <span>عمليات ناجحة في السجل</span>
          <strong>{successfulRuns}</strong>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Clock size={20} />
          </div>
          <span>عمليات محفوظة</span>
          <strong>{runs.length}</strong>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>مصدر البيانات</h2>
            <p>
              إعداد ربط مصدر المنشورات الخارجي.
            </p>
          </div>

          <Radio size={20} />
        </div>

        <div className="notice warning">
          <AlertCircle size={18} />
          <div>
            <strong>SocialAPIs</strong>
            <p>
              تم إعداد وظيفة الربط بمصدر SocialAPIs.
              التحقق النهائي من جلب المنشورات وحفظ النتائج
              والإشعارات ما زال بانتظار الاختبار التشغيلي.
            </p>
          </div>
        </div>

        <div className="action-row">
          <button
            className="primary-btn"
            type="button"
            onClick={() => void testFunction()}
            disabled={testing || loading}
          >
            {testing ? (
              <>
                <RefreshCw size={16} />
                جارٍ اختبار الوظيفة...
              </>
            ) : (
              <>
                <Play size={16} />
                اختبار الوظيفة المساعدة
              </>
            )}
          </button>

          <button
            className="secondary-btn"
            type="button"
            onClick={() => void refresh()}
            disabled={loading || testing}
          >
            <RefreshCw size={16} />
            تحديث البيانات
          </button>
        </div>

        {functionResult && (
          <div className="result-panel">
            <strong>نتيجة اختبار الوظيفة المساعدة</strong>
            <p>
              {functionResult.message ||
                "تم استلام رد من الوظيفة."}
            </p>

            <div className="result-details">
              <span>
                المهام النشطة: {functionResult.active_jobs ?? 0}
              </span>
              <span>
                وضع الوظيفة: {functionResult.mode || "غير محدد"}
              </span>
            </div>

            <small>
              هذا الاختبار لا يؤكد وحده نجاح جلب المنشورات من SocialAPIs.
            </small>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>مهام المراقبة</h2>
            <p>
              المهام المسجلة في قاعدة البيانات لحسابك.
            </p>
          </div>

          <Database size={20} />
        </div>

        {loading ? (
          <div className="empty-state">
            <RefreshCw size={24} />
            <b>جارٍ تحميل المهام...</b>
          </div>
        ) : jobs.length === 0 ? (
          <div className="empty-state">
            <CalendarClock size={26} />
            <b>لا توجد مهام مراقبة مسجلة</b>
            <p>
              ستظهر المهام هنا بعد إعدادها وربطها بالمجموعات.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>معرّف المجموعة</th>
                  <th>الحالة</th>
                  <th>الفاصل الزمني</th>
                  <th>آخر تشغيل</th>
                  <th>التشغيل القادم</th>
                </tr>
              </thead>

              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <span className="mono-text">
                        {job.group_id.slice(0, 8)}...
                      </span>
                    </td>
                    <td>
                      {job.enabled
                        ? jobStatus(job.last_status)
                        : "متوقفة"}
                    </td>
                    <td>كل {job.interval_hours} ساعات</td>
                    <td>{formatDate(job.last_run_at)}</td>
                    <td>{formatDate(job.next_run_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>سجل عمليات الفحص</h2>
            <p>
              آخر عشر عمليات مسجلة في قاعدة البيانات.
            </p>
          </div>

          <Activity size={20} />
        </div>

        {loading ? (
          <div className="empty-state">
            <RefreshCw size={24} />
            <b>جارٍ تحميل السجل...</b>
          </div>
        ) : runs.length === 0 ? (
          <div className="empty-state">
            <Clock size={26} />
            <b>لا توجد عمليات فحص مسجلة بعد</b>
            <p>
              سيظهر سجل التشغيل هنا عند بدء تسجيل عمليات الفحص.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>وقت البدء</th>
                  <th>الحالة</th>
                  <th>المنشورات</th>
                  <th>التعليقات</th>
                  <th>التطابقات</th>
                </tr>
              </thead>

              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>{formatDate(run.started_at)}</td>
                    <td>{runStatus(run.status)}</td>
                    <td>{run.posts_checked}</td>
                    <td>{run.comments_checked}</td>
                    <td>{run.matches_found}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
