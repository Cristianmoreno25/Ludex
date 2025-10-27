import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Returns whether the authenticated user still needs to complete profile
// Logic: if there is no row in public.usuarios for their email OR 'usuario' is null/empty -> needs = true
export async function GET(req: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!url || !serviceKey) {
      return NextResponse.json({ error: "Missing Supabase env" }, { status: 500 });
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!auth) return NextResponse.json({ error: "Missing Authorization" }, { status: 401 });
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    const { data: me, error: meErr } = await admin.auth.getUser(token);
    if (meErr || !me?.user?.email) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const email = me.user.email;
    const { data: row, error } = await admin
      .from("usuarios")
      .select("correo_electronico, usuario")
      .eq("correo_electronico", email)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Necesita completar si NO existe fila en usuarios
    const needs = !row;
    return NextResponse.json({ needs });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
