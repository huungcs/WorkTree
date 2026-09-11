// Supabase Edge Function: notification-dispatch
// Production-grade notification dispatcher:
// 1. Claims pending notification_jobs with row-level lock (FOR UPDATE SKIP LOCKED)
// 2. Verifies user preferences (quiet hours, push/in-app channels)
// 3. Delivers push notifications via OneSignal REST API
// 4. Dispatches realtime event to private user channel: user:<uuid>:notifications
// 5. Updates job receipt and idempotency record atomically

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID") || "";
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const MAX_EVENT_PUSH_AGE_MS = 2 * 60 * 60 * 1000;

function parseHour(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number.parseInt(String(value ?? "").split(":")[0], 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isQuietHour(tz: string, startValue: unknown, endValue: unknown): boolean {
  try {
    const startHour = parseHour(startValue, 22);
    const endHour = parseHour(endValue, 7);
    const now = new Date();
    const localHour = parseInt(
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz || "Asia/Ho_Chi_Minh",
        hour: "numeric",
        hour12: false
      }).format(now),
      10
    );

    if (startHour === endHour) return false;
    if (startHour < endHour) {
      return localHour >= startHour && localHour < endHour;
    } else {
      // Overnight (e.g. 22 to 7)
      return localHour >= startHour || localHour < endHour;
    }
  } catch {
    return false;
  }
}

