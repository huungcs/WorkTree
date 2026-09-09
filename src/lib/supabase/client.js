/**
 * WorkTree X — Supabase Client Factory
 * Strictly uses Publishable Key in Browser. No secret keys allowed.
 */

export const SUPABASE_CONFIG = {
  url: 'https://taupjuaficdzdgbmxmbe.supabase.co',
  publishableKey: 'sb_publishable_U_sRQahpts_YouuXX5xbJQ_wpohAq4t'
};

let supabaseInstance = null;

export async function getSupabase() {
  if (supabaseInstance) return supabaseInstance;

  // Use pre-loaded script tag if available
  if (window.supabase?.createClient) {
    supabaseInstance = window.supabase.createClient(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.publishableKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );
    return supabaseInstance;
  }

  // Dynamic import fallback
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    supabaseInstance = createClient(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.publishableKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );
    return supabaseInstance;
  } catch (err) {
    console.error('Không thể tải Supabase JS SDK:', err);
    throw new Error('Chưa kết nối được tới Supabase SDK. Vui lòng kiểm tra kết nối mạng.');
  }
}
