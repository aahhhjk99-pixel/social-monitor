
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  FileText,
  RefreshCw,
  Tags,
  TrendingUp,
  Users,
  XCircle,
  Target,
  CalendarDays
} from "lucide-react";

import { useAuth } from "../auth/AuthContext";
import { supabase } from "../lib/supabase";

type MentionRow = {
  id: string;
  content: string | null;
  content_type: string | null;
  matched_terms: string[] | null;
  detected_at: string;
  group_id: string | null;
};

type RunRow = {
  id: string;
  status: string;
  posts_checked: number | null;
  comments_checked: number | null;
  matches_found: number | null;
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
};

type JobRow = {
  id: string;
  enabled: boolean;
  last_status: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  interval_hours: number | null;
};

type KeywordRow = {
  id: string;
  keyword: string;
  is_active: boolean;
  priority: string | null;
};

type GroupRow = {
  id: string;
  name: string;
  status: string;
};

type Period = "7" | "30" | "90" | "all";

type AnalyticsData = {
  mentions: MentionRow[];
  runs: RunRow[];
  jobs: JobRow[];
  keywords: KeywordRow[];
  groups: GroupRow[];
};

const EMPTY_DATA: AnalyticsData = {
  mentions: [],
  runs: [],
  jobs: [],
  keywords: [],
  groups: []
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ar-LY").format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "غير متوفر";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "غير متوفر";
  }

  return date.toLocaleString("ar-LY", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function getDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getLastDays(days: number) {
  const result: string[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    result.push(getDayKey(date));
  }

  return result;
}

function isWithinPeriod(
  value: string,
  period: Period
): boolean {
  if (period === "all") return true;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return false;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (Number(period) - 1));

  return date >= start;
}

function getStatusLabel(status: string): string {
  if (status === "success") return "ناجحة";
  if (status === "failed") return "فاشلة";
  if (status === "running") return "قيد التشغيل";

  return status || "غير معروف";
}

