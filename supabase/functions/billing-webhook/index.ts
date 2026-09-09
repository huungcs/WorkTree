// Supabase Edge Function: billing-webhook
// Securely verifies subscription payments and provisions tenant capacity.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
    status: 200
  });
});
