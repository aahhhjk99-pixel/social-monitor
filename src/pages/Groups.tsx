import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import {
  ExternalLink,
  Pause,
  Play,
  Plus,
  Users,
  Trash2,
  RefreshCw,
  Pencil,
  Save,
  X
} from "lucide-react";

import { useAuth } from "../auth/AuthContext";

import {
  createGroup,
  listGroups,
  newGroupId,
  removeGroup,
  setGroupStatus,
  updateGroup
} from "../lib/data";

import type { GroupRecord } from "../types";

const WRITE_TIMEOUT_MS = 20000;
const REFRESH_TIMEOUT_MS = 12000;

type SaveResult =
  | { ok: true }
  | { ok: false; error: unknown };

type PendingSave = {
  id: string;
  ownerId: string;
  name: string;
  url: string;
  result: Promise<SaveResult>;
};

type PendingSaveView = Omit<PendingSave, "result">;

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message || "";

    if (
      message.includes("42501") ||
      message.toLowerCase().includes("permission denied") ||
      message.toLowerCase().includes("row-level security")
    ) {
      return "ليست لديك صلاحية لتنفيذ العملية. تحقق من سياسات RLS في Supabase.";
    }

    if (
      message.includes("23505") ||
      message.toLowerCase().includes("duplicate key")
    ) {
      return "هذه البيانات موجودة بالفعل.";
    }

    if (
      message.includes("23503") ||
      message.toLowerCase().includes("foreign key")
    ) {
      return "تعذر تنفيذ العملية بسبب وجود بيانات مرتبطة بهذا السجل.";
    }

    if (
      message.toLowerCase().includes("failed to fetch") ||
      message.toLowerCase().includes("network")
    ) {
      return "تعذر الاتصال بـ Supabase. تحقق من الإنترنت وحاول مرة أخرى.";
    }

    return message;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return "حدث خطأ غير متوقع. حاول مرة أخرى.";
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "تاريخ غير متوفر";
  }

  return date.toLocaleDateString("ar-LY", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function validateGroupUrl(value: string): boolean {
  try {
    const parsed = new URL(value);

    return (
      parsed.protocol === "https:" ||
      parsed.protocol === "http:"
    );
  } catch {
    return false;
  }
}

export default function Groups() {
  const { user } = useAuth();

  const [groups, setGroups] = useState<GroupRecord[]>([]);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [pendingSave, setPendingSave] =
    useState<PendingSaveView | null>(null);

  const [rowBusyId, setRowBusyId] =
    useState<string | null>(null);

  // حالة تعديل المجموعة
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");

  const pendingSaveRef = useRef<PendingSave | null>(null);
  const submittingRef = useRef(false);

  // ---------------------------------
  // تحميل المجموعات
  // ---------------------------------

  async function refreshGroups(): Promise<GroupRecord[]> {
    if (!user?.uid) {
      setGroups([]);
      return [];
    }

    const result = await listGroups(user.uid);
    setGroups(result);

    return result;
  }

  useEffect(() => {
    let active = true;

    async function load() {
      if (!user?.uid) {
        setGroups([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const result = await listGroups(user.uid);

        if (active) {
          setGroups(result);
        }
      } catch (err) {
        if (active) {
          setError(
            "تعذر تحميل المجموعات.\n" +
            getErrorMessage(err)
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [user?.uid]);

  // ---------------------------------
  // تجهيز عملية الحفظ
  // ---------------------------------

  function createPendingSave(
    ownerId: string,
    groupName: string,
    groupUrl: string
  ): PendingSave {
    const id = newGroupId();

    const result: Promise<SaveResult> = createGroup(
      ownerId,
      groupName,
      groupUrl,
      id
    ).then(
      () => ({ ok: true as const }),
      (error) => ({ ok: false as const, error })
    );

    return {
      id,
      ownerId,
      name: groupName,
      url: groupUrl,
      result
    };
  }

  // ---------------------------------
  // إتمام الحفظ أو متابعة طلب سابق
  // ---------------------------------

  async function finishPendingSave() {
    if (!user?.uid || submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      let pending = pendingSaveRef.current;

      if (!pending) {
        const cleanName = name.trim();
        const cleanUrl = url.trim();

        if (!cleanName) {
          setError("اكتب اسم المجموعة.");
          return;
        }

        if (!cleanUrl) {
          setError("اكتب رابط المجموعة.");
          return;
        }

        if (!validateGroupUrl(cleanUrl)) {
          setError("رابط المجموعة غير صحيح.");
          return;
        }

        pending = createPendingSave(
          user.uid,
          cleanName,
          cleanUrl
        );

        pendingSaveRef.current = pending;

        setPendingSave({
          id: pending.id,
          ownerId: pending.ownerId,
          name: pending.name,
          url: pending.url
        });
      }

      const result = await withTimeout(
        pending.result,
        WRITE_TIMEOUT_MS,
        "انتهت مهلة الانتظار بعد 20 ثانية. لم يصل تأكيد الحفظ بعد."
      );

      if (!result.ok) {
        if (pendingSaveRef.current?.id === pending.id) {
          pendingSaveRef.current = null;
          setPendingSave(null);
        }

        setError(
          "تعذر حفظ المجموعة.\n" +
          getErrorMessage(result.error)
        );

        return;
      }

      if (pendingSaveRef.current?.id !== pending.id) {
        return;
      }

      const savedGroup: GroupRecord = {
        id: pending.id,
        ownerId: pending.ownerId,
        name: pending.name,
        url: pending.url,
        status: "unverified",
        createdAt: Date.now()
      };

      setGroups((current) => [
        savedGroup,
        ...current.filter(
          (group) => group.id !== pending.id
        )
      ]);

      pendingSaveRef.current = null;
      setPendingSave(null);

      setName("");
      setUrl("");

      setSuccess("تم حفظ المجموعة بنجاح.");

      try {
        await withTimeout(
          refreshGroups(),
          REFRESH_TIMEOUT_MS,
          "تم الحفظ، لكن تحديث القائمة تأخر."
        );
      } catch (refreshError) {
        setError(
          "تم حفظ المجموعة بنجاح، لكن تعذر تحديث القائمة.\n" +
          getErrorMessage(refreshError)
        );
      }
    } catch (err) {
      const message = getErrorMessage(err);

      if (message.includes("مهلة الانتظار")) {
        setError(
          "انتهت مهلة الانتظار. لم يصل تأكيد Supabase بعد.\n" +
          "بيانات المجموعة محفوظة مؤقتاً في النموذج. اضغط متابعة تأكيد الحفظ، ولن ننشئ طلباً جديداً."
        );
      } else {
        setError(message);
      }
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  // ---------------------------------
  // إرسال نموذج الإضافة
  // ---------------------------------

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await finishPendingSave();
  }

  // ---------------------------------
  // بدء تعديل المجموعة
  // ---------------------------------

  function startEdit(group: GroupRecord) {
    if (rowBusyId || busy || pendingSave) return;

    setError("");
    setSuccess("");

    setEditingId(group.id);
    setEditName(group.name);
    setEditUrl(group.url);
  }

  // ---------------------------------
  // إلغاء التعديل
  // ---------------------------------

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditUrl("");
    setError("");
  }

  // ---------------------------------
  // حفظ تعديل المجموعة
  // ---------------------------------

  async function saveEdit(group: GroupRecord) {
    if (!user?.uid || rowBusyId || busy) return;

    const cleanName = editName.trim();
    const cleanUrl = editUrl.trim();

    setError("");
    setSuccess("");

    if (!cleanName) {
      setError("اكتب اسم المجموعة.");
      return;
    }

    if (!cleanUrl) {
      setError("اكتب رابط المجموعة.");
      return;
    }

    if (!validateGroupUrl(cleanUrl)) {
      setError("رابط المجموعة غير صحيح.");
      return;
    }

    if (
      cleanName === group.name &&
      cleanUrl === group.url
    ) {
      cancelEdit();
      setSuccess("لم يتم إجراء أي تغييرات.");
      return;
    }

    setRowBusyId(group.id);

    try {
      await updateGroup(
        group.id,
        user.uid,
        cleanName,
        cleanUrl
      );

      setGroups((current) =>
        current.map((item) =>
          item.id === group.id
            ? {
                ...item,
                name: cleanName,
                url: cleanUrl
              }
            : item
        )
      );

      setEditingId(null);
      setEditName("");
      setEditUrl("");

      setSuccess("تم تعديل المجموعة وحفظ التغييرات بنجاح.");
    } catch (err) {
      setError(
        "تعذر تعديل المجموعة.\n" +
        getErrorMessage(err)
      );
    } finally {
      setRowBusyId(null);
    }
  }

  // ---------------------------------
  // تغيير حالة المجموعة
  // ---------------------------------

  async function toggle(group: GroupRecord) {
    if (rowBusyId || busy || editingId) return;

    setError("");
    setSuccess("");

    setRowBusyId(group.id);

    const nextStatus =
      group.status === "active"
        ? "paused"
        : "active";

    try {
      await setGroupStatus(group.id, nextStatus);

      setGroups((current) =>
        current.map((item) =>
          item.id === group.id
            ? { ...item, status: nextStatus }
            : item
        )
      );

      setSuccess(
        nextStatus === "active"
          ? "تم تفعيل المجموعة."
          : "تم إيقاف المجموعة."
      );
    } catch (err) {
      setError(
        "تعذر تغيير حالة المجموعة.\n" +
        getErrorMessage(err)
      );
    } finally {
      setRowBusyId(null);
    }
  }

  // ---------------------------------
  // حذف المجموعة
  // ---------------------------------

  async function remove(group: GroupRecord) {
    if (rowBusyId || busy || editingId) return;

    const confirmed = window.confirm(
      `هل أنت متأكد من حذف المجموعة "${group.name}"؟`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    setRowBusyId(group.id);

    try {
      await removeGroup(group.id);

      setGroups((current) =>
        current.filter((item) => item.id !== group.id)
      );

      setSuccess("تم حذف المجموعة بنجاح.");
    } catch (err) {
      setError(
        "تعذر حذف المجموعة.\n" +
        getErrorMessage(err)
      );
    } finally {
      setRowBusyId(null);
    }
  }

  // ---------------------------------
  // تحديث يدوي
  // ---------------------------------

  async function handleRefresh() {
    if (loading || busy || rowBusyId || editingId) return;

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await refreshGroups();
      setSuccess("تم تحديث قائمة المجموعات.");
    } catch (err) {
      setError(
        "تعذر تحديث المجموعات.\n" +
        getErrorMessage(err)
      );
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------
  // واجهة الصفحة
  // ---------------------------------

  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            إدارة المصادر
          </span>

          <h1>المجموعات</h1>

          <p>
            أضف مجموعاتك ونظّم إعدادات كل مجموعة بشكل مستقل.
          </p>
        </div>

        <span className="count-pill">
          {groups.length} مجموعة
        </span>
      </div>

      {error && (
        <div
          className="notice error"
          role="alert"
          style={{ whiteSpace: "pre-line" }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          className="notice warning"
          role="status"
        >
          {success}
        </div>
      )}

      {/* إضافة مجموعة */}

      <form
        className="panel add-form"
        onSubmit={submit}
      >
        <div className="panel-head">
          <div>
            <h2>إضافة مجموعة</h2>

            <p>
              أدخل اسم المجموعة ورابطها لإضافتها إلى حسابك.
            </p>
          </div>

          <Plus size={19} />
        </div>

        <div className="form-grid">
          <label>
            اسم المجموعة

            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: أخبار وخدمات ليبيا"
              disabled={busy || Boolean(pendingSave)}
            />
          </label>

          <label>
            رابط المجموعة

            <input
              required
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.facebook.com/groups/..."
              disabled={busy || Boolean(pendingSave)}
            />
          </label>
        </div>

        <button
          className="primary-btn"
          disabled={busy || !user}
          type="submit"
        >
          {busy ? (
            <>
              <RefreshCw size={16} />
              جارٍ الحفظ...
            </>
          ) : pendingSave ? (
            <>
              <RefreshCw size={16} />
              متابعة تأكيد الحفظ
            </>
          ) : (
            <>
              <Plus size={16} />
              إضافة المجموعة
            </>
          )}
        </button>
      </form>

      {/* قائمة المجموعات */}

      <div className="section-title">
        <h2>مجموعاتي</h2>

        <div className="row-actions">
          <span>{groups.length} نتيجة</span>

          <button
            className="icon-btn"
            type="button"
            title="تحديث القائمة"
            onClick={() => void handleRefresh()}
            disabled={
              loading ||
              busy ||
              Boolean(rowBusyId) ||
              Boolean(editingId)
            }
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="panel empty-state">
          <RefreshCw size={25} />
          <b>جارٍ تحميل المجموعات...</b>
          <p>ننتظر استجابة قاعدة البيانات.</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="panel empty-state">
          <Users size={28} />

          <b>لم تضف أي مجموعة بعد</b>

          <p>
            أضف رابط مجموعة لبدء تنظيم إعداداتها.
          </p>
        </div>
      ) : (
        <div className="groups-grid">
          {groups.map((group) => {
            const rowBusy = rowBusyId === group.id;
            const isEditing = editingId === group.id;

            return (
              <article
                className="group-card"
                key={group.id}
              >
                <div className="group-card-top">
                  <div className="group-avatar">
                    <Users />
                  </div>

                  <span
                    className={`status-pill ${group.status}`}
                  >
                    {group.status === "active"
                      ? "مفعّلة"
                      : group.status === "paused"
                        ? "متوقفة"
                        : "غير متحقق منها"}
                  </span>
                </div>

                {isEditing ? (
                  <div className="group-edit-form">
                    <label>
                      اسم المجموعة

                      <input
                        value={editName}
                        onChange={(e) =>
                          setEditName(e.target.value)
                        }
                        placeholder="اسم المجموعة"
                        disabled={rowBusy}
                        autoFocus
                      />
                    </label>

                    <label>
                      رابط المجموعة

                      <input
                        type="url"
                        value={editUrl}
                        onChange={(e) =>
                          setEditUrl(e.target.value)
                        }
                        placeholder="رابط المجموعة"
                        disabled={rowBusy}
                      />
                    </label>
                  </div>
                ) : (
                  <>
                    <h3>{group.name}</h3>

                    <p className="group-url">
                      {group.url}
                    </p>
                  </>
                )}

                <div className="group-meta">
                  أضيفت {formatDate(group.createdAt)}
                </div>

                <div className="card-actions">
                  {isEditing ? (
                    <>
                      <button
                        className="primary-btn"
                        type="button"
                        onClick={() => void saveEdit(group)}
                        disabled={rowBusy}
                      >
                        {rowBusy ? (
                          <>
                            <RefreshCw size={16} />
                            جارٍ الحفظ...
                          </>
                        ) : (
                          <>
                            <Save size={16} />
                            حفظ التعديل
                          </>
                        )}
                      </button>

                      <button
                        className="icon-btn"
                        type="button"
                        title="إلغاء التعديل"
                        onClick={cancelEdit}
                        disabled={rowBusy}
                      >
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        className="secondary-btn"
                        to={`/groups/${group.id}`}
                      >
                        فتح الصفحة
                      </Link>

                      <button
                        className="icon-btn"
                        title="تعديل المجموعة"
                        type="button"
                        onClick={() => startEdit(group)}
                        disabled={
                          rowBusy ||
                          Boolean(rowBusyId) ||
                          busy ||
                          Boolean(editingId)
                        }
                      >
                        <Pencil size={16} />
                      </button>

                      <button
                        className="icon-btn"
                        title={
                          group.status === "active"
                            ? "إيقاف المجموعة"
                            : "تفعيل المجموعة"
                        }
                        onClick={() => void toggle(group)}
                        type="button"
                        disabled={
                          rowBusy ||
                          Boolean(rowBusyId) ||
                          busy ||
                          Boolean(editingId)
                        }
                      >
                        {group.status === "active" ? (
                          <Pause size={16} />
                        ) : (
                          <Play size={16} />
                        )}
                      </button>

                      <a
                        className="icon-btn"
                        href={group.url}
                        target="_blank"
                        rel="noreferrer"
                        title="فتح المجموعة الأصلية"
                      >
                        <ExternalLink size={16} />
                      </a>

                      <button
                        className="icon-btn danger-icon"
                        title="حذف المجموعة"
                        onClick={() => void remove(group)}
                        type="button"
                        disabled={
                          rowBusy ||
                          Boolean(rowBusyId) ||
                          busy ||
                          Boolean(editingId)
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
