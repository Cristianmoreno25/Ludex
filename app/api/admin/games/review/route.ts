import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function parseAdminWhitelist() {
  const raw = process.env.ADMIN_EMAILS || process.env.ADMIN_BOOTSTRAP_EMAIL || "";
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { juego_id, action, motivo } = body ?? {};
    if (!juego_id || !action) {
      return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
    }
    const approve = String(action).toLowerCase() === "approve";

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!url || !serviceKey) {
      return NextResponse.json({ error: "Faltan credenciales de Supabase" }, { status: 500 });
    }

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Autenticación del operador
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!auth) return NextResponse.json({ error: "Falta Authorization" }, { status: 401 });
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    const { data: me, error: meErr } = await admin.auth.getUser(token);
    if (meErr || !me?.user) return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    const operator = me.user;
    const isAdmin = String(operator.app_metadata?.role || "").toLowerCase() === "admin";
    const whitelist = parseAdminWhitelist();
    const isWhitelisted = operator.email ? whitelist.includes(operator.email.toLowerCase()) : false;
    if (!isAdmin && !isWhitelisted) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Obtener juego
    const { data: juegoRow, error: jErr } = await admin
      .from("juegos")
      .select("id, developer_auth_id, titulo, estado")
      .eq("id", Number(juego_id))
      .maybeSingle();
    if (jErr || !juegoRow) return NextResponse.json({ error: "Juego no encontrado" }, { status: 404 });

    if (approve) {
      const { error: upErr } = await admin
        .from("juegos")
        .update({ estado: "publicado" })
        .eq("id", juegoRow.id);
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
      await admin.from("notificaciones").insert({
        user_auth_id: juegoRow.developer_auth_id,
        tipo: "juego_publicado",
        data: { juego_id: juegoRow.id, titulo: juegoRow.titulo, motivo: motivo || null },
      });
    } else {
      const { error: upErr } = await admin
        .from("juegos")
        .update({ estado: "rechazado" })
        .eq("id", juegoRow.id);
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
      await admin.from("notificaciones").insert({
        user_auth_id: juegoRow.developer_auth_id,
        tipo: "juego_rechazado",
        data: { juego_id: juegoRow.id, titulo: juegoRow.titulo, motivo: motivo || null },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

