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
    const { user_auth_id, action, motivo } = body ?? {};
    if (!user_auth_id || !action) {
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

    // 1) Autenticación del operador
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

    // 2) Aplicar acción
    if (approve) {
      // Estado verificado
      const { error: upDevErr } = await admin
        .from("desarrolladores")
        .update({ estado_verificacion: "verificado", actualizado_en: new Date().toISOString() })
        .eq("user_auth_id", user_auth_id);
      if (upDevErr) return NextResponse.json({ error: upDevErr.message }, { status: 400 });

      // Obtener email de ese user para actualizar rol en 'usuarios'
      // @ts-ignore: admin getUserById exists in supabase-js v2
      const { data: target, error: getTargetErr } = await admin.auth.admin.getUserById(user_auth_id);
      if (getTargetErr) return NextResponse.json({ error: getTargetErr.message }, { status: 400 });
      const email = target?.user?.email;
      if (email) {
        const { error: upUserErr } = await admin
          .from("usuarios")
          .update({ rol: "desarrollador", actualizado_en: new Date().toISOString() })
          .eq("correo_electronico", email);
        if (upUserErr) return NextResponse.json({ error: upUserErr.message }, { status: 400 });
      }

      // Notificación opcional
      await admin.from("notificaciones").insert({
        user_auth_id,
        tipo: "dev_verificacion",
        data: { estado: "verificado", motivo: motivo || null },
      });
    } else {
      // Rechazado
      const { error: upDevErr } = await admin
        .from("desarrolladores")
        .update({ estado_verificacion: "rechazado", actualizado_en: new Date().toISOString() })
        .eq("user_auth_id", user_auth_id);
      if (upDevErr) return NextResponse.json({ error: upDevErr.message }, { status: 400 });
      await admin.from("notificaciones").insert({
        user_auth_id,
        tipo: "dev_verificacion",
        data: { estado: "rechazado", motivo: motivo || null },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

