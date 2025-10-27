// middleware.ts
import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return updateSession(request); // refresca sesión, no redirige por sí solo
}

// 👇 SOLO protege /protected/**
export const config = {
  matcher: ["/protected/:path*", "/admin/:path*"],
};
