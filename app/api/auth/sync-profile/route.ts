import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// POST /api/auth/sync-profile
// Body: { access_token: string }
export async function POST(req: NextRequest) {
  try {
    const { access_token } = await req.json();
    if (!access_token) {
      return NextResponse.json({ error: "Falta access_token" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: "Faltan credenciales de Supabase (server role)" },
        { status: 500 },
      );
    }

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Get user from the access token issued by Supabase
    const {
      data: { user },
      error: getUserError,
    } = await admin.auth.getUser(access_token);
    if (getUserError || !user) {
      return NextResponse.json(
        { error: getUserError?.message || "No se pudo obtener el usuario" },
        { status: 400 },
      );
    }

    const email = user.email ?? "";
    const md: any = user.user_metadata ?? {};

    const base = (md.usuario || (email.split("@")[0] ?? "")).toString().trim().toLowerCase();
    let usuario = base || `user_${user.id.slice(0, 8)}`;

    const payload: any = {
      usuario,
      correo_electronico: email,
      hash_contrasena: "auth_managed", // Supabase Auth stores password hashes internally
      nombre_completo: md.nombre_completo ?? null,
      telefono: md.telefono ?? null,
      fecha_nacimiento: md.fecha_nacimiento ?? null,
      pais_id: md.pais_id ? Number(md.pais_id) : null,
      acepto_terminos: md.acepto_terminos ? true : true,
    };

    // Validate foreign key: if provided pais_id does not exist, set to null to avoid FK error
    if (payload.pais_id !== null && payload.pais_id !== undefined) {
      const { data: paisRow, error: paisErr } = await admin
        .from("paises")
        .select("id")
        .eq("id", payload.pais_id)
        .limit(1)
        .maybeSingle();
      if (paisErr || !paisRow) {
        payload.pais_id = null;
      }
    }

    // Try upsert by unique correo_electronico
    let { error: upsertErr } = await admin
      .from("usuarios")
      .upsert([payload], { onConflict: "correo_electronico" });

    // If username is already taken, generate a unique one and try again
    if (upsertErr && /usuario/i.test(upsertErr.message)) {
      usuario = `${base || "user"}-${user.id.slice(0, 6)}`;
      payload.usuario = usuario;
      ({ error: upsertErr } = await admin
        .from("usuarios")
        .upsert([payload], { onConflict: "correo_electronico" }));
    }

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 400 });
    }

    return NextResponse.json({ message: "Perfil sincronizado", usuario });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
