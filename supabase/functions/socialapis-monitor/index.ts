
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const POSTS_WINDOW_HOURS = 9;
const POSTS_LIMIT = 9;
const API_TIMEOUT_MS = 25_000;
const PENDING_NOTIFICATION_LIMIT = 25;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const normalize = (value: string) =>
  value.normalize("NFC").toLocaleLowerCase().trim();

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : String(error);
}

function extractPosts(payload: any): any[] {
  const candidates = [
    payload?.data?.posts,
    payload?.posts,
    payload?.data?.data?.posts,
    payload?.data,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function parsePostDate(post: any): Date | null {
  const raw =
    post?.details?.created_at ??
    post?.details?.published_at ??
    post?.values?.created_at ??
    post?.values?.timestamp ??
    post?.created_at ??
    post?.published_at ??
    post?.timestamp ??
    null;

  if (raw === null || raw === undefined) return null;

  let date: Date;

  if (typeof raw === "number" || /^\d+$/.test(String(raw))) {
    let value = Number(raw);

    // Convert Unix seconds to milliseconds.
    if (value > 0 && value < 10_000_000_000) {
      value *= 1000;
    }

    date = new Date(value);
  } else {
    date = new Date(String(raw));
  }

  return Number.isNaN(date.getTime()) ? null : date;
}

function extractPost(post: any) {
  const id =
    post?.details?.post_id ??
    post?.values?.post_id ??
    post?.post_id ??
    post?.id ??
    post?.postId;

  const content = String(
    post?.values?.text ??
    post?.text ??
    post?.message ??
    post?.caption ??
    post?.content ??
    ""
  ).trim().normalize("NFC");

  const url =
    post?.details?.post_link ??
    post?.post_link ??
    post?.url ??
    post?.permalink_url ??
    post?.permalink ??
    null;

  return {
    id: id ? String(id) : null,
    content,
    url: url ? String(url) : null,
    createdAt: parsePostDate(post),
  };
}

async function findExistingNotification(
  supabase: any,
  ownerId: string,
  detectedItemId: string
) {
  const { data, error } = await supabase
    .from("monitoring_notifications")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("detected_item_id", detectedItemId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data;
}

async function ensureNotification(
  supabase: any,
  ownerId: string,
  item: any
): Promise<"created" | "existing"> {
  const existing = await findExistingNotification(
    supabase,
    ownerId,
    item.id
  );

  let result: "created" | "existing" = "existing";

  if (!existing) {
    const terms = Array.isArray(item.matched_terms)
      ? item.matched_terms.filter(Boolean)
      : [];

    const { error: insertError } = await supabase
      .from("monitoring_notifications")
      .insert({
        owner_id: ownerId,
        detected_item_id: item.id,
        title: "تم العثور على منشور مطابق",
        message: `الكلمات المطابقة: ${terms.join(", ")}`,
        source_url: item.source_url ?? null,
        delivery_status: "pending",
      });

    if (insertError) {
      // A concurrent request may have inserted the notification.
      const afterError = await findExistingNotification(
        supabase,
        ownerId,
        item.id
      );

      if (!afterError) {
        throw new Error(
          `Notification creation failed: ${insertError.message}`
        );
      }
    } else {
      result = "created";
    }
  }

  const { error: markError } = await supabase
    .from("detected_items")
    .update({ notification_sent: true })
    .eq("id", item.id)
    .eq("owner_id", ownerId);

  if (markError) {
    throw new Error(
      `Failed to mark notification as sent: ${markError.message}`
    );
  }

  return result;
}

/**
 * Processes a bounded number of pending notifications per run.
 * Remaining items are picked up by later successful runs.
 */
async function retryPendingNotifications(
  supabase: any,
  ownerId: string,
  groupId: string
) {
  const { data: pendingItems, error } = await supabase
    .from("detected_items")
    .select("id, matched_terms, source_url")
    .eq("owner_id", ownerId)
    .eq("group_id", groupId)
    .eq("notification_sent", false)
    .order("detected_at", { ascending: true })
    .limit(PENDING_NOTIFICATION_LIMIT);

  if (error) throw error;

  let created = 0;
  let alreadyExisting = 0;
  let processed = 0;

  for (const item of pendingItems ?? []) {
    const result = await ensureNotification(
      supabase,
      ownerId,
      item
    );

    if (result === "created") {
      created++;
    } else {
      alreadyExisting++;
    }

    processed++;
  }

  return {
    processed,
    created,
    already_existing: alreadyExisting,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return json(
      { success: false, error: "Method not allowed" },
      405
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const socialApiToken = Deno.env.get("SOCIALAPIS_API_TOKEN");

  if (!supabaseUrl || !serviceKey || !socialApiToken) {
    return json(
      {
        success: false,
        error: "Missing required server environment variables",
      },
      500
    );
  }

  const authorization = req.headers.get("Authorization") ?? "";
  const bearer = authorization
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!bearer || bearer !== serviceKey) {
    return json(
      { success: false, error: "Unauthorized" },
      401
    );
  }

  const supabase = createClient(
    supabaseUrl,
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  let body: any;

  try {
    body = await req.json();
  } catch {
    return json(
      { success: false, error: "Invalid JSON body" },
      400
    );
  }

  const jobs = Array.isArray(body?.jobs)
    ? body.jobs
    : [];

  if (jobs.length === 0) {
    return json({
      success: true,
      processed_jobs: 0,
      message: "No jobs received",
    });
  }

  const results: any[] = [];

  for (const job of jobs) {
    const jobId = job?.job_id;
    const runId = job?.run_id;
    const ownerId = job?.owner_id;
    const groupId = job?.group_id;

    let activeRunId = runId;

    try {
      if (!jobId || !ownerId || !groupId || !runId) {
        throw new Error(
          "Job is missing required identifiers"
        );
      }

      const { data: group, error: groupError } =
        await supabase
          .from("groups")
          .select("id, owner_id, name, url, status")
          .eq("id", groupId)
          .eq("owner_id", ownerId)
          .maybeSingle();

      if (groupError) throw groupError;
      if (!group) throw new Error("Group not found");

      if (group.status !== "active") {
        throw new Error("Group is not active");
      }

      if (!group.url) {
        throw new Error("Group URL is missing");
      }

      const { data: keywords, error: keywordError } =
        await supabase
          .from("keywords")
          .select("id, keyword, priority")
          .eq("owner_id", ownerId)
          .eq("is_active", true)
          .or(`group_id.is.null,group_id.eq.${groupId}`);

      if (keywordError) throw keywordError;

      const activeKeywords = (keywords ?? []).filter(
        (item: any) =>
          typeof item.keyword === "string" &&
          item.keyword.trim().length > 0
      );

      // Always use the last 9 hours, not interval_hours.
      const afterTime = new Date(
        Date.now() -
        POSTS_WINDOW_HOURS * 60 * 60 * 1000
      );

      const apiUrl = new URL(
        "https://api.socialapis.io/facebook/groups/posts"
      );

      apiUrl.searchParams.set("link", group.url);
      apiUrl.searchParams.set("limit", String(POSTS_LIMIT));
      apiUrl.searchParams.set("timezone", "UTC");
      apiUrl.searchParams.set(
        "after_time",
        afterTime.toISOString()
      );

      const apiResponse = await fetch(
        apiUrl.toString(),
        {
          method: "GET",
          headers: {
            "x-api-token": socialApiToken,
            "Accept": "application/json",
          },
          signal: AbortSignal.timeout(API_TIMEOUT_MS),
        }
      );

      const responseText = await apiResponse.text();

      if (!apiResponse.ok) {
        throw new Error(
          `SocialAPIs HTTP ${apiResponse.status}: ${responseText.slice(0, 500)}`
        );
      }

      let apiData: any;

      try {
        apiData = JSON.parse(responseText);
      } catch {
        throw new Error(
          "SocialAPIs returned invalid JSON"
        );
      }

      if (
        apiData?.success === false ||
        apiData?.error
      ) {
        throw new Error(
          String(
            apiData?.message ??
            apiData?.error ??
            "SocialAPIs API error"
          )
        );
      }

      const posts = extractPosts(apiData);

      let matchesFound = 0;
      let skippedPosts = 0;
      let oldPostsSkipped = 0;
      let newItemsSaved = 0;

      for (const rawPost of posts) {
        const post = extractPost(rawPost);

        if (!post.id || !post.content) {
          skippedPosts++;
          continue;
        }

        // If the API supplies a usable post date, enforce the window again.
        // If it does not, rely on SocialAPIs after_time filtering.
        if (
          post.createdAt &&
          post.createdAt.getTime() < afterTime.getTime()
        ) {
          oldPostsSkipped++;
          continue;
        }

        const normalizedContent = normalize(
          post.content
        );

        const matchedTerms = activeKeywords
          .filter((item: any) =>
            normalizedContent.includes(
              normalize(item.keyword)
            )
          )
          .map((item: any) => item.keyword);

        if (matchedTerms.length === 0) {
          continue;
        }

        matchesFound++;

        const { data: savedItems, error: insertError } =
          await supabase
            .from("detected_items")
            .upsert(
              {
                owner_id: ownerId,
                group_id: groupId,
                run_id: activeRunId,
                external_id: post.id,
                content_type: "post",
                content: post.content,
                source_url: post.url,
                matched_terms: matchedTerms,
                detected_at: new Date().toISOString(),
              },
              {
                onConflict: "owner_id,group_id,external_id",
                ignoreDuplicates: true,
              }
            )
            .select("id");

        if (insertError) throw insertError;

        if (savedItems?.length) {
          newItemsSaved += savedItems.length;
        }
      }

      // Retry only a bounded number of old pending notifications.
      const notificationSummary =
        await retryPendingNotifications(
          supabase,
          ownerId,
          groupId
        );

      const finishedAt = new Date().toISOString();

      const { error: finishRunError } =
        await supabase
          .from("monitoring_runs")
          .update({
            finished_at: finishedAt,
            status: "success",
            posts_checked: posts.length,
            comments_checked: 0,
            matches_found: matchesFound,
            error_message: null,
          })
          .eq("id", activeRunId)
          .eq("owner_id", ownerId);

      if (finishRunError) throw finishRunError;

      const { error: finishJobError } =
        await supabase
          .from("monitoring_jobs")
          .update({
            last_status: "success",
            last_error: null,
            last_run_at: finishedAt,
          })
          .eq("id", jobId)
          .eq("owner_id", ownerId);

      if (finishJobError) throw finishJobError;

      results.push({
        job_id: jobId,
        success: true,
        posts_checked: posts.length,
        skipped_posts: skippedPosts,
        old_posts_skipped: oldPostsSkipped,
        matches_found: matchesFound,
        new_items_saved: newItemsSaved,
        notifications_processed:
          notificationSummary.processed,
        notifications_created:
          notificationSummary.created,
        notifications_already_existing:
          notificationSummary.already_existing,
      });
    } catch (error) {
      const message = errorMessage(error);

      console.error("Monitoring job failed:", {
        job_id: jobId,
        run_id: activeRunId,
        error: message,
      });

      const retryAt = new Date(
        Date.now() + 5 * 60 * 1000
      ).toISOString();

      if (activeRunId && ownerId) {
        const { error: runUpdateError } =
          await supabase
            .from("monitoring_runs")
            .update({
              finished_at: new Date().toISOString(),
              status: "failed",
              error_message: message.slice(0, 2000),
            })
            .eq("id", activeRunId)
            .eq("owner_id", ownerId);

        if (runUpdateError) {
          console.error(
            "Could not update failed run:",
            runUpdateError
          );
        }
      }

      if (jobId && ownerId) {
        const { error: jobUpdateError } =
          await supabase
            .from("monitoring_jobs")
            .update({
              last_status: "pending",
              last_error: message.slice(0, 1000),
              next_run_at: retryAt,
              updated_at: new Date().toISOString(),
            })
            .eq("id", jobId)
            .eq("owner_id", ownerId);

        if (jobUpdateError) {
          console.error(
            "Could not schedule job retry:",
            jobUpdateError
          );
        }
      }

      results.push({
        job_id: jobId,
        success: false,
        error: message,
      });
    }
  }

  const succeeded = results.filter(
    (item) => item.success
  ).length;

  const failed = results.length - succeeded;

  return json({
    success: failed === 0,
    processed_jobs: results.length,
    succeeded,
    failed,
    results,
    timestamp: new Date().toISOString(),
  });
});
