import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, nombre_completo, telefono, pais_id } = body ?? {};
    if (!username) return NextResponse.json({ error: "Falta username" }, { status: 400 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!url || !serviceKey) return NextResponse.json({ error: "Faltan credenciales" }, { status: 500 });

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    // Necesitamos saber el email del usuario autenticado (vendrá en Authorization Bearer token)
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!auth) return NextResponse.json({ error: "Falta Authorization" }, { status: 401 });
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user || !user.email) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    // Validar FK de país
    let resolvedPais: number | null = null;
    if (pais_id !== undefined && pais_id !== null && pais_id !== "") {
      const pid = Number(pais_id);
      if (!Number.isNaN(pid)) {
        const { data: ok } = await admin.from("paises").select("id").eq("id", pid).maybeSingle();
        if (ok) resolvedPais = pid; // si no existe, se queda en null
      }
    }

    // Intentar update; si username choca, añadimos sufijo con user.id corto
    const patch: any = {
      usuario: String(username).trim().toLowerCase(),
      nombre_completo: nombre_completo ?? null,
      telefono: telefono ?? null,
      pais_id: resolvedPais,
    };

    // Intentar update; si no existe la fila, haremos upsert (crear)
    const { data: checkRow } = await admin
      .from("usuarios")
      .select("correo_electronico")
      .eq("correo_electronico", user.email)
      .maybeSingle();

    if (checkRow) {
      // Update existente
      let { error: updErr } = await admin
        .from("usuarios")
        .update(patch)
        .eq("correo_electronico", user.email);

      if (updErr && /usuario/i.test(updErr.message)) {
        patch.usuario = `${patch.usuario}-${user.id.slice(0,6)}`;
        ({ error: updErr } = await admin
          .from("usuarios")
          .update(patch)
          .eq("correo_electronico", user.email));
      }
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });
    } else {
      // Crear fila nueva (upsert por correo)
      const createPayload: any = {
        usuario: String(patch.usuario).trim().toLowerCase(),
        correo_electronico: user.email,
        hash_contrasena: "auth_managed",
        nombre_completo: patch.nombre_completo ?? null,
        telefono: patch.telefono ?? null,
        pais_id: patch.pais_id ?? null,
        acepto_terminos: true,
      };
      let { error: insErr } = await admin
        .from("usuarios")
        .upsert([createPayload], { onConflict: "correo_electronico" });
      if (insErr && /usuario/i.test(insErr.message)) {
        createPayload.usuario = `${createPayload.usuario}-${user.id.slice(0,6)}`;
        ({ error: insErr } = await admin
          .from("usuarios")
          .upsert([createPayload], { onConflict: "correo_electronico" }));
      }
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    return NextResponse.json({ message: "Perfil actualizado", usuario: patch.usuario });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

