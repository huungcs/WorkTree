/**
 * Syncs local .env AI settings (AI_API_BASE_URL, AI_API_KEY, AI_MODEL, AI_FALLBACK_MODEL)
 * into Supabase `public.platform_ai_settings` via service_role without logging secrets.
 */

const { createClient } = require('@supabase/supabase-js');
const { loadAiConfig, invalidateAiConfigCache } = require('../api/ai');

async function main() {
  const cfg = loadAiConfig();
  if (!cfg.supabaseUrl || !cfg.supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY.');
    process.exit(1);
  }
  if (!cfg.apiKey) {
    console.error('Missing AI_API_KEY in local .env or process.env.');
    process.exit(1);
  }

  const supabase = createClient(cfg.supabaseUrl, cfg.supabaseKey);
  const { error } = await supabase
    .from('platform_ai_settings')
    .upsert({
      id: 'default',
      provider: 'xpiki',
      api_base_url: cfg.apiBaseUrl,
      api_key: cfg.apiKey,
      model: cfg.model,
      fallback_model: cfg.fallbackModel || 'claude-opus-4-6',
      is_enabled: true,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

  if (error) {
    console.error('Failed to sync AI settings to Supabase:', error.message);
    if (error.code === 'PGRST205') {
      console.error('Please run supabase/migrations/20261119021000_add_platform_ai_settings.sql in Supabase SQL Editor first.');
    }
    process.exit(1);
  }

  invalidateAiConfigCache();
  console.log(JSON.stringify({
    ok: true,
    synced: true,
    provider: 'xpiki',
    apiBaseUrl: cfg.apiBaseUrl,
    model: cfg.model,
    fallbackModel: cfg.fallbackModel,
    hasApiKey: true
  }));
}

main().catch(err => {
  console.error('Unexpected error syncing AI settings:', err.message);
  process.exit(1);
});
