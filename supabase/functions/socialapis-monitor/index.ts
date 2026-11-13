
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PAGE_SIZE = 500;

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

  const commentsCount = Number(
    post?.details?.comments_count ??
    post?.comments_count ??
    post?.commentsCount ??
    0
  );

  return {
    id: id ? String(id) : null,
    content,
    url: url ? String(url) : null,
    commentsCount: Number.isFinite(commentsCount)
      ? commentsCount
      : 0,
  };
}

/**
 * Checks whether a notification already exists for a detected item.
 */
async function findExistingNotification(
  supabase: any,
  detectedItemId: string
) {
  const { data, error } = await supabase
    .from("monitoring_notifications")
    .select("id")
    .eq("detected_item_id", detectedItemId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data;
}

/**
 * Ensures that a detected item has a notification.
 *
 * The detected item's notification_sent flag is updated
 * only after the notification is confirmed to exist.
 */
async function ensureNotification(
  supabase: any,
  ownerId: string,
  item: any
): Promise<"created" | "existing"> {
  const existing = await findExistingNotification(
    supabase,
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
        message: `الكلمات المطابقة: ${terms.join("، ")}`,
        source_url: item.source_url ?? null,
        delivery_status: "pending",
      });

    if (insertError) {
      // A concurrent execution may have inserted it.
      const notificationAfterError =
        await findExistingNotification(supabase, item.id);

      if (!notificationAfterError) {
        throw new Error(
          `Notification creation failed for item ${item.id}: ${insertError.message}`
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
      `Failed to mark notification as sent for item ${item.id}: ${markError.message}`
    );
  }

  return result;
}

/**
 * Retries notifications for all previously detected items
 * that are still marked notification_sent = false.
 *
 * Uses keyset pagination so updating rows does not cause
 * records to be skipped by offset pagination.
 */
async function retryPendingNotifications(
  supabase: any,
  ownerId: string,
  groupId: string
) {
  let cursor: string | null = null;
  let created = 0;
  let alreadyExisting = 0;
  let processed = 0;

  while (true) {
    let query = supabase
      .from("detected_items")
      .select("id, matched_terms, source_url")
      .eq("owner_id", ownerId)
      .eq("group_id", groupId)
      .eq("notification_sent", false)
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);

    if (cursor) {
      query = query.gt("id", cursor);
    }

    const { data: pendingItems, error: pendingError } =
      await query;

    if (pendingError) throw pendingError;

    if (!pendingItems || pendingItems.length === 0) {
      break;
    }

    for (const item of pendingItems) {
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

    cursor = pendingItems[pendingItems.length - 1].id;

    if (pendingItems.length < PAGE_SIZE) {
      break;
    }
  }

  return {
    processed,
    created,
    already_existing: alreadyExisting,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let body: any;

  try {
    body = await req.json();
  } catch {
    return json(
      { success: false, error: "Invalid JSON body" },
      400
    );
  }

  const jobs = Array.isArray(body?.jobs) ? body.jobs : [];

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
      if (!jobId || !ownerId || !groupId) {
        throw new Error("Job is missing required identifiers");
      }

      const { data: group, error: groupError } = await supabase
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

      if (!activeRunId) {
        const { data: newRun, error: createRunError } =
          await supabase
            .from("monitoring_runs")
            .insert({
              owner_id: ownerId,
              job_id: jobId,
              started_at: new Date().toISOString(),
              status: "running",
              posts_checked: 0,
              comments_checked: 0,
              matches_found: 0,
            })
            .select("id")
            .single();

        if (createRunError) throw createRunError;

        activeRunId = newRun.id;
      } else {
        const { error: runStartError } = await supabase
          .from("monitoring_runs")
          .update({
            status: "running",
            started_at: new Date().toISOString(),
            finished_at: null,
            error_message: null,
          })
          .eq("id", activeRunId)
          .eq("owner_id", ownerId);

        if (runStartError) throw runStartError;
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
        (item: any) => item.keyword?.trim()
      );

      const intervalHours = Math.max(
        1,
        Math.min(24, Number(job.interval_hours) || 6)
      );

      const afterTime = new Date(
        Date.now() - intervalHours * 60 * 60 * 1000
      ).toISOString();

      const apiUrl = new URL(
        "https://api.socialapis.io/facebook/groups/posts"
      );

      apiUrl.searchParams.set("link", group.url);

      // SocialAPIs accepts a maximum limit of 9.
      apiUrl.searchParams.set("limit", "9");

      apiUrl.searchParams.set("timezone", "UTC");
      apiUrl.searchParams.set("after_time", afterTime);

      const apiResponse = await fetch(apiUrl.toString(), {
        method: "GET",
        headers: {
          "x-api-token": socialApiToken,
          Accept: "application/json",
        },
      });

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
        throw new Error("SocialAPIs returned invalid JSON");
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

      for (const rawPost of posts) {
        const post = extractPost(rawPost);

        if (!post.id || !post.content) {
          skippedPosts++;
          continue;
        }

        const normalizedContent = normalize(post.content);

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

        const { error: insertError } = await supabase
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
              notification_sent: false,
            },
            {
              onConflict: "owner_id,group_id,external_id",
              ignoreDuplicates: true,
            }
          );

        if (insertError) throw insertError;
      }

      // Retry notifications for both newly detected items
      // and older items whose notification creation previously failed.
      const notificationSummary =
        await retryPendingNotifications(
          supabase,
          ownerId,
          groupId
        );

      const finishedAt = new Date().toISOString();

      const { error: finishRunError } = await supabase
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

      const { error: finishJobError } = await supabase
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
        matches_found: matchesFound,
        notifications_processed:
          notificationSummary.processed,
        notifications_created:
          notificationSummary.created,
        notifications_already_existing:
          notificationSummary.already_existing,
      });

    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      console.error("Monitoring job failed:", {
        job_id: jobId,
        error: message,
      });

      if (activeRunId && ownerId) {
        await supabase
          .from("monitoring_runs")
          .update({
            finished_at: new Date().toISOString(),
            status: "failed",
            error_message: message.slice(0, 2000),
          })
          .eq("id", activeRunId)
          .eq("owner_id", ownerId);
      }

      if (jobId && ownerId) {
        await supabase
          .from("monitoring_jobs")
          .update({
            last_status: "pending",
            last_error: message.slice(0, 2000),
          })
          .eq("id", jobId)
          .eq("owner_id", ownerId);
      }

      results.push({
        job_id: jobId ?? null,
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
  });
});
