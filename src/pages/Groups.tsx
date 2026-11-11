
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import {
  ExternalLink,
  Pause,
  Play,
  Plus,
  Users,
  Trash2
} from "lucide-react";

import { useAuth } from "../auth/AuthContext";

import {
  createGroup,
  listGroups,
  newGroupId,
  removeGroup,
  setGroupStatus
} from "../lib/data";

import type { GroupRecord } from "../types";

const WRITE_TIMEOUT_MS = 20000;
const REFRESH_TIMEOUT_MS = 12000;

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

function getErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = String(
      (error as { code?: unknown }).code
    );

    if (code.includes("permission-denied")) {
      return "Firebase رفض العملية بسبب صلاحيات قاعدة البيانات. راجع قواعد Firestore والحساب المسجل.";
    }

    if (
      code.includes("unavailable") ||
      code.includes("deadline-exceeded")
    ) {
      return "تعذر الاتصال بـ Firebase حالياً. تحقق من الإنترنت وحاول مرة أخرى.";
    }

    if (code.includes("failed-precondition")) {
      return "الاستعلام يحتاج إعداداً في Firestore. تأكد أن الفهرس المطلوب أصبح Enabled.";
    }
  }

  return error instanceof Error
    ? error.message
    : fallback;
}

export default function Groups() {
  const { user } = useAuth();

  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const pendingGroupId = useRef<string | null>(null);
  const submitting = useRef(false);

  async function refresh(): Promise<GroupRecord[]> {
    if (!user) return [];

    const result = await listGroups(user.uid);
    setGroups(result);

    return result;
  }

  useEffect(() => {
    let active = true;

    if (user) {
      listGroups(user.uid)
        .then((result) => {
          if (active) setGroups(result);
        })
        .catch((err) => {
          if (active) {
            setError(
              getErrorMessage(
                err,
                "تعذر تحميل المجموعات."
              )
            );
          }
        });
    } else {
      setGroups([]);
    }

    return () => {
      active = false;
    };
  }, [user]);

  async function submit(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (!user || submitting.current) return;

    const cleanName = name.trim();
    const cleanUrl = url.trim();

    if (!cleanName || !cleanUrl) {
      setError("اكتب اسم المجموعة والرابط.");
      return;
    }

    submitting.current = true;
    setBusy(true);
    setError("");

    const groupId =
      pendingGroupId.current ?? newGroupId();

    pendingGroupId.current = groupId;

    try {
      await withTimeout(
        createGroup(
          user.uid,
          cleanName,
          cleanUrl,
          groupId
        ),
        WRITE_TIMEOUT_MS,
        "تأخر رد Firebase أكثر من 20 ثانية. لم نكرر عملية الحفظ؛ اضغط إعادة المحاولة بنفس البيانات حتى نتأكد من النتيجة."
      );

      const savedGroup: GroupRecord = {
        id: groupId,
        ownerId: user.uid,
        name: cleanName,
        url: cleanUrl,
        status: "unverified",
        createdAt: Date.now()
      };

      setGroups((current) => [
        savedGroup,
        ...current.filter(
          (group) => group.id !== groupId
        )
      ]);

      pendingGroupId.current = null;
      setName("");
      setUrl("");

      try {
        await withTimeout(
          refresh(),
          REFRESH_TIMEOUT_MS,
          "تم حفظ المجموعة، لكن تحديث القائمة تأخر. ستبقى المجموعة ظاهرة ويمكن تحديث الصفحة لاحقاً."
        );
      } catch (refreshError) {
        setError(
          getErrorMessage(
            refreshError,
            "تم حفظ المجموعة، لكن تعذر تحديث القائمة. حدّث الصفحة بعد قليل."
          )
        );
      }
    } catch (writeError) {
      setError(
        getErrorMessage(
          writeError,
          "تعذر تأكيد حفظ المجموعة. بيانات النموذج محفوظة لإعادة المحاولة."
        )
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  async function toggle(group: GroupRecord) {
    setError("");

    try {
      const nextStatus =
        group.status === "active"
          ? "paused"
          : "unverified";

      await setGroupStatus(group.id, nextStatus);
      await refresh();
    } catch (err) {
      setError(
        getErrorMessage(err, "تعذر تحديث الحالة.")
      );
    }
  }

  async function remove(group: GroupRecord) {
    if (!window.confirm("هل تريد حذف المجموعة؟")) {
      return;
    }

    setError("");

    try {
      await removeGroup(group.id);

      setGroups((current) =>
        current.filter((item) => item.id !== group.id)
      );

      await refresh();
    } catch (err) {
      setError(
        getErrorMessage(err, "تعذر حذف المجموعة.")
      );
    }
  }

  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">إدارة المصادر</span>
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
        <div className="notice error" role="alert">
          {error}
        </div>
      )}

      <form
        className="panel add-form"
        onSubmit={submit}
      >
        <div className="panel-head">
          <div>
            <h2>إضافة مجموعة</h2>
            <p>
              أدخل الاسم والرابط. الإضافة لا تعني التحقق من إمكانية الوصول للمحتوى.
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
              disabled={busy}
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
              disabled={busy}
            />
          </label>
        </div>

        <button
          className="primary-btn"
          disabled={busy || !user}
        >
          <Plus size={16} />

          {busy
            ? "جارٍ الحفظ..."
            : pendingGroupId.current
              ? "إعادة محاولة الحفظ"
              : "إضافة المجموعة"}
        </button>
      </form>

      <div className="section-title">
        <h2>مجموعاتي</h2>
        <span>{groups.length} نتيجة</span>
      </div>

      {groups.length === 0 ? (
        <div className="panel empty-state">
          <Users size={28} />
          <b>لم تضف أي مجموعة بعد</b>
          <p>
            أضف رابط مجموعة لبدء تنظيم إعداداتها.
          </p>
        </div>
      ) : (
        <div className="groups-grid">
          {groups.map((group) => (
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

              <h3>{group.name}</h3>
              <p className="group-url">{group.url}</p>

              <div className="group-meta">
                أضيفت{" "}
                {new Date(
                  group.createdAt
                ).toLocaleDateString("ar")}
              </div>

              <div className="card-actions">
                <Link
                  className="secondary-btn"
                  to={`/groups/${group.id}`}
                >
                  فتح الصفحة
                </Link>

                <button
                  className="icon-btn"
                  title="تغيير الحالة"
                  onClick={() => void toggle(group)}
                  type="button"
                >
                  {group.status === "active"
                    ? <Pause size={16} />
                    : <Play size={16} />}
                </button>

                <a
                  className="icon-btn"
                  href={group.url}
                  target="_blank"
                  rel="noreferrer"
                  title="فتح المجموعة"
                >
                  <ExternalLink size={16} />
                </a>

                <button
                  className="icon-btn danger-icon"
                  title="حذف"
                  onClick={() => void remove(group)}
                  type="button"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
