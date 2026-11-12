
import { supabase } from "./supabase";

import type {
  GroupRecord,
  KeywordRecord,
  MentionRecord
} from "../types";

type DbRow = Record<string, unknown>;

type SupabaseError = {
  message?: string;
  code?: string;
};

function handleError(error: SupabaseError | null): void {
  if (!error) return;

  const message = error.message || "حدث خطأ غير معروف.";

  if (
    error.code === "42501" ||
    error.code === "PGRST301"
  ) {
    throw new Error(
      "ليس لديك صلاحية لتنفيذ هذه العملية. تحقق من إعدادات RLS في Supabase."
    );
  }

  if (error.code === "23505") {
    throw new Error("هذه البيانات موجودة بالفعل.");
  }

  if (error.code === "23503") {
    throw new Error(
      "لا يمكن تنفيذ العملية بسبب وجود بيانات مرتبطة بهذا السجل."
    );
  }

  if (error.code === "22P02") {
    throw new Error("صيغة إحدى البيانات غير صحيحة.");
  }

  throw new Error(message);
}

function timestampToNumber(value: unknown): number {
  if (typeof value === "number") return value;

  if (typeof value === "string") {
    const parsed = Date.parse(value);

    return Number.isNaN(parsed) ? Date.now() : parsed;
  }

  return Date.now();
}

function mapGroup(row: DbRow): GroupRecord {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    name: String(row.name ?? ""),
    url: String(row.url ?? ""),
    status:
      row.status === "active" || row.status === "paused"
        ? row.status
        : "unverified",
    description:
      typeof row.description === "string"
        ? row.description
        : undefined,
    createdAt: timestampToNumber(row.created_at)
  };
}

function mapKeyword(row: DbRow): KeywordRecord {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    term: String(row.keyword ?? ""),
    groupId:
      typeof row.group_id === "string"
        ? row.group_id
        : "all",
    enabled: row.is_active !== false,
    priority: row.priority === "high" ? "high" : "normal",
    createdAt: timestampToNumber(row.created_at)
  };
}

function mapMention(row: DbRow): MentionRecord {
  const content =
    typeof row.content === "string"
      ? row.content
      : String(row.post_text ?? "");

  const matchedTerms = Array.isArray(row.matched_terms)
    ? row.matched_terms.map(String)
    : row.matched_keyword
      ? [String(row.matched_keyword)]
      : [];

  const sourceUrl =
    typeof row.source_url === "string"
      ? row.source_url
      : typeof row.post_url === "string"
        ? row.post_url
        : undefined;

  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    groupId:
      typeof row.group_id === "string"
        ? row.group_id
        : "",
    content,
    contentType:
      row.content_type === "comment"
        ? "comment"
        : "post",
    matchedTerms,
    sourceUrl,
    sourceLabel:
      typeof row.source_label === "string"
        ? row.source_label
        : undefined,
    detectedAt: timestampToNumber(row.detected_at)
  };
}

// ---------------------------------
// VALIDATION
// ---------------------------------

function validateGroupInput(
  name: string,
  url: string
): { name: string; url: string } {
  const cleanName = name.trim();
  const cleanUrl = url.trim();

  if (!cleanName) {
    throw new Error("اكتب اسم المجموعة.");
  }

  if (cleanName.length > 150) {
    throw new Error("اسم المجموعة طويل جداً.");
  }

  if (!cleanUrl) {
    throw new Error("اكتب رابط المجموعة.");
  }

  try {
    const parsed = new URL(cleanUrl);

    if (
      parsed.protocol !== "https:" &&
      parsed.protocol !== "http:"
    ) {
      throw new Error();
    }
  } catch {
    throw new Error("رابط المجموعة غير صحيح.");
  }

  return {
    name: cleanName,
    url: cleanUrl
  };
}

function validateKeywordInput(term: string): string {
  const cleanTerm = term.trim();

  if (!cleanTerm) {
    throw new Error("اكتب الكلمة المفتاحية.");
  }

  if (cleanTerm.length > 200) {
    throw new Error("الكلمة المفتاحية طويلة جداً.");
  }

  return cleanTerm;
}

function validatePriority(
  priority: KeywordRecord["priority"]
): void {
  if (priority !== "normal" && priority !== "high") {
    throw new Error("الأولوية المحددة غير صحيحة.");
  }
}

// ---------------------------------
// GROUPS
// ---------------------------------

export async function listGroups(
  ownerId: string
): Promise<GroupRecord[]> {
  if (!ownerId) return [];

  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  handleError(error);

  return (data ?? []).map((row) =>
    mapGroup(row as DbRow)
  );
}

export function newGroupId(): string {
  return crypto.randomUUID();
}

