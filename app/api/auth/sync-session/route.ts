import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: NextRequest) {
  try {
    const { access_token, refresh_token } = await req.json();
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
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return res;
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

