(function(){
  const qs = (sel)=>document.querySelector(sel);
  const usernameEl = qs('#profileUsername');
  const emailEl = qs('#ud-email');
  const nameEl = qs('#ud-name');
  const phoneEl = qs('#ud-phone');
  const countryEl = qs('#ud-country');
  const devStatusEl = qs('#ud-devstatus');
  const devLink = qs('#developerLink');
  const adminReviewItem = qs('#adminReviewItem');
  const logoutLink = document.querySelector('.profile-item.logout');

  async function getPublicEnv(){ const r = await fetch('/api/public-env'); return r.json(); }
  async function getCountries(){ try{ const r = await fetch('/api/paises'); const j = await r.json(); return j.paises||[]; } catch { return []; } }

  function displayUser(user){
    const md = user?.user_metadata || {};
    const baseUser = (md.usuario || (user.email||'').split('@')[0] || '').toString().trim().toLowerCase();
    if (usernameEl) usernameEl.textContent = baseUser ? `@${baseUser}` : '@usuario';
    if (emailEl) emailEl.textContent = user.email || '—';
    if (nameEl) nameEl.textContent = md.nombre_completo || '—';
    if (phoneEl) phoneEl.textContent = md.telefono || '—';
  }

  async function displayCountry(md){
    const pid = md?.pais_id ? Number(md.pais_id) : null;
    if (!pid) { countryEl && (countryEl.textContent = '—'); return; }
    const list = await getCountries();
    const found = list.find(p=>Number(p.id)===pid);
    countryEl && (countryEl.textContent = found ? found.nombre : `ID ${pid}`);
  }

  async function displayDevStatus(client, uid){
    try{
      const { data } = await client
        .from('desarrolladores')
        .select('estado_verificacion')
        .eq('user_auth_id', uid)
        .maybeSingle();
      const state = data?.estado_verificacion || 'sin registro';
      if (devStatusEl) devStatusEl.textContent = state;

      // Si ya está verificado, podríamos mandar al panel en lugar del registro
      if (state === 'verificado') {
        devLink && (devLink.textContent = 'Ir al panel de desarrollador', devLink.setAttribute('href','./developer.html'));
      }
    } catch {
      if (devStatusEl) devStatusEl.textContent = '—';
    }
  }

  async function main(){
    try{
      const { url, key } = await getPublicEnv();
      if (!url || !key) throw new Error('Faltan variables públicas');
      const client = window.supabase.createClient(url, key);
      const { data: { user } } = await client.auth.getUser();
      if (!user){ window.location.href = '/html/login.html'; return; }

      displayUser(user);
      await displayCountry(user.user_metadata || {});
      await displayDevStatus(client, user.id);

      // Mostrar acceso admin si corresponde
      const role = String(user.app_metadata?.role || '').toLowerCase();
      if (role === 'admin' && adminReviewItem) {
        adminReviewItem.style.display = '';
        // Asegurar sincronización de sesión antes de ir a /admin
        const anchor = adminReviewItem.querySelector('a');
        if (anchor) {
          anchor.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
              const { data: { session } } = await client.auth.getSession();
              if (session?.access_token && session?.refresh_token) {
                await fetch('/api/auth/sync-session', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    access_token: session.access_token,
                    refresh_token: session.refresh_token,
                  }),
                });
              }
            } catch {}
            window.location.href = '/admin/developers';
          });
        }
      }
    } catch (e){
      // en caso de error, no romper la UI
      console.error(e);
    }
  }

  document.addEventListener('DOMContentLoaded', main);

  // Cerrar sesión: desloguea y redirige a login.html
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      if (!logoutLink) return;
      const env = await (await fetch('/api/public-env')).json();
      const client = window.supabase.createClient(env.url, env.key);
      logoutLink.addEventListener('click', async (e) => {
        e.preventDefault();
        try { await client.auth.signOut(); } catch {}
        // Opcional: limpiar cookie SSR estableciendo una sesión vacía
        try {
          const { data: { session } } = await client.auth.getSession();
          if (session?.access_token && session?.refresh_token) {
            await fetch('/api/auth/sync-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token })
            });
          }
        } catch {}
        window.location.href = '/html/login.html';
      });
    } catch {}
  });
})();
