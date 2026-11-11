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

import { supabaseReady } from "../lib/supabase";

import type {
  GroupRecord,
  KeywordRecord,
  MentionRecord
} from "../types";

export default function Dashboard() {
  const { user } = useAuth();

  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [keywords, setKeywords] = useState<KeywordRecord[]>([]);
  const [mentions, setMentions] = useState<MentionRecord[]>([]);
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

      try {
        const [groupData, keywordData, mentionData] =
          await Promise.all([
            listGroups(user.uid),
            listKeywords(user.uid),
            listMentions(user.uid)
          ]);

        if (!active) return;

        setGroups(groupData);
        setKeywords(keywordData);
        setMentions(mentionData);
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
          {supabaseReady
            ? "Supabase مُعد"
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
              text="لا توجد نتائج بعد. ستظهر هنا النتائج التي يضيفها مصدر بيانات مصرح به."
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
              <p>جاهزية مكونات المشروع</p>
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
                supabaseReady
                  ? "health-indicator good"
                  : "health-indicator warn"
              }
            />
            Supabase
            <b>
              {supabaseReady ? "مُعد" : "غير مُعد"}
            </b>
          </div>

          <div className="health-item">
            <span className="health-indicator warn" />
            مصدر Facebook
            <b>غير مربوط</b>
          </div>

          <div className="health-item">
            <span className="health-indicator warn" />
            الفحص السحابي
            <b>بانتظار الموصل</b>
          </div>

          <div className="notice warning compact">
            <AlertTriangle size={15} />
            لا توجد مراقبة حقيقية قبل ربط مصدر بيانات مصرح.
          </div>
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
