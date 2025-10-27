// utils/supabase/syncSession.ts
// Función genérica que intenta sincronizar la sesión del cliente (navegador)
// con el endpoint server /api/auth/sync-session (que ya tienes).
//
// Uso:
//   import { syncSessionToServer } from '@/utils/supabase/syncSession';
//   syncSessionToServer();               // intenta usar window.supabaseClient u otras fuentes
//   OR
//   syncSessionToServer(mySupabaseClient); // pasa explícitamente tu instancia de supabase-js

export async function syncSessionToServer(supabaseClient?: any): Promise<boolean> {
  try {
    // 1) Priorizar el cliente pasado como argumento
    const client = supabaseClient ?? (typeof window !== 'undefined' ? (window as any).supabaseClient ?? (window as any).supabase ?? null : null);

    // 2) Si hay cliente supabase-js, usar su API para obtener la sesión
    if (client && typeof client.auth?.getSession === 'function') {
      const { data } = await client.auth.getSession();
      const session = data?.session ?? null;
      if (!session) return false;

      const payload = {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      };

      const res = await fetch('/api/auth/sync-session', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      return res.ok;
    }

    // 3) Si NO hay cliente disponible, intentar detectar tokens en el hash de la URL
    if (typeof window !== 'undefined') {
      const hash = window.location.hash?.replace(/^#/, '');
      if (hash) {
        const params = new URLSearchParams(hash);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (access_token && refresh_token) {
          const res = await fetch('/api/auth/sync-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ access_token, refresh_token })
          });
          // limpiar hash para no exponer tokens
          try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch {}
          return res.ok;
        }
      }
    }

    // Nada que sincronizar
    return false;
  } catch (err) {
    console.error('syncSessionToServer error', err);
    return false;
  }
}
