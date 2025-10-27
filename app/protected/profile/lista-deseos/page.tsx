// app/protected/profile/lista-deseos/page.tsx
import React from 'react';
import { createClient } from '@/lib/supabase/server';
import StarButton from '../../../../components/wishlist/StarButton';

export default async function ListaDeseosPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user ?? null;
  if (!user) return <div>Necesitas iniciar sesión.</div>;

  const { data: lista, error } = await supabase
    .from('lista_deseos')
    .select('id, juego_id, creado_en, juegos ( id, titulo, precio, precio_descuento, estado )')
    .eq('user_auth_id', user.id);

  if (error) {
    console.error('Error fetching wishlist', error);
    return <div>Error cargando tu lista de deseos.</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Mi lista de deseos</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {lista && lista.length > 0 ? (
          lista.map((row: any) => {
            const juego = row.juegos ?? null;
            const title = juego?.titulo ?? `Juego #${row.juego_id}`;
            // No hay campo de portada en 'juegos' por defecto: usaremos placeholder
            const image = '/placeholder-game.png';
            const regular = Number(juego?.precio ?? 0);
            const discount = Number(juego?.precio_descuento ?? 0);

            return (
              <div key={row.id} className="rounded-lg border p-4 flex items-center">
                <img src={image} alt={title} className="w-28 h-20 object-cover rounded-md mr-4" />
                <div className="flex-1">
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-sm">
                    {discount > 0 && discount < regular ? (
                      <span className="text-red-600">En oferta: {discount} <span className="line-through ml-2 text-gray-400">{regular}</span></span>
                    ) : <span>${regular}</span>}
                  </p>
                </div>
                <div className="ml-4">
                  <StarButton juegoId={juego?.id ?? row.juego_id} initial={true} />
                </div>
              </div>
            );
          })
        ) : (
          <p>No tienes juegos en tu lista de deseos.</p>
        )}
      </div>
    </div>
  );
}
