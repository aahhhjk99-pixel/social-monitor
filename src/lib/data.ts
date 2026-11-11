import {
  addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where, orderBy
} from "firebase/firestore";
import { db } from "../firebase";
import type { GroupRecord, KeywordRecord, MentionRecord } from "../types";

function database() {
  if (!db) throw new Error("Firebase غير مُعد. أضف بيانات .env أولاً.");
  return db;
}

export async function listGroups(ownerId: string): Promise<GroupRecord[]> {
  const q = query(collection(database(), "groups"), where("ownerId", "==", ownerId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as GroupRecord));
}

export async function createGroup(ownerId: string, name: string, url: string) {
  return addDoc(collection(database(), "groups"), {
    ownerId, name: name.trim(), url: url.trim(), status: "unverified", createdAt: Date.now()
  });
}

export async function setGroupStatus(id: string, status: GroupRecord["status"]) {
  return updateDoc(doc(database(), "groups", id), { status });
}

export async function removeGroup(id: string) {
  return deleteDoc(doc(database(), "groups", id));
}

export async function listKeywords(ownerId: string): Promise<KeywordRecord[]> {
  const q = query(collection(database(), "keywords"), where("ownerId", "==", ownerId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as KeywordRecord));
}

export async function createKeyword(ownerId: string, term: string, groupId: string | "all") {
  return addDoc(collection(database(), "keywords"), {
    ownerId, term: term.trim(), groupId, enabled: true, priority: "normal", createdAt: Date.now()
  });
}

export async function updateKeyword(id: string, changes: Partial<KeywordRecord>) {
  return updateDoc(doc(database(), "keywords", id), changes);
}

export async function removeKeyword(id: string) {
  return deleteDoc(doc(database(), "keywords", id));
}

export async function listMentions(ownerId: string): Promise<MentionRecord[]> {
  const q = query(collection(database(), "mentions"), where("ownerId", "==", ownerId), orderBy("detectedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as MentionRecord));
}
