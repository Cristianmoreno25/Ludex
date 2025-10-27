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
    const { email, user_id, role } = await req.json();

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!url || !serviceKey) {
      return NextResponse.json({ error: "Faltan credenciales de Supabase" }, { status: 500 });
    }

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1) Autenticación del operador (quien hace la promoción)
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!auth) return NextResponse.json({ error: "Falta Authorization" }, { status: 401 });
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    const { data: me, error: meErr } = await admin.auth.getUser(token);
    if (meErr || !me?.user) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const operator = me.user;
    const isAdmin = String(operator.app_metadata?.role || "").toLowerCase() === "admin";
    const whitelist = parseAdminWhitelist();
    const isWhitelisted = operator.email ? whitelist.includes(operator.email.toLowerCase()) : false;
    if (!isAdmin && !isWhitelisted) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // 2) Resolver usuario objetivo
    let targetId: string | null = null;
    if (user_id) {
      targetId = String(user_id);
    } else if (email) {
      // Buscar por email usando Admin API (paginado simple)
      let page = 1;
      const perPage = 200;
      const targetEmail = String(email).toLowerCase();
      while (page <= 10 && !targetId) {
        // @ts-ignore: admin listUsers exists in supabase-js v2
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        const found = data.users?.find((u: any) => (u.email || "").toLowerCase() === targetEmail);
        if (found) targetId = found.id;
        if (!data?.users?.length) break;
        page++;
      }
      if (!targetId) {
        return NextResponse.json({ error: "Usuario no encontrado por email" }, { status: 404 });
      }
    } else {
      return NextResponse.json({ error: "Debe enviar email o user_id" }, { status: 400 });
    }

    // 3) Promover a admin (o remover si role !== 'admin')
    const setRole = (String(role || "admin").toLowerCase() === "admin") ? "admin" : null;
    // @ts-ignore: admin updateUserById exists in supabase-js v2
    const { data: upd, error: updErr } = await admin.auth.admin.updateUserById(targetId, {
      app_metadata: { role: setRole || undefined },
    });
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

    return NextResponse.json({ ok: true, user_id: targetId, role: setRole || null });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

