// app/api/notifications/lista-deseos-descuentos/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user ?? null;
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: lista, error: lErr } = await supabase
    .from('lista_deseos')
    .select('juego_id, juegos ( id, titulo, precio, precio_descuento, estado )')
    .eq('user_auth_id', user.id);

  if (lErr) return NextResponse.json({ error: lErr }, { status: 500 });

  const created: any[] = [];

  for (const item of lista ?? []) {
    const juego = (item as any).juegos ?? null;
    if (!juego) continue;

    const regular = Number(juego.precio ?? 0);
    const discount = Number(juego.precio_descuento ?? 0);

    if (discount > 0 && discount < regular && juego.estado === 'publicado') {
      const titulo = juego.titulo ?? `Juego ${juego.id}`;
      const mensaje = `¡${titulo} tiene descuento! Antes ${regular} — ahora ${discount}`;

      const { error: nErr } = await supabase.from('notificaciones').insert([{
        user_auth_id: user.id,
        tipo: 'descuento',
        data: { juego_id: juego.id, titulo, precio_anterior: regular, precio_nuevo: discount },
        leida: false,
        creado_en: new Date().toISOString(),
      }]);

      if (!nErr) created.push({ juego: titulo, mensaje });
    }
  }

  return NextResponse.json({ ok: true, created_count: created.length, created });
}
