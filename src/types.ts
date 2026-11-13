
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

export type NotificationRecord = {
  id: string;
  ownerId: string;
  detectedItemId: string;
  title: string;
  message: string;
  sourceUrl?: string;
  readAt?: number;
  sentAt?: number;
  deliveryStatus: "pending" | "sent" | "failed";
  deliveryError?: string;
  createdAt: number;
};

export type MonitoringJobRecord = {
  id: string;
  ownerId: string;
  groupId: string;
  enabled: boolean;
  intervalHours: number;
  nextRunAt?: number;
  lastRunAt?: number;
  lastStatus: "pending" | "running" | "success" | null;
  lastError?: string;
  createdAt: number;
  updatedAt?: number;
};

export type MonitoringRunRecord = {
  id: string;
  ownerId: string;
  jobId: string;
  startedAt: number;
  finishedAt?: number;
  status: "running" | "success" | "failed";
  postsChecked: number;
  commentsChecked: number;
  matchesFound: number;
  errorMessage?: string;
  createdAt: number;
};
