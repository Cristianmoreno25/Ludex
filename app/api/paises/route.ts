import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("paises")
      .select("id, nombre, codigo")
      .order("nombre", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ paises: data ?? [] });
  } catch (e) {
    console.error(e);
    // Devuelve lista vacía para que el cliente pueda usar un fallback
    return NextResponse.json({ paises: [] }, { status: 200 });
  }
}