function calculateDuration(run: RunRow): string {
  if (!run.finished_at) return "قيد التنفيذ";

  const start = new Date(run.started_at).getTime();
  const finish = new Date(run.finished_at).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(finish)) {
    return "غير متوفر";
  }

  const seconds = Math.max(0, Math.round((finish - start) / 1000));

  if (seconds < 60) return `${seconds} ثانية`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes} دقيقة و${remainingSeconds} ثانية`;
}

function StatCard({
  label,
  value,
  description,
  icon: Icon
}: {
  label: string;
  value: number;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <div className="stat-card">
      <div className="stat-icon">
        <Icon size={19} />
      </div>

      <span>{label}</span>

      <strong>{formatNumber(value)}</strong>

      <small>{description}</small>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <div>
        <BarChart3 size={27} />
      </div>

      <b>لا توجد بيانات كافية للتحليل</b>

      <p>{text}</p>
    </div>
  );
}

export default function Analytics() {
  const { user } = useAuth();

  const [data, setData] = useState<AnalyticsData>(EMPTY_DATA);
  const [period, setPeriod] = useState<Period>("30");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadAnalytics = useCallback(async () => {
    if (!user?.uid) {
      setData(EMPTY_DATA);
      return;
    }

    const [
      mentionsResult,
      runsResult,
      jobsResult,
      keywordsResult,
      groupsResult
    ] = await Promise.all([
      supabase
        .from("detected_items")
        .select("id, content, content_type, matched_terms, detected_at, group_id")
        .eq("owner_id", user.uid)
        .order("detected_at", { ascending: false })
        .limit(5000),

      supabase
        .from("monitoring_runs")
        .select("id, status, posts_checked, comments_checked, matches_found, started_at, finished_at, error_message")
        .eq("owner_id", user.uid)
        .order("started_at", { ascending: false })
        .limit(500),

      supabase
        .from("monitoring_jobs")
        .select("id, enabled, last_status, last_run_at, next_run_at, interval_hours")
        .eq("owner_id", user.uid),

      supabase
        .from("keywords")
        .select("id, keyword, is_active, priority")
        .eq("owner_id", user.uid),

      supabase
        .from("groups")
        .select("id, name, status")
        .eq("owner_id", user.uid)
    ]);

    const firstError =
      mentionsResult.error ||
      runsResult.error ||
      jobsResult.error ||
      keywordsResult.error ||
      groupsResult.error;

    if (firstError) {
      throw firstError;
    }

    setData({
      mentions: (mentionsResult.data ?? []) as MentionRow[],
      runs: (runsResult.data ?? []) as RunRow[],
      jobs: (jobsResult.data ?? []) as JobRow[],
      keywords: (keywordsResult.data ?? []) as KeywordRow[],
      groups: (groupsResult.data ?? []) as GroupRow[]
    });
  }, [user?.uid]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        await loadAnalytics();
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "تعذر تحميل بيانات التحليلات."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [loadAnalytics]);

  async function refresh() {
    setRefreshing(true);
    setError("");

    try {
      await loadAnalytics();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "تعذر تحديث البيانات."
      );
    } finally {
      setRefreshing(false);
    }
  }

  const filteredMentions = useMemo(
    () =>
      data.mentions.filter((item) =>
        isWithinPeriod(item.detected_at, period)
      ),
    [data.mentions, period]
  );

  const filteredRuns = useMemo(
    () =>
      data.runs.filter((run) =>
        isWithinPeriod(run.started_at, period)
      ),
    [data.runs, period]
  );

  const totalPosts = filteredRuns.reduce(
    (sum, run) => sum + (run.posts_checked ?? 0),
    0
  );

  const totalComments = filteredRuns.reduce(
    (sum, run) => sum + (run.comments_checked ?? 0),
    0
  );

  const totalMatches = filteredMentions.length;

  const successfulRuns = filteredRuns.filter(
    (run) => run.status === "success"
  ).length;

  const failedRuns = filteredRuns.filter(
    (run) => run.status === "failed"
  ).length;

  const runningJobs = data.jobs.filter(
    (job) => job.enabled
  ).length;

  const successRate =
    filteredRuns.length > 0
      ? Math.round(
          (successfulRuns / filteredRuns.length) * 100
        )
      : 0;

  const postMentions = filteredMentions.filter(
    (item) => item.content_type === "post"
  ).length;

  const commentMentions = filteredMentions.filter(
    (item) => item.content_type === "comment"
  ).length;

  const activeKeywords = data.keywords.filter(
    (keyword) => keyword.is_active
  );

  const keywordStats = useMemo(() => {
    const counts = new Map<string, number>();

    filteredMentions.forEach((mention) => {
      (mention.matched_terms ?? []).forEach((term) => {
        const clean = String(term).trim();

        if (!clean) return;

        counts.set(clean, (counts.get(clean) ?? 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredMentions]);

  const dailyStats = useMemo(() => {
    const days = period === "7" ? 7 : 30;
    const keys = getLastDays(days);

    const counts = new Map<string, number>();

    keys.forEach((key) => counts.set(key, 0));

    filteredMentions.forEach((mention) => {
      const date = new Date(mention.detected_at);

      if (Number.isNaN(date.getTime())) return;

      const key = getDayKey(date);

      if (counts.has(key)) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    });

    return keys.map((key) => ({
      key,
      label: new Date(`${key}T12:00:00`).toLocaleDateString(
        "ar-LY",
        { day: "numeric", month: "numeric" }
      ),
      count: counts.get(key) ?? 0
    }));
  }, [filteredMentions, period]);

  const maxDaily = Math.max(
    1,
    ...dailyStats.map((item) => item.count)
  );

  const groupStats = useMemo(() => {
    const counts = new Map<string, number>();

    filteredMentions.forEach((mention) => {
      const id = mention.group_id || "unknown";
      counts.set(id, (counts.get(id) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([id, count]) => ({
        id,
        count,
        name:
          data.groups.find((group) => group.id === id)?.name ||
          (id === "unknown" ? "مجموعة غير محددة" : `مجموعة ${id.slice(0, 8)}`)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filteredMentions, data.groups]);

  const maxGroup = Math.max(
    1,
    ...groupStats.map((item) => item.count)
  );

  const maxKeyword = Math.max(
    1,
    ...keywordStats.map((item) => item.count)
  );

  const recentRuns = filteredRuns.slice(0, 8);

  const latestRun = data.runs[0];

  const periodLabel =
    period === "7"
      ? "آخر 7 أيام"
      : period === "30"
        ? "آخر 30 يوماً"
        : period === "90"
          ? "آخر 90 يوماً"
          : "كل السجل المتاح";

  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">مركز البيانات</span>

          <h1>التحليلات</h1>

          <p>
            تحليل نشاط المجموعات والكلمات المفتاحية ونتائج المراقبة.
          </p>
        </div>

        <button
          className="secondary-btn"
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing || loading}
        >
          <RefreshCw
            size={16}
            className={refreshing ? "animate-spin" : ""}
          />

          {refreshing ? "جارٍ التحديث..." : "تحديث البيانات"}
        </button>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>الفترة الزمنية</h2>

            <p>
              اختر الفترة التي تريد تحليل بياناتها.
            </p>
          </div>

          <CalendarDays size={19} />
        </div>

        <div className="action-row">
          {(
            [
              ["7", "7 أيام"],
              ["30", "30 يوماً"],
              ["90", "90 يوماً"],
              ["all", "كل السجل"]
            ] as [Period, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={
                period === value
                  ? "primary-btn"
                  : "secondary-btn"
              }
              onClick={() => setPeriod(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <small className="muted">
          الفترة الحالية: {periodLabel}
        </small>
      </section>

      {error && (
        <div className="notice error" role="alert">
          <AlertCircle size={17} />
          {error}
        </div>
      )}

      {loading && (
        <div className="notice warning">
          جارٍ تحميل وتحليل بيانات حسابك...
        </div>
      )}

      <div className="stats-grid">
        <StatCard
          label="إجمالي التطابقات"
          value={totalMatches}
          description="النتائج المسجلة ضمن الفترة"
          icon={Target}
        />

        <StatCard
          label="المنشورات المفحوصة"
          value={totalPosts}
          description="حسب سجلات عمليات الفحص"
          icon={FileText}
        />

        <StatCard
          label="التعليقات المفحوصة"
          value={totalComments}
          description="حسب سجلات عمليات الفحص"
          icon={Activity}
        />

        <StatCard
          label="مهام المراقبة النشطة"
          value={runningJobs}
          description="المهام المفعّلة حالياً"
          icon={Users}
        />
      </div>

      <div className="content-grid">
        <section className="panel wide-panel">
          <div className="panel-head">
            <div>
              <h2>نشاط التطابقات اليومي</h2>

              <p>
                عدد النتائج المسجلة في كل يوم.
              </p>
            </div>

            <TrendingUp size={19} />
          </div>

          {dailyStats.every((item) => item.count === 0) ? (
            <EmptyState
              text="لا توجد تطابقات مسجلة خلال الفترة المحددة."
            />
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${dailyStats.length}, minmax(0, 1fr))`,
                alignItems: "end",
                gap: 7,
                minHeight: 190,
                padding: "18px 4px 8px"
              }}
            >
              {dailyStats.map((item) => {
                const height = Math.max(
                  5,
                  (item.count / maxDaily) * 130
                );

                return (
                  <div
                    key={item.key}
                    title={`${item.label}: ${formatNumber(item.count)} تطابق`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "end",
                      gap: 8,
                      minWidth: 0,
                      height: 170
                    }}
                  >
                    <small
                      style={{
                        fontSize: 10,
                        color: "var(--text-muted)",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {item.count > 0 ? formatNumber(item.count) : ""}
                    </small>

                    <div
                      style={{
                        width: "100%",
                        maxWidth: 32,
                        height,
                        minHeight: 3,
                        borderRadius: "7px 7px 2px 2px",
                        background: "var(--accent, #c99b45)",
                        opacity: item.count > 0 ? 1 : 0.2,
                        transition: "height 0.3s ease"
                      }}
                    />

                    <small
                      style={{
                        fontSize: 9,
                        color: "var(--text-muted)",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {item.label}
                    </small>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>توزيع المحتوى</h2>

              <p>
                أنواع النتائج المسجلة.
              </p>
            </div>

            <BarChart3 size={19} />
          </div>

          {totalMatches === 0 ? (
            <EmptyState text="لا توجد نتائج لتوزيعها." />
          ) : (
            <>
              <div
                style={{
                  height: 13,
                  display: "flex",
                  overflow: "hidden",
                  borderRadius: 20,
                  background: "var(--border, #333)",
                  margin: "22px 0"
                }}
              >
                <div
                  style={{
                    width: `${(postMentions / totalMatches) * 100}%`,
                    background: "var(--accent, #c99b45)"
                  }}
                />

                <div
                  style={{
                    flex: 1,
                    background: "var(--text-muted, #888)"
                  }}
                />
              </div>

              <div className="type-stats">
                <span>
                  المنشورات
                  <b>{formatNumber(postMentions)}</b>
                </span>

                <span>
                  التعليقات
                  <b>{formatNumber(commentMentions)}</b>
                </span>
              </div>
            </>
          )}
        </section>
      </div>

      <div className="content-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>أكثر الكلمات تطابقاً</h2>

              <p>
                الكلمات التي ظهرت في النتائج المسجلة.
              </p>
            </div>

            <Tags size={19} />
          </div>

          {keywordStats.length === 0 ? (
            <EmptyState
              text="ستظهر الكلمات هنا بعد تسجيل تطابقات حقيقية."
            />
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
                marginTop: 18
              }}
            >
              {keywordStats.map((item, index) => (
                <div key={item.keyword}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      marginBottom: 7
                    }}
                  >
                    <b style={{ fontSize: 13 }}>
                      {index + 1}. {item.keyword}
                    </b>

                    <small>
                      {formatNumber(item.count)}
                    </small>
                  </div>

                  <div
                    style={{
                      height: 8,
                      background: "var(--border, #333)",
                      borderRadius: 20,
                      overflow: "hidden"
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${(item.count / maxKeyword) * 100}%`,
                        background: "var(--accent, #c99b45)",
                        borderRadius: 20
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="notice warning compact" style={{ marginTop: 18 }}>
            الكلمات هنا مبنية على matched_terms في النتائج المسجلة، وليست مجرد عدد الكلمات المضافة.
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>أكثر المجموعات نشاطاً</h2>

              <p>
                حسب عدد التطابقات المسجلة.
              </p>
            </div>

            <Users size={19} />
          </div>

          {groupStats.length === 0 ? (
            <EmptyState
              text="لا توجد تطابقات مرتبطة بالمجموعات حتى الآن."
            />
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 17,
                marginTop: 18
              }}
            >
              {groupStats.map((item) => (
                <div key={item.id}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      marginBottom: 7
                    }}
                  >
                    <b style={{ fontSize: 12 }}>
                      {item.name}
                    </b>

                    <small>{formatNumber(item.count)}</small>
                  </div>

                  <div
                    style={{
                      height: 8,
                      background: "var(--border, #333)",
                      borderRadius: 20,
                      overflow: "hidden"
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${(item.count / maxGroup) * 100}%`,
                        background: "var(--accent, #c99b45)",
                        borderRadius: 20
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>أداء نظام المراقبة</h2>

            <p>
              إحصائيات عمليات الفحص المسجلة خلال {periodLabel}.
            </p>
          </div>

          <Activity size={19} />
        </div>

        <div className="stats-grid">
          <StatCard
            label="عمليات ناجحة"
            value={successfulRuns}
            description="عمليات انتهت بنجاح"
            icon={CheckCircle2}
          />

          <StatCard
            label="عمليات فاشلة"
            value={failedRuns}
            description="عمليات مسجلة بحالة فشل"
            icon={XCircle}
          />

          <StatCard
            label="نسبة النجاح"
            value={successRate}
            description="النسبة المئوية للعمليات الناجحة"
            icon={TrendingUp}
          />

          <StatCard
            label="الكلمات النشطة"
            value={activeKeywords.length}
            description="الكلمات المفعّلة في الحساب"
            icon={Tags}
          />
        </div>

        <div
          style={{
            marginTop: 20,
            padding: 15,
            borderRadius: 12,
            background: "var(--surface, rgba(128,128,128,0.08))"
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 9
            }}
          >
            <b>معدل نجاح عمليات الفحص</b>

            <strong>{successRate}%</strong>
          </div>

          <div
            style={{
              height: 10,
              borderRadius: 20,
              overflow: "hidden",
              background: "var(--border, #333)"
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${successRate}%`,
                background: "var(--accent, #c99b45)",
                borderRadius: 20,
                transition: "width 0.3s ease"
              }}
            />
          </div>

          <small className="muted">
            {filteredRuns.length === 0
              ? "لا توجد عمليات فحص ضمن الفترة المحددة."
              : `${successfulRuns} ناجحة من أصل ${filteredRuns.length} عملية مسجلة.`}
          </small>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>آخر عمليات الفحص</h2>

            <p>
              أحدث العمليات المسجلة في قاعدة البيانات.
            </p>
          </div>

          <Clock size={19} />
        </div>

        {recentRuns.length === 0 ? (
          <EmptyState
            text="لم يتم تسجيل عمليات فحص خلال الفترة المحددة."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>وقت التشغيل</th>
                  <th>الحالة</th>
                  <th>المنشورات</th>
                  <th>التعليقات</th>
                  <th>التطابقات</th>
                  <th>المدة</th>
                </tr>
              </thead>

              <tbody>
                {recentRuns.map((run) => (
                  <tr key={run.id}>
                    <td>{formatDate(run.started_at)}</td>

                    <td>
                      {getStatusLabel(run.status)}
                    </td>

                    <td>
                      {formatNumber(run.posts_checked ?? 0)}
                    </td>

                    <td>
                      {formatNumber(run.comments_checked ?? 0)}
                    </td>

                    <td>
                      {formatNumber(run.matches_found ?? 0)}
                    </td>

                    <td>
                      {calculateDuration(run)}
                    </td>
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
            <h2>ملخص حالة المراقبة</h2>

            <p>
              نظرة عامة على المهام المسجلة.
            </p>
          </div>

          <Activity size={19} />
        </div>

        <div className="type-stats">
          <span>
            إجمالي المجموعات
            <b>{formatNumber(data.groups.length)}</b>
          </span>

          <span>
            إجمالي الكلمات المفتاحية
            <b>{formatNumber(data.keywords.length)}</b>
          </span>

          <span>
            مهام المراقبة
            <b>{formatNumber(data.jobs.length)}</b>
          </span>

          <span>
            المهام المفعّلة
            <b>{formatNumber(runningJobs)}</b>
          </span>
        </div>

        <div className="notice warning compact" style={{ marginTop: 16 }}>
          <AlertCircle size={15} />

          {latestRun
            ? `آخر عملية مسجلة: ${formatDate(latestRun.started_at)} — ${getStatusLabel(latestRun.status)}.`
            : "لا توجد عملية فحص مسجلة حتى الآن."}
        </div>
      </section>

      <small className="muted">
        مصدر التحليلات: بيانات حسابك المسجلة في Supabase.
        النتائج المعروضة تعتمد على السجلات المتاحة وصلاحيات الوصول.
      </small>
    </div>
  );
}
