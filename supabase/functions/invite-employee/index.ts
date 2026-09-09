// Supabase Edge Function: invite-employee
// Trusted environment with SERVICE_ROLE_KEY access to generate invite tokens.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const { email, organizationId, role = 'member' } = await req.json();

    if (!email || !organizationId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Create or find invitation in invitations table
    const { data, error } = await supabaseAdmin
      .from("invitations")
      .insert({
        organization_id: organizationId,
        email: email.toLowerCase(),
        role: role
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, invitation: data }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
