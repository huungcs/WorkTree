// Supabase Edge Function: organization-onboarding
// Automates creation of default root nodes upon organization registration.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const { organizationId, rootName } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Ensure root company node exists
    const { data: rootNode, error: nodeError } = await supabaseAdmin
      .from("organization_nodes")
      .insert({
        organization_id: organizationId,
        name: rootName || "Trụ sở chính",
        node_type: "company",
        sort_order: 1
      })
      .select()
      .single();

    if (nodeError) throw nodeError;

    return new Response(JSON.stringify({ success: true, rootNode }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
