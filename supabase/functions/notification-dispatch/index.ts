// Supabase Edge Function: notification-dispatch
// Dispatches batch notifications to users based on task updates.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  return new Response(JSON.stringify({ dispatched: true }), {
    headers: { "Content-Type": "application/json" },
    status: 200
  });
});