export async function createGroup(
  ownerId: string,
  name: string,
  url: string,
  groupId: string
): Promise<void> {
  if (!ownerId) {
    throw new Error("الحساب غير مسجل الدخول.");
  }

  if (!groupId) {
    throw new Error("معرّف المجموعة غير صحيح.");
  }

  const clean = validateGroupInput(name, url);

  const { error } = await supabase
    .from("groups")
    .upsert(
      {
        id: groupId,
        owner_id: ownerId,
        name: clean.name,
        url: clean.url,
        status: "unverified"
      },
      {
        onConflict: "id"
      }
    );

  handleError(error);
}

export async function updateGroup(
  id: string,
  ownerId: string,
  name: string,
  url: string
): Promise<void> {
  if (!id || !ownerId) {
    throw new Error("بيانات المجموعة أو الحساب غير صحيحة.");
  }

  const clean = validateGroupInput(name, url);

  const { data, error } = await supabase
    .from("groups")
    .update({
      name: clean.name,
      url: clean.url
    })
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select("id")
    .maybeSingle();

  handleError(error);

  if (!data) {
    throw new Error(
      "لم يتم تعديل المجموعة. ربما لا تملك صلاحية تعديلها."
    );
  }
}

export async function setGroupStatus(
  id: string,
  status: GroupRecord["status"]
): Promise<void> {
  if (!id) {
    throw new Error("معرّف المجموعة غير صحيح.");
  }

  if (
    status !== "active" &&
    status !== "paused" &&
    status !== "unverified"
  ) {
    throw new Error("حالة المجموعة غير صحيحة.");
  }

  const { data, error } = await supabase
    .from("groups")
    .update({ status })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  handleError(error);

  if (!data) {
    throw new Error(
      "لم يتم العثور على المجموعة أو لا تملك صلاحية تعديلها."
    );
  }
}

export async function removeGroup(
  id: string
): Promise<void> {
  if (!id) {
    throw new Error("معرّف المجموعة غير صحيح.");
  }

  const { data, error } = await supabase
    .from("groups")
    .delete()
    .eq("id", id)
    .select("id");

  handleError(error);

  if (!data || data.length === 0) {
    throw new Error(
      "لم يتم حذف المجموعة. ربما لا تملك صلاحية حذفها."
    );
  }
}

// ---------------------------------
// KEYWORDS
// ---------------------------------

export async function listKeywords(
  ownerId: string
): Promise<KeywordRecord[]> {
  if (!ownerId) return [];

  const { data, error } = await supabase
    .from("keywords")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  handleError(error);

  return (data ?? []).map((row) =>
    mapKeyword(row as DbRow)
  );
}

// إضافة كلمة مفتاحية مع تحديد الأولوية
export async function createKeyword(
  ownerId: string,
  term: string,
  groupId: string | "all",
  priority: KeywordRecord["priority"] = "normal"
): Promise<void> {
  if (!ownerId) {
    throw new Error("الحساب غير مسجل الدخول.");
  }

  const cleanTerm = validateKeywordInput(term);

  validatePriority(priority);

  const { error } = await supabase
    .from("keywords")
    .insert({
      owner_id: ownerId,
      keyword: cleanTerm,
      group_id: groupId === "all" ? null : groupId,
      is_active: true,
      priority
    });

  handleError(error);
}

// تعديل كلمة مفتاحية
export async function updateKeyword(
  id: string,
  changes: Partial<KeywordRecord>
): Promise<void> {
  if (!id) {
    throw new Error("معرّف الكلمة المفتاحية غير صحيح.");
  }

  const update: Record<string, unknown> = {};

  if (typeof changes.term === "string") {
    update.keyword = validateKeywordInput(changes.term);
  }

  if (typeof changes.enabled === "boolean") {
    update.is_active = changes.enabled;
  }

  if (changes.priority !== undefined) {
    validatePriority(changes.priority);
    update.priority = changes.priority;
  }

  if (typeof changes.groupId === "string") {
    update.group_id =
      changes.groupId === "all"
        ? null
        : changes.groupId;
  }

  if (Object.keys(update).length === 0) return;

  const { data, error } = await supabase
    .from("keywords")
    .update(update)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  handleError(error);

  if (!data) {
    throw new Error(
      "لم يتم العثور على الكلمة أو لا تملك صلاحية تعديلها."
    );
  }
}

// حذف كلمة مفتاحية
export async function removeKeyword(
  id: string
): Promise<void> {
  if (!id) {
    throw new Error("معرّف الكلمة المفتاحية غير صحيح.");
  }

  const { data, error } = await supabase
    .from("keywords")
    .delete()
    .eq("id", id)
    .select("id");

  handleError(error);

  if (!data || data.length === 0) {
    throw new Error(
      "لم يتم حذف الكلمة. تحقق من صلاحيات الحساب."
    );
  }
}

// ---------------------------------
// MENTIONS
// ---------------------------------

export async function listMentions(
  ownerId: string
): Promise<MentionRecord[]> {
  if (!ownerId) return [];

  const { data, error } = await supabase
    .from("mentions")
    .select("*")
    .eq("owner_id", ownerId)
    .order("detected_at", { ascending: false });

  handleError(error);

  return (data ?? []).map((row) =>
    mapMention(row as DbRow)
  );
}
