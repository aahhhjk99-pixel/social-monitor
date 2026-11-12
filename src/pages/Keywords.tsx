
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowDownUp,
  Check,
  Filter,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Star,
  Tags,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X
} from "lucide-react";

import { useAuth } from "../auth/AuthContext";
import {
  createKeyword,
  listGroups,
  listKeywords,
  removeKeyword,
  updateKeyword
} from "../lib/data";

import type { GroupRecord, KeywordRecord } from "../types";

type StatusFilter = "all" | "active" | "paused";
type PriorityFilter = "all" | "high" | "normal";
type SortMode = "newest" | "oldest" | "priority" | "name";

type EditDraft = {
  id: string;
  term: string;
  groupId: string;
  priority: KeywordRecord["priority"];
};

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return fallback;
}

export default function Keywords() {
  const { user } = useAuth();

  const [items, setItems] = useState<KeywordRecord[]>([]);
  const [groups, setGroups] = useState<GroupRecord[]>([]);

  const [term, setTerm] = useState("");
  const [groupId, setGroupId] = useState("all");
  const [priority, setPriority] =
    useState<KeywordRecord["priority"]>("normal");

  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] =
    useState<PriorityFilter>("all");
  const [sortMode, setSortMode] =
    useState<SortMode>("newest");

  const [editing, setEditing] = useState<EditDraft | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    if (!user?.uid) {
      setItems([]);
      setGroups([]);
      return;
    }

    const [keywords, userGroups] = await Promise.all([
      listKeywords(user.uid),
      listGroups(user.uid)
    ]);

    setItems(keywords);
    setGroups(userGroups);
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError("");

      if (!user?.uid) {
        setItems([]);
        setGroups([]);
        setLoading(false);
        return;
      }

      try {
        const [keywords, userGroups] = await Promise.all([
          listKeywords(user.uid),
          listGroups(user.uid)
        ]);

        if (mounted) {
          setItems(keywords);
          setGroups(userGroups);
        }
      } catch (err) {
        if (mounted) {
          setError(errorMessage(err, "تعذر تحميل البيانات."));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [user?.uid]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    const filtered = items.filter((item) => {
      const matchesSearch =
        !query || item.term.toLocaleLowerCase().includes(query);

      const matchesGroup =
        groupFilter === "all" || item.groupId === groupFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? item.enabled : !item.enabled);

      const matchesPriority =
        priorityFilter === "all" || item.priority === priorityFilter;

      return (
        matchesSearch &&
        matchesGroup &&
        matchesStatus &&
        matchesPriority
      );
    });

    return filtered.sort((a, b) => {
      if (sortMode === "oldest") return a.createdAt - b.createdAt;

      if (sortMode === "name") {
        return a.term.localeCompare(b.term, "ar");
      }

      if (sortMode === "priority") {
        if (a.priority !== b.priority) {
          return a.priority === "high" ? -1 : 1;
        }

        return b.createdAt - a.createdAt;
      }

      return b.createdAt - a.createdAt;
    });
  }, [
    items,
    search,
    groupFilter,
    statusFilter,
    priorityFilter,
    sortMode
  ]);

  const activeCount = items.filter((item) => item.enabled).length;
  const pausedCount = items.length - activeCount;
  const highPriorityCount =
    items.filter((item) => item.priority === "high").length;

  function groupName(id: string): string {
    if (id === "all") return "كل المجموعات";

    return (
      groups.find((group) => group.id === id)?.name ||
      "مجموعة محذوفة"
    );
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!user?.uid || !term.trim() || busy) return;

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      await createKeyword(user.uid, term, groupId, priority);

      setTerm("");
      setGroupId("all");
      setPriority("normal");

      await refresh();
      setSuccess("تمت إضافة الكلمة المفتاحية بنجاح.");
    } catch (err) {
      setError(errorMessage(err, "تعذر إضافة الكلمة."));
    } finally {
      setBusy(false);
    }
  }

  function startEdit(keyword: KeywordRecord) {
    if (busy || busyId) return;

    setError("");
    setSuccess("");

    setEditing({
      id: keyword.id,
      term: keyword.term,
      groupId: keyword.groupId,
      priority: keyword.priority
    });
  }

  function cancelEdit() {
    setEditing(null);
  }

  async function saveEdit() {
    if (!editing || busyId || !user?.uid) return;

    const cleanTerm = editing.term.trim();

    if (!cleanTerm) {
      setError("اكتب الكلمة المفتاحية قبل الحفظ.");
      return;
    }

    const original = items.find((item) => item.id === editing.id);

    if (!original) {
      setError("لم نعد نعثر على هذه الكلمة. حدّث القائمة.");
      setEditing(null);
      return;
    }

    if (
      cleanTerm === original.term &&
      editing.groupId === original.groupId &&
      editing.priority === original.priority
    ) {
      setEditing(null);
      setSuccess("لم يتم إجراء أي تغييرات.");
      return;
    }

    setBusyId(editing.id);
    setError("");
    setSuccess("");

    try {
      await updateKeyword(editing.id, {
        term: cleanTerm,
        groupId: editing.groupId,
        priority: editing.priority
      });

      setItems((current) =>
        current.map((item) =>
          item.id === editing.id
            ? {
                ...item,
                term: cleanTerm,
                groupId: editing.groupId,
                priority: editing.priority
              }
            : item
        )
      );

      setEditing(null);
      setSuccess("تم تعديل الكلمة وحفظ التغييرات.");
    } catch (err) {
      setError(errorMessage(err, "تعذر تعديل الكلمة."));
    } finally {
      setBusyId(null);
    }
  }

  async function toggle(keyword: KeywordRecord) {
    if (busyId || busy) return;

    setBusyId(keyword.id);
    setError("");
    setSuccess("");

    try {
      await updateKeyword(keyword.id, {
        enabled: !keyword.enabled
      });

      setItems((current) =>
        current.map((item) =>
          item.id === keyword.id
            ? { ...item, enabled: !item.enabled }
            : item
        )
      );

      setSuccess(
        keyword.enabled
          ? "تم إيقاف الكلمة المفتاحية."
          : "تم تفعيل الكلمة المفتاحية."
      );
    } catch (err) {
      setError(errorMessage(err, "تعذر تحديث حالة الكلمة."));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(keyword: KeywordRecord) {
    if (busyId || busy) return;

    const confirmed = window.confirm(
      `هل أنت متأكد من حذف الكلمة «${keyword.term}»؟ لا يمكن التراجع عن الحذف.`
    );

    if (!confirmed) return;

    setBusyId(keyword.id);
    setError("");
    setSuccess("");

    try {
      await removeKeyword(keyword.id);

      setItems((current) =>
        current.filter((item) => item.id !== keyword.id)
      );

      if (editing?.id === keyword.id) setEditing(null);

      setSuccess("تم حذف الكلمة المفتاحية.");
    } catch (err) {
      setError(errorMessage(err, "تعذر حذف الكلمة."));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRefresh() {
    if (loading || busy || busyId) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await refresh();
      setSuccess("تم تحديث الكلمات والمجموعات.");
    } catch (err) {
      setError(errorMessage(err, "تعذر تحديث القائمة."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">محرك المطابقة</span>
          <h1>الكلمات المفتاحية</h1>
          <p>
            أنشئ كلمات وعبارات، واربطها بالمجموعات وحدد أولوية كل منها.
          </p>
        </div>

        <span className="count-pill">
          {items.length} كلمة
        </span>
      </div>

      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="notice warning" role="status">
          {success}
        </div>
      )}

      <div className="stats-grid">
        <article className="stat-card">
          <span>إجمالي الكلمات</span>
          <strong>{items.length}</strong>
        </article>

        <article className="stat-card">
          <span>مفعّلة</span>
          <strong>{activeCount}</strong>
        </article>

        <article className="stat-card">
          <span>متوقفة</span>
          <strong>{pausedCount}</strong>
        </article>

        <article className="stat-card">
          <span>أولوية عالية</span>
          <strong>{highPriorityCount}</strong>
        </article>
      </div>

      <form className="panel add-form" onSubmit={submit}>
        <div className="panel-head">
          <div>
            <h2>إضافة كلمة جديدة</h2>
            <p>
              تُحفظ في حسابك وتُستخدم عند معالجة محتوى متاح من مصدر مصرح.
            </p>
          </div>
          <Plus size={19} />
        </div>

        <div className="form-grid">
          <label>
            الكلمة أو العبارة
            <input
              required
              maxLength={200}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="مثال: شركة توصيل"
              disabled={busy}
            />
          </label>

          <label>
            نطاق التطبيق
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              disabled={busy}
            >
              <option value="all">كل المجموعات</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            الأولوية
            <select
              value={priority}
              onChange={(e) =>
                setPriority(
                  e.target.value as KeywordRecord["priority"]
                )
              }
              disabled={busy}
            >
              <option value="normal">عادية</option>
              <option value="high">عالية</option>
            </select>
          </label>
        </div>

        <button
          className="primary-btn"
          disabled={busy || !user || !term.trim()}
          type="submit"
        >
          <Plus size={16} />
          {busy ? "جارٍ الإضافة..." : "إضافة الكلمة"}
        </button>
      </form>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>إدارة الكلمات</h2>
            <p>
              تظهر {filteredItems.length} من أصل {items.length} كلمة
            </p>
          </div>

          <div className="row-actions">
            <Tags size={19} />
            <button
              className="icon-btn"
              type="button"
              title="تحديث القائمة"
              aria-label="تحديث القائمة"
              onClick={() => void handleRefresh()}
              disabled={loading || busy || Boolean(busyId)}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        <div className="keyword-toolbar">
          <label className="keyword-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن كلمة أو عبارة..."
              aria-label="البحث في الكلمات"
            />

            {search && (
              <button
                type="button"
                className="icon-btn"
                title="مسح البحث"
                aria-label="مسح البحث"
                onClick={() => setSearch("")}
              >
                <X size={15} />
              </button>
            )}
          </label>

          <label>
            <span><Filter size={14} /> المجموعة</span>
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
            >
              <option value="all">كل المجموعات</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            الحالة
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as StatusFilter)
              }
            >
              <option value="all">كل الحالات</option>
              <option value="active">مفعّلة</option>
              <option value="paused">متوقفة</option>
            </select>
          </label>

          <label>
            الأولوية
            <select
              value={priorityFilter}
              onChange={(e) =>
                setPriorityFilter(e.target.value as PriorityFilter)
              }
            >
              <option value="all">كل الأولويات</option>
              <option value="high">عالية</option>
              <option value="normal">عادية</option>
            </select>
          </label>

          <label>
            <span><ArrowDownUp size={14} /> الترتيب</span>
            <select
              value={sortMode}
              onChange={(e) =>
                setSortMode(e.target.value as SortMode)
              }
            >
              <option value="newest">الأحدث أولاً</option>
              <option value="oldest">الأقدم أولاً</option>
              <option value="priority">الأولوية أولاً</option>
              <option value="name">حسب الاسم</option>
            </select>
          </label>
        </div>

        {loading ? (
          <div className="empty-state">
            <RefreshCw size={24} />
            <b>جارٍ تحميل الكلمات...</b>
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <Tags size={26} />
            <b>لا توجد كلمات مفتاحية بعد</b>
            <p>أضف أول كلمة من النموذج أعلاه.</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-state">
            <Search size={25} />
            <b>لا توجد نتائج مطابقة</b>
            <p>غيّر البحث أو خيارات التصفية لعرض كلمات أخرى.</p>

            <button
              className="secondary-btn"
              type="button"
              onClick={() => {
                setSearch("");
                setGroupFilter("all");
                setStatusFilter("all");
                setPriorityFilter("all");
              }}
            >
              مسح كل الفلاتر
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>الكلمة</th>
                  <th>النطاق</th>
                  <th>الأولوية</th>
                  <th>الحالة</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>

              <tbody>
                {filteredItems.map((keyword) => {
                  const isEditing = editing?.id === keyword.id;
                  const rowBusy = busyId === keyword.id;

                  return (
                    <tr key={keyword.id}>
                      <td>
                        {isEditing && editing ? (
                          <input
                            value={editing.term}
                            maxLength={200}
                            autoFocus
                            disabled={rowBusy}
                            onChange={(e) =>
                              setEditing({
                                ...editing,
                                term: e.target.value
                              })
                            }
                            aria-label="تعديل الكلمة"
                          />
                        ) : (
                          <b>{keyword.term}</b>
                        )}
                      </td>

                      <td>
                        {isEditing && editing ? (
                          <select
                            value={editing.groupId}
                            disabled={rowBusy}
                            onChange={(e) =>
                              setEditing({
                                ...editing,
                                groupId: e.target.value
                              })
                            }
                            aria-label="تعديل نطاق المجموعة"
                          >
                            <option value="all">كل المجموعات</option>
                            {groups.map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          groupName(keyword.groupId)
                        )}
                      </td>

                      <td>
                        {isEditing && editing ? (
                          <select
                            value={editing.priority}
                            disabled={rowBusy}
                            onChange={(e) =>
                              setEditing({
                                ...editing,
                                priority: e.target.value as KeywordRecord["priority"]
                              })
                            }
                            aria-label="تعديل الأولوية"
                          >
                            <option value="normal">عادية</option>
                            <option value="high">عالية</option>
                          </select>
                        ) : (
                          <span
                            className={`status-pill ${
                              keyword.priority === "high" ? "active" : "paused"
                            }`}
                          >
                            {keyword.priority === "high" ? (
                              <><Star size={12} /> عالية</>
                            ) : "عادية"}
                          </span>
                        )}
                      </td>

                      <td>
                        <span
                          className={`status-pill ${
                            keyword.enabled ? "active" : "paused"
                          }`}
                        >
                          {keyword.enabled ? "مفعّلة" : "متوقفة"}
                        </span>
                      </td>

                      <td>
                        <div className="row-actions">
                          {isEditing ? (
                            <>
                              <button
                                className="icon-btn"
                                type="button"
                                title="حفظ التعديل"
                                aria-label="حفظ التعديل"
                                onClick={() => void saveEdit()}
                                disabled={rowBusy}
                              >
                                {rowBusy ? (
                                  <RefreshCw size={16} />
                                ) : (
                                  <Check size={16} />
                                )}
                              </button>

                              <button
                                className="icon-btn"
                                type="button"
                                title="إلغاء"
                                aria-label="إلغاء التعديل"
                                onClick={cancelEdit}
                                disabled={rowBusy}
                              >
                                <X size={16} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="icon-btn"
                                type="button"
                                title="تعديل الكلمة"
                                aria-label={`تعديل ${keyword.term}`}
                                onClick={() => startEdit(keyword)}
                                disabled={
                                  Boolean(busyId) ||
                                  busy ||
                                  Boolean(editing)
                                }
                              >
                                <Pencil size={16} />
                              </button>

                              <button
                                className="icon-btn"
                                type="button"
                                title={keyword.enabled ? "إيقاف" : "تفعيل"}
                                aria-label={
                                  keyword.enabled ? "إيقاف الكلمة" : "تفعيل الكلمة"
                                }
                                onClick={() => void toggle(keyword)}
                                disabled={
                                  Boolean(busyId) ||
                                  busy ||
                                  Boolean(editing)
                                }
                              >
                                {rowBusy ? (
                                  <RefreshCw size={16} />
                                ) : keyword.enabled ? (
                                  <ToggleRight size={18} />
                                ) : (
                                  <ToggleLeft size={18} />
                                )}
                              </button>

                              <button
                                className="icon-btn danger-icon"
                                type="button"
                                title="حذف"
                                aria-label={`حذف ${keyword.term}`}
                                onClick={() => void remove(keyword)}
                                disabled={
                                  Boolean(busyId) ||
                                  busy ||
                                  Boolean(editing)
                                }
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
