// app/api/lista-deseos/route.ts  (sólo substituir la parte GET)
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const GAME_IMAGES_BUCKET = 'game-images'; // ajusta si tu bucket tiene otro nombre

export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user ?? null;
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // 1) Traer wishlist con datos básicos del juego
  const { data: wishlistRaw, error: wErr } = await supabase
    .from('lista_deseos')
    .select('id, user_auth_id, juego_id, creado_en, juegos ( id, titulo, slug, precio, precio_descuento, estado )')
    .eq('user_auth_id', user.id);

  if (wErr) {
    return NextResponse.json({ error: wErr }, { status: 500 });
  }

  const lista = wishlistRaw ?? [];
  const juegoIds = Array.from(new Set(lista.map((r: any) => r.juego_id).filter(Boolean)));

  // 2) Traer archivos para esos juegos (una sola query)
  let archivosMap: Record<number, any[]> = {};
  if (juegoIds.length > 0) {
    const { data: files, error: fErr } = await supabase
      .from('juego_archivos')
      .select('id, juego_id, tipo, storage_path, creado_en')
      .in('juego_id', juegoIds)
      .order('creado_en', { ascending: false });

    if (!fErr && files) {
      archivosMap = files.reduce((acc: any, f: any) => {
        acc[f.juego_id] = acc[f.juego_id] || [];
        acc[f.juego_id].push(f);
        return acc;
      }, {});
    }
  }

  // 3) Construir portada_url (si tenemos storage_path). Asumimos bucket público.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '') ?? '';
  const result = lista.map((row: any) => {
    const juego = row.juegos ?? {};
    const files = archivosMap[row.juego_id] ?? [];
    // preferir tipo 'otro' o el primer archivo
    const coverFile = files.find((f: any) => f.tipo === 'otro') ?? files[0];
    let portada_url = null;
    if (coverFile?.storage_path) {
      // URL pública estándar: {SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}
      portada_url = `${supabaseUrl}/storage/v1/object/public/${GAME_IMAGES_BUCKET}/${encodeURIComponent(coverFile.storage_path)}`;
    }
    return {
      ...row,
      juegos: {
        ...juego,
        portada_url,
      },
    };
  });

  return NextResponse.json({ wishlist: result });
}


export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const juegoId = body?.juegoId ?? body?.juego_id ?? null;
  if (!juegoId) return NextResponse.json({ error: 'Missing juegoId' }, { status: 400 });

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user ?? null;
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const payload = { user_auth_id: user.id, juego_id: Number(juegoId) };

  const { error } = await supabase.from('lista_deseos').insert([payload]).select();

  if (error) {
    const msg = (error as any)?.message ?? JSON.stringify(error);
    if (msg?.toString().toLowerCase().includes('duplicate') || msg?.toString().includes('23505')) {
      return NextResponse.json({ ok: true, message: 'Already in wishlist' });
    }
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: 'Añadido a la lista de deseos' });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  let juegoId = url.searchParams.get('juegoId');

  if (!juegoId) {
    const b = await request.json().catch(() => ({}));
    juegoId = b?.juegoId ?? b?.juego_id;
  }
  if (!juegoId) return NextResponse.json({ error: 'Missing juegoId' }, { status: 400 });

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user ?? null;
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Buscar y borrar la fila que corresponde a este usuario y juego
  const { data: rows, error: selectErr } = await supabase
    .from('lista_deseos')
    .select('id')
    .eq('user_auth_id', user.id)
    .eq('juego_id', Number(juegoId))
    .limit(1);

  if (selectErr) return NextResponse.json({ error: selectErr }, { status: 500 });
  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: false, message: 'Not found in wishlist' }, { status: 404 });
  }

  const rowId = rows[0].id;
  const { error: deleteErr } = await supabase.from('lista_deseos').delete().eq('id', rowId);
  if (deleteErr) return NextResponse.json({ error: deleteErr }, { status: 500 });

  return NextResponse.json({ ok: true, message: 'Eliminado de la lista de deseos' });
}
