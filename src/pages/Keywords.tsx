
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import {
  Plus,
  Tags,
  Trash2,
  ToggleLeft,
  ToggleRight
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

export default function Keywords() {
  const { user } = useAuth();

  const [items, setItems] = useState<KeywordRecord[]>([]);
  const [groups, setGroups] = useState<GroupRecord[]>([]);

  const [term, setTerm] = useState("");
  const [groupId, setGroupId] = useState("all");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (!user) return;

    const [keywords, userGroups] = await Promise.all([
      listKeywords(user.uid),
      listGroups(user.uid)
    ]);

    setItems(keywords);
    setGroups(userGroups);
  }

  useEffect(() => {
    void refresh().catch((err) => {
      setError(err instanceof Error ? err.message : "تعذر تحميل البيانات.");
    });
  }, [user]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!user || !term.trim()) return;

    setBusy(true);
    setError("");

    try {
      await createKeyword(user.uid, term, groupId);

      setTerm("");
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "تعذر إضافة الكلمة."
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggle(keyword: KeywordRecord) {
    setError("");

    try {
      await updateKeyword(keyword.id, {
        enabled: !keyword.enabled
      });

      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "تعذر تحديث الكلمة."
      );
    }
  }

  async function remove(keyword: KeywordRecord) {
    if (!window.confirm("حذف هذه الكلمة؟")) return;

    setError("");

    try {
      await removeKeyword(keyword.id);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "تعذر حذف الكلمة."
      );
    }
  }

  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">محرك المطابقة</span>
          <h1>الكلمات المفتاحية</h1>
          <p>
            أنشئ كلمات عامة أو اربطها بمجموعة محددة.
          </p>
        </div>

        <span className="count-pill">
          {items.length} كلمة
        </span>
      </div>

      {error && (
        <div className="notice error">{error}</div>
      )}

      <form className="panel add-form" onSubmit={submit}>
        <div className="panel-head">
          <div>
            <h2>إضافة كلمة جديدة</h2>
            <p>
              تُحفظ في حسابك وتُستخدم عند معالجة محتوى متاح من مصدر مصرح.
            </p>
          </div>
          <Plus />
        </div>

        <div className="form-grid">
          <label>
            الكلمة أو العبارة
            <input
              required
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="مثال: شركة توصيل"
            />
          </label>

          <label>
            نطاق التطبيق
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
            >
              <option value="all">كل المجموعات</option>

              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          className="primary-btn"
          disabled={busy || !term.trim()}
        >
          <Plus size={16} />
          {busy ? "جارٍ الإضافة..." : "إضافة الكلمة"}
        </button>
      </form>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>قائمة الكلمات</h2>
            <p>إدارة الكلمات المضافة</p>
          </div>
          <Tags />
        </div>

        {items.length === 0 ? (
          <div className="empty-state">
            لا توجد كلمات بعد.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>الكلمة</th>
                  <th>النطاق</th>
                  <th>الحالة</th>
                  <th>الإجراء</th>
                </tr>
              </thead>

              <tbody>
                {items.map((keyword) => (
                  <tr key={keyword.id}>
                    <td>
                      <b>{keyword.term}</b>
                    </td>

                    <td>
                      {keyword.groupId === "all"
                        ? "كل المجموعات"
                        : groups.find(
                            (group) => group.id === keyword.groupId
                          )?.name || "مجموعة محذوفة"}
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
                        <button
                          className="icon-btn"
                          onClick={() => void toggle(keyword)}
                          title="تبديل الحالة"
                          type="button"
                        >
                          {keyword.enabled
                            ? <ToggleRight />
                            : <ToggleLeft />}
                        </button>

                        <button
                          className="icon-btn danger-icon"
                          onClick={() => void remove(keyword)}
                          title="حذف"
                          type="button"
                        >
                          <Trash2 />
                        </button>
                      </div>
                    </td>
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
