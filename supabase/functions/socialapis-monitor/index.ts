
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    commentsCount: Number.isFinite(commentsCount) ? commentsCount : 0,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const socialApiToken = Deno.env.get("SOCIALAPIS_API_TOKEN");

  if (!supabaseUrl || !serviceKey || !socialApiToken) {
    return json({
      success: false,
      error: "Missing required server environment variables",
    }, 500);
  }

  const authorization = req.headers.get("Authorization") ?? "";
  const bearer = authorization.replace(/^Bearer\s+/i, "").trim();

  if (!bearer || bearer !== serviceKey) {
    return json({ success: false, error: "Unauthorized" }, 401);
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
    return json({ success: false, error: "Invalid JSON body" }, 400);
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
      if (!group.url) throw new Error("Group URL is missing");

      if (!activeRunId) {
        const { data: newRun, error: createRunError } = await supabase
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
            error_message: null,
          })
          .eq("id", activeRunId)
          .eq("owner_id", ownerId);

        if (runStartError) throw runStartError;
      }

      const { data: keywords, error: keywordError } = await supabase
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
      apiUrl.searchParams.set("limit", "50");
      apiUrl.searchParams.set("timezone", "UTC");
      apiUrl.searchParams.set("after_time", afterTime);

      const apiResponse = await fetch(apiUrl.toString(), {
        method: "GET",
        headers: {
          "x-api-token": socialApiToken,
          "Accept": "application/json",
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

      if (apiData?.success === false || apiData?.error) {
        throw new Error(
          String(apiData?.message ?? apiData?.error ?? "SocialAPIs API error")
        );
      }

      const posts = extractPosts(apiData);
      let matchesFound = 0;
      let notificationsCreated = 0;
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
            normalizedContent.includes(normalize(item.keyword))
          )
          .map((item: any) => item.keyword);

        if (matchedTerms.length === 0) continue;

        matchesFound++;

        const { data: insertedItems, error: insertError } = await supabase
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
          )
          .select("id");

        if (insertError) throw insertError;

        // Existing items are ignored, preventing duplicate alerts.
        if (!insertedItems || insertedItems.length === 0) continue;

        const itemId = insertedItems[0].id;

        const { error: notificationError } = await supabase
          .from("monitoring_notifications")
          .insert({
            owner_id: ownerId,
            detected_item_id: itemId,
            title: "تم العثور على منشور مطابق",
            message:
              `الكلمات المطابقة: ${matchedTerms.join("، ")}`,
            source_url: post.url,
            delivery_status: "pending",
          });

        if (notificationError) {
          console.error(
            "Notification insert failed:",
            notificationError.message
          );
        } else {
          notificationsCreated++;

          const { error: markError } = await supabase
            .from("detected_items")
            .update({ notification_sent: true })
            .eq("id", itemId)
            .eq("owner_id", ownerId);

          if (markError) {
            console.error("Notification flag update failed:", markError.message);
          }
        }
      }

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
        notifications_created: notificationsCreated,
      });

    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

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

  const succeeded = results.filter((item) => item.success).length;
  const failed = results.length - succeeded;

  return json({
    success: failed === 0,
    processed_jobs: results.length,
    succeeded,
    failed,
    results,
  });
});
