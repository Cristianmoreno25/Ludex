import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import path from "path";

let cachedSubmenuHtml: string | null = null;

async function loadSubmenuHtml() {
  if (cachedSubmenuHtml) return cachedSubmenuHtml;
  try {
    const filePath = path.join(process.cwd(), "public", "html", "submenu.html");
    cachedSubmenuHtml = await fs.readFile(filePath, "utf8");
  } catch (err) {
    console.warn("[submenu-state] No se pudo leer submenu.html:", err);
    cachedSubmenuHtml = null;
  }
  return cachedSubmenuHtml;
}

export async function POST(req: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json({ error: "Missing Supabase env" }, { status: 500 });
    }

    const { access_token: accessToken } = await req.json().catch(() => ({}));
    if (!accessToken) {
      return NextResponse.json({ error: "Missing access_token" }, { status: 400 });
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userRes, error: userErr } = await admin.auth.getUser(accessToken);
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: "Invalid access token" }, { status: 401 });
    }

    const user = userRes.user;
    const email = user.email;

  let profile:
    | {
        usuario: string | null;
        nombre_completo: string | null;
        avatar_path: string | null;
      }
    | null = null;
    if (email) {
      const { data, error } = await admin
        .from("usuarios")
        .select("usuario, nombre_completo, avatar_path")
        .eq("correo_electronico", email)
        .maybeSingle();
      if (!error && data) profile = data;
    }

  const displayName =
    profile?.usuario ||
    profile?.nombre_completo ||
      (user.user_metadata?.usuario as string) ||
      (user.user_metadata?.nombre_completo as string) ||
      (email ? email.split("@")[0] : "Usuario");

    const avatarPath =
      profile?.avatar_path ||
      (user.user_metadata?.avatar_path as string | undefined) ||
      (user.user_metadata?.avatar_url as string | undefined) ||
      null;

    let avatarUrl: string | null = null;
    if (avatarPath) {
      avatarUrl = avatarPath.startsWith("http")
        ? avatarPath
        : `${url}/storage/v1/object/public/avatars/${encodeURIComponent(avatarPath)}`;
    }

  const needsCompletion = !profile;
  const submenuHtml = await loadSubmenuHtml();

    return NextResponse.json({
      displayName,
      avatarUrl,
      needsCompletion,
      submenuHtml,
    });
  } catch (err) {
    console.error("[submenu-state] error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