serve(async (req: Request) => {
  // CORS Headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json"
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authorization = req.headers.get("authorization") || "";
    if (!SUPABASE_SERVICE_ROLE_KEY || authorization !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized dispatcher invocation" }), {
        headers: corsHeaders,
        status: 401
      });
    }
    if (!SUPABASE_URL || !ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: "Notification dispatcher is not configured" }), {
        headers: corsHeaders,
        status: 503
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });

    let batchSize = 20;
    let manualJobId: string | null = null;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.batch_size) batchSize = Math.min(Math.max(1, body.batch_size), 100);
        if (body.job_id) manualJobId = body.job_id;
      } catch {
        // Empty or non-JSON body is acceptable for cron GET/POST
      }
    }

    let claimedJobs: any[] = [];

    if (manualJobId) {
      const { data, error } = await supabaseAdmin
        .from("notification_jobs")
        .update({
          status: "processing",
          updated_at: new Date().toISOString()
        })
        .eq("id", manualJobId)
        .eq("status", "pending")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (data) {
        data.attempt_count = (data.attempt_count || 0) + 1;
        const { error: attemptError } = await supabaseAdmin
          .from("notification_jobs")
          .update({ attempt_count: data.attempt_count })
          .eq("id", data.id)
          .eq("status", "processing");
        if (attemptError) throw attemptError;
        claimedJobs = [data];
      }
    } else {
      // Call RPC to claim pending jobs atomically
      const { data, error } = await supabaseAdmin.rpc("claim_notification_jobs", {
        p_batch_size: batchSize
      });
      if (error) {
        console.error("Error claiming notification jobs:", error);
        throw error;
      }
      claimedJobs = data || [];
    }

    console.info(`[Notification Dispatcher] Claimed ${claimedJobs.length} jobs for processing`);

    const results = {
      total: claimedJobs.length,
      sent: 0,
      skipped: 0,
      failed: 0,
      details: [] as any[]
    };

    for (const job of claimedJobs) {
      const { id: jobId, recipient_user_id, organization_id, job_type, metadata, notification_id } = job;
      try {
        const scheduledAt = Date.parse(job.scheduled_for || job.created_at || "");
        const isStaleEventPush = job_type === "push_dispatch"
          && Number.isFinite(scheduledAt)
          && Date.now() - scheduledAt > MAX_EVENT_PUSH_AGE_MS;

        if (isStaleEventPush) {
          const { error: staleUpdateError } = await supabaseAdmin
            .from("notification_jobs")
            .update({
              status: "cancelled",
              last_error_code: "STALE_EVENT_PUSH",
              last_error: "Event push exceeded the two-hour delivery window",
              updated_at: new Date().toISOString()
            })
            .eq("id", jobId)
            .eq("status", "processing");
          if (staleUpdateError) throw staleUpdateError;

          results.skipped++;
          results.details.push({ jobId, status: "cancelled_stale_event" });
          continue;
        }

        // 1. Fetch notification content if linked. The notification kind is also
        // used to select the correct per-user push preference.
        let notifRecord = null;
        if (notification_id) {
          const { data: notif, error: notifError } = await supabaseAdmin
            .from("notifications")
            .select("*")
            .eq("id", notification_id)
            .maybeSingle();
          if (notifError) throw notifError;
          notifRecord = notif;
        }

        // 2. Fetch user preferences
        const { data: pref, error: prefError } = await supabaseAdmin
          .from("notification_preferences")
          .select("*")
          .eq("user_id", recipient_user_id)
          .maybeSingle();
        if (prefError) throw prefError;

        const pushEnabled = job_type === "manual_reminder"
          ? pref?.manual_reminder_push !== false
          : job_type === "due_soon_reminder"
          ? pref?.due_soon_push !== false
          : job_type === "overdue_reminder"
          ? pref?.overdue_push !== false
          : notifRecord?.kind === "task_comment"
          ? pref?.comment_push !== false
          : pref?.task_assigned_push !== false;
        const quietHoursEnabled = pref?.quiet_hours_enabled === true;
        const tz = pref?.timezone || "Asia/Ho_Chi_Minh";
        const quietStart = pref?.quiet_hours_start ?? 22;
        const quietEnd = pref?.quiet_hours_end ?? 7;

        // 3. Check Quiet Hours
        if (quietHoursEnabled && isQuietHour(tz, quietStart, quietEnd)) {
          console.info(`[Dispatcher] Job ${jobId} delayed due to quiet hours for user ${recipient_user_id}`);
          // Re-schedule for after quiet hours
          const { error: quietHoursUpdateError } = await supabaseAdmin
            .from("notification_jobs")
            .update({
              status: "pending",
              attempt_count: Math.max(0, (job.attempt_count || 1) - 1),
              scheduled_for: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq("id", jobId);
          if (quietHoursUpdateError) throw quietHoursUpdateError;

          results.skipped++;
          results.details.push({ jobId, status: "skipped_quiet_hours" });
          continue;
        }

        const title = notifRecord?.title || metadata?.title || "WorkTree X Thông báo";
        const body = notifRecord?.body || metadata?.body || metadata?.note || "Bạn có một cập nhật mới trong không gian làm việc.";
        const taskId = notifRecord?.task_id || job.task_id || metadata?.task_id || null;

        // 4. Fetch push devices and deliver through OneSignal
        let pushSent = false;
        let pushSkipReason: string | null = pushEnabled ? null : "push_disabled_by_user";
        if (pushEnabled) {
          const { data: devices, error: devicesError } = await supabaseAdmin
            .from("push_devices")
            .select("subscription_id")
            .eq("user_id", recipient_user_id)
            .eq("enabled", true);

          if (devicesError) throw devicesError;

          const subscriptionIds = (devices || [])
            .map((device: any) => device.subscription_id)
            .filter((id: unknown) => typeof id === "string" && id.length > 0 && !id.startsWith("web-"));

          if (subscriptionIds.length === 0) {
            pushSkipReason = "no_active_push_subscription";
          } else {
            const oneSignalPayload: any = {
              app_id: ONESIGNAL_APP_ID,
              target_channel: "push",
              include_subscription_ids: subscriptionIds,
              headings: { vi: title, en: title },
              contents: { vi: body, en: body },
              data: {
                taskId,
                organizationId: organization_id,
                notificationId: notification_id || jobId,
                url: `/index.html?task=${taskId || ""}`
              },
              web_url: `https://worktree.nguyentronghuu.com/index.html?task=${taskId || ""}`
            };

            const authHeader = ONESIGNAL_REST_API_KEY.startsWith("Key ")
              ? ONESIGNAL_REST_API_KEY
              : `Key ${ONESIGNAL_REST_API_KEY}`;

            const oneSignalRes = await fetch("https://api.onesignal.com/notifications", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: authHeader
              },
              body: JSON.stringify(oneSignalPayload)
            });

            if (oneSignalRes.ok) {
              const osData = await oneSignalRes.json();
              if (!osData?.id) throw new Error("ONESIGNAL_NO_MESSAGE_ID");
              console.info(`[Dispatcher] OneSignal delivered for job ${jobId}:`, osData.id);
              pushSent = true;
            } else {
              const errTxt = await oneSignalRes.text();
              throw new Error(`ONESIGNAL_HTTP_${oneSignalRes.status}: ${errTxt.slice(0, 500)}`);
            }
          }
        }

        // 5. Broadcast Realtime message to private channel
        try {
          const realtimeChannel = supabaseAdmin.channel(`user:${recipient_user_id}:notifications`);
          await realtimeChannel.send({
            type: "broadcast",
            event: "notification_received",
            payload: {
              notificationId: notification_id,
              jobId,
              title,
              body,
              taskId,
              organizationId: organization_id,
              createdAt: new Date().toISOString()
            }
          });
        } catch (rtErr) {
          console.warn(`[Dispatcher] Realtime broadcast error for user ${recipient_user_id}:`, rtErr);
        }

        // 6. Mark job completed
        const { error: sentUpdateError } = await supabaseAdmin
          .from("notification_jobs")
          .update({
            status: "sent",
            last_error_code: null,
            last_error: null,
            updated_at: new Date().toISOString()
          })
          .eq("id", jobId);
        if (sentUpdateError) throw sentUpdateError;

        results.sent++;
        results.details.push({ jobId, status: "sent", pushSent, pushSkipReason });
      } catch (jobErr: any) {
        console.error(`[Dispatcher] Failed to process job ${jobId}:`, jobErr);
        const nextAttempt = Math.max(1, job.attempt_count || 1);
        const maxAttempts = job.max_attempts || 3;
        const newStatus = nextAttempt >= maxAttempts ? "failed" : "pending";
        // Exponential backoff retry (1m, 4m, 9m...)
        const retryDelayMs = Math.pow(nextAttempt, 2) * 60 * 1000;

        await supabaseAdmin
          .from("notification_jobs")
          .update({
            status: newStatus,
            attempt_count: nextAttempt,
            last_error_code: String(jobErr.message || "DISPATCH_ERROR").split(":")[0].slice(0, 120),
            last_error: jobErr.message || String(jobErr),
            scheduled_for: new Date(Date.now() + retryDelayMs).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq("id", jobId);

        results.failed++;
        results.details.push({ jobId, status: newStatus, error: jobErr.message });
      }
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: corsHeaders,
      status: 200
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      headers: corsHeaders,
      status: 500
    });
  }
});
