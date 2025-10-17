import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const { identity } = await req.json();
    if (!identity || typeof identity !== "string") {
      return NextResponse.json({ error: "Falta identity" }, { status: 400 });
    }

    const trimmed = identity.trim();
    if (trimmed.includes("@")) {
      return NextResponse.json({ email: trimmed });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!url || !serviceKey) {
      return NextResponse.json({ error: "Faltan credenciales" }, { status: 500 });
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await admin
      .from("usuarios")
      .select("correo_electronico")
      .eq("usuario", trimmed)
      .limit(1)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data?.correo_electronico) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    return NextResponse.json({ email: data.correo_electronico });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

