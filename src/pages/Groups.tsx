
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

function getErrorDetails(error: unknown): {
  code: string;
  message: string;
} {
  if (error && typeof error === "object") {
    const item = error as {
      code?: unknown;
      message?: unknown;
    };

    return {
      code: item.code ? String(item.code) : "",
      message: item.message
        ? String(item.message)
        : "لا توجد تفاصيل إضافية."
    };
  }

  return {
    code: "",
    message: error instanceof Error
      ? error.message
      : String(error)
  };
}

function getErrorMessage(
  error: unknown,
  fallback: string
): string {
  const { code, message } = getErrorDetails(error);

  if (code.includes("permission-denied")) {
    return "Firebase رفض العملية بسبب صلاحيات قاعدة البيانات.";
  }

  if (
    code.includes("unavailable") ||
    code.includes("deadline-exceeded")
  ) {
    return "تعذر الاتصال بـ Firebase أو انتهت مهلة الاتصال.";
  }

  if (code.includes("failed-precondition")) {
    return "العملية تحتاج إعداداً إضافياً في Firestore، وقد يكون السبب فهرساً غير جاهز.";
  }

  if (code.includes("unauthenticated")) {
    return "انتهت جلسة تسجيل الدخول أو لم يتم التعرف على الحساب.";
  }

  if (code.includes("already-exists")) {
    return "المستند موجود مسبقاً في قاعدة البيانات.";
  }

  if (code.includes("not-found")) {
    return "المستند المطلوب غير موجود.";
  }

  return message || fallback;
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
          if (active) {
            setGroups(result);
          }
        })
        .catch((err) => {
          console.error(
            "[Firestore groups] loading failed:",
            err
          );

          if (active) {
            const details = getErrorDetails(err);

            setError(
              [
                getErrorMessage(
                  err,
                  "تعذر تحميل المجموعات."
                ),
                details.code
                  ? `رمز Firebase: ${details.code}`
                  : "",
                details.message
              ]
                .filter(Boolean)
                .join("\n")
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

    let groupId: string;

    try {
      groupId =
        pendingGroupId.current ?? newGroupId();

      pendingGroupId.current = groupId;
    } catch (err) {
      console.error(
        "[Firestore groups] ID generation failed:",
        err
      );

      const details = getErrorDetails(err);

      setError(
        [
          "تعذر تجهيز معرّف المجموعة.",
          details.code
            ? `رمز Firebase: ${details.code}`
            : "",
          details.message
        ]
          .filter(Boolean)
          .join("\n")
      );

      submitting.current = false;
      setBusy(false);
      return;
    }

    const savePromise = createGroup(
      user.uid,
      cleanName,
      cleanUrl,
      groupId
    );

    let timedOut = false;

    savePromise.then(
      () => {
        if (timedOut) {
          console.info(
            "[Firestore groups] Save completed after timeout."
          );
        }
      },
      (err) => {
        if (timedOut) {
          console.error(
            "[Firestore groups] Late save failure:",
            err
          );
        }
      }
    );

    try {
      await withTimeout(
        savePromise,
        WRITE_TIMEOUT_MS,
        "انتهت مهلة الانتظار بعد 20 ثانية. هذا لا يعني بالضرورة أن الحفظ فشل؛ نتيجة Firebase لم تصل في الوقت المحدد."
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
          "تم تأكيد حفظ المجموعة، لكن تحديث القائمة تأخر."
        );
      } catch (refreshError) {
        console.error(
          "[Firestore groups] Refresh failed:",
          refreshError
        );

        const details = getErrorDetails(refreshError);

        setError(
          [
            "تم حفظ المجموعة، لكن تعذر تحديث القائمة.",
            details.code
              ? `رمز Firebase: ${details.code}`
              : "",
            details.message
          ]
            .filter(Boolean)
            .join("\n")
        );
      }
    } catch (writeError) {
      timedOut =
        writeError instanceof Error &&
        writeError.message.includes(
          "انتهت مهلة الانتظار بعد 20 ثانية"
        );

      console.error(
        "[Firestore groups] Save failed or timed out:",
        writeError
      );

      const details = getErrorDetails(writeError);

      setError(
        [
          getErrorMessage(
            writeError,
            "تعذر تأكيد حفظ المجموعة."
          ),
          details.code
            ? `رمز Firebase: ${details.code}`
            : "",
          details.message
        ]
          .filter(Boolean)
          .join("\n")
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
      console.error(
        "[Firestore groups] Status update failed:",
        err
      );

      const details = getErrorDetails(err);

      setError(
        [
          getErrorMessage(
            err,
            "تعذر تحديث الحالة."
          ),
          details.code
            ? `رمز Firebase: ${details.code}`
            : "",
          details.message
        ]
          .filter(Boolean)
          .join("\n")
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
        current.filter(
          (item) => item.id !== group.id
        )
      );

      await refresh();
    } catch (err) {
      console.error(
        "[Firestore groups] Delete failed:",
        err
      );

      const details = getErrorDetails(err);

      setError(
        [
          getErrorMessage(
            err,
            "تعذر حذف المجموعة."
          ),
          details.code
            ? `رمز Firebase: ${details.code}`
            : "",
          details.message
        ]
          .filter(Boolean)
          .join("\n")
      );
    }
  }

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
              onChange={(e) =>
                setName(e.target.value)
              }
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
              onChange={(e) =>
                setUrl(e.target.value)
              }
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

              <p className="group-url">
                {group.url}
              </p>

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
                  onClick={() =>
                    void toggle(group)
                  }
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
                  onClick={() =>
                    void remove(group)
                  }
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
