export type GroupRecord = {
  id: string;
  ownerId: string;
  name: string;
  url: string;
  status: "active" | "paused" | "unverified";
  description?: string;
  createdAt: number;
};

export type KeywordRecord = {
  id: string;
  ownerId: string;
  term: string;
  groupId: string | "all";
  enabled: boolean;
  priority: "normal" | "high";
  createdAt: number;
};

export type MentionRecord = {
  id: string;
  ownerId: string;
  groupId: string;
  content: string;
  contentType: "post" | "comment";
  matchedTerms: string[];
  sourceUrl?: string;
  detectedAt: number;
  sourceLabel?: string;
};
