import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase-admin.js";

const APP_STATE_ID = "default";

export async function GET() {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const { data, error } = await supabaseAdmin
    .from("app_state")
    .select("state, updated_at")
    .eq("id", APP_STATE_ID)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    state: data?.state ?? null,
    updatedAt: data?.updated_at ?? null
  });
}

export async function PUT(request) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const payload = await request.json();

  const { data, error } = await supabaseAdmin
    .from("app_state")
    .upsert({
      id: APP_STATE_ID,
      state: payload.state,
      updated_at: new Date().toISOString()
    })
    .select("updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    updatedAt: data.updated_at
  });
}
