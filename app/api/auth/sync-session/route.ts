import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: NextRequest) {
  try {
    let access_token: string | null = null;
    let refresh_token: string | null = null;

    // 1. Intentar obtener tokens del body (login normal)
    try {
      const body = await req.json();
      access_token = body.access_token ?? null;
      refresh_token = body.refresh_token ?? null;
    } catch (_) {
      // Ignorar si no es JSON
    }

    // 2. Si no hay tokens, intentar obtenerlos del hash de OAuth redirect
    const url = new URL(req.url);
    const hash = url.hash?.replace("#", "");
    if ((!access_token || !refresh_token) && hash) {
      const params = new URLSearchParams(hash);
      access_token = params.get("access_token");
      refresh_token = params.get("refresh_token");
    }

    if (!access_token || !refresh_token) {
      return NextResponse.json({ error: "Faltan tokens" }, { status: 400 });
    }

    let res = NextResponse.json({ ok: true });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              res.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return res;

  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

