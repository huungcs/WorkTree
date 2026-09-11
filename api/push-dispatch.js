/**
 * WorkTree X — Cloud Push Notification Dispatcher (Serverless Function)
 * Automatically claims pending notification_jobs and delivers Web Push
 * directly to user devices via OneSignal REST API.
 */

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabaseUrl = (process.env.SUPABASE_URL || 'https://taupjuaficdzdgbmxmbe.supabase.co').trim();
  const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const appId = (process.env.ONESIGNAL_APP_ID || '252025b0-77e3-42c4-81f4-fcdb37f5925a').trim();
  const apiKey = (process.env.ONESIGNAL_REST_API_KEY || '').trim();

  if (!supabaseUrl || !supabaseKey || !appId || !apiKey) {
    return res.status(503).json({
      error: 'Missing required push dispatch secrets',
      configured: {
        supabaseUrl: !!supabaseUrl,
        supabaseKey: !!supabaseKey,
        appId: !!appId,
        apiKey: !!apiKey
      }
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Fetch pending notification jobs
    const nowIso = new Date().toISOString();
    const { data: jobs, error: jobsErr } = await supabase
      .from('notification_jobs')
      .select('id, organization_id, recipient_user_id, notification_id, task_id, job_type, status, attempt_count')
      .eq('status', 'pending')
      .lte('scheduled_for', nowIso)
      .order('scheduled_for', { ascending: true })
      .limit(25);

    if (jobsErr) {
      console.error('[Dispatcher] Error querying jobs:', jobsErr);
      return res.status(500).json({ error: jobsErr.message });
    }

    if (!jobs || jobs.length === 0) {
      return res.status(200).json({ success: true, processed: 0, message: 'No pending jobs' });
    }

    console.info(`[Dispatcher] Processing ${jobs.length} pending notification jobs...`);
    let deliveredCount = 0;

    for (const job of jobs) {
      try {
        // Fetch notification details
        const { data: notif } = await supabase
          .from('notifications')
          .select('id, title, body, kind, task_id')
          .eq('id', job.notification_id)
          .maybeSingle();

        // Fetch recipient's registered push devices
        const { data: devices } = await supabase
          .from('push_devices')
          .select('subscription_id')
          .eq('user_id', job.recipient_user_id)
          .eq('enabled', true);

        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const subscriptionIds = (devices || [])
          .map(d => d.subscription_id)
          .filter(id => id && UUID_REGEX.test(id));

        if (subscriptionIds.length > 0) {
          const authHeader = apiKey.startsWith('Key ') ? apiKey : `Key ${apiKey}`;
          const title = notif?.title || '🔔 WorkTree X';
          const body = notif?.body || 'Bạn có công việc mới cần xử lý';

          const osRes = await fetch('https://api.onesignal.com/notifications', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader
            },
            body: JSON.stringify({
              app_id: appId,
              include_subscription_ids: subscriptionIds,
              headings: { en: title },
              contents: { en: body },
              data: {
                url: 'https://worktree.nguyentronghuu.com',
                taskId: job.task_id || notif?.task_id || null,
                notificationId: job.notification_id
              }
            })
          });

          if (osRes.ok) {
            deliveredCount++;
          } else {
            const errTxt = await osRes.text();
            console.warn(`[Dispatcher] OneSignal rejected push for job ${job.id}:`, errTxt);
          }
        }

        // Mark job as completed
        await supabase
          .from('notification_jobs')
          .update({
            status: 'sent',
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);

      } catch (jobErr) {
        console.error(`[Dispatcher] Error processing job ${job.id}:`, jobErr);
        await supabase
          .from('notification_jobs')
          .update({
            attempt_count: (job.attempt_count || 0) + 1,
            last_error: String(jobErr?.message || jobErr),
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);
      }
    }

    return res.status(200).json({
      success: true,
      processed: jobs.length,
      deliveredToDevices: deliveredCount
    });

  } catch (err) {
    console.error('[Dispatcher] Unexpected error:', err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
};
