'use client';

import { useEffect } from 'react';
import { syncSessionToServer } from '@/utils/supabase/syncSession';

/**
 * Componente cliente mínimo que sincroniza la sesión del navegador
 * con el endpoint server /api/auth/sync-session.
 *
 * Lo dejamos como componente independiente para mantener app/layout.tsx
 * como Server Component (puede seguir exportando `metadata`).
 */
export default function SessionSyncClient() {
  useEffect(() => {
    // Llamada silenciosa; errores se registran en consola
    syncSessionToServer().catch((err) => {
      // No hacemos nada disruptivo en UI; solo logueamos para debug
      console.error('syncSessionToServer error:', err);
    });
  }, []);

  return null; // no renderiza nada visible
}
