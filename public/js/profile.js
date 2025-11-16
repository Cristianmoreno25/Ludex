(function(){
  const qs = (sel)=>document.querySelector(sel);
  const usernameEl = qs('#profileUsername');
  const avatarEl = qs('#profileAvatar');
  const roleEl = qs('#profileRole');
  const devStatusEl = qs('#ud-devstatus');
  const devLink = qs('#developerLink');
  const adminReviewItem = qs('#adminReviewItem');
  const logoutLink = document.querySelector('.profile-item.logout');
  const profileMain = qs('main.profile-page');
  const loadingView = qs('#profileLoading');

  async function getPublicEnv(){ const r = await fetch('/api/public-env'); return r.json(); }

  async function fetchProfileRow(client, email) {
    try {
      const { data } = await client
        .from('usuarios')
        .select('usuario, avatar_path')
        .eq('correo_electronico', email)
        .maybeSingle();
      return data || null;
    } catch (e) {
      console.log('No se pudo obtener perfil extendido:', e);
      return null;
    }
  }

  function displayUser(user, profileRow, baseUrl){
    const md = user?.user_metadata || {};
    const baseUser = (profileRow?.usuario || md.usuario || (user.email||'').split('@')[0] || '').toString().trim().toLowerCase();
    if (usernameEl) usernameEl.textContent = baseUser ? `@${baseUser}` : '@usuario';
    let avatarUrl = null;
    if (profileRow?.avatar_path) {
      avatarUrl = `${baseUrl}/storage/v1/object/public/avatars/${encodeURIComponent(profileRow.avatar_path)}`;
    } else if (md.avatar_url) {
      avatarUrl = md.avatar_url;
    } else if (md.avatar_path) {
      avatarUrl = `${baseUrl}/storage/v1/object/public/avatars/${encodeURIComponent(md.avatar_path)}`;
    } else {
      avatarUrl = md.picture || md.avatar || null;
    }
    if (avatarEl) {
      if (avatarUrl) {
        const img = document.createElement('img');
        img.src = avatarUrl;
        img.alt = 'Avatar del usuario';
        avatarEl.innerHTML = '';
        avatarEl.appendChild(img);
      } else {
        avatarEl.textContent = baseUser ? baseUser.charAt(0).toUpperCase() : 'U';
      }
    }
    try {
      sessionStorage.setItem('lx_display_name', baseUser || 'usuario');
      if (avatarUrl) sessionStorage.setItem('lx_avatar_url', avatarUrl);
      else sessionStorage.removeItem('lx_avatar_url');
    } catch(_){}
    if (roleEl) {
      const role = String(user.app_metadata?.role || 'cliente');
      roleEl.textContent = role.charAt(0).toUpperCase() + role.slice(1);
    }
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
      revealProfile(state);
    } catch {
      if (devStatusEl) devStatusEl.textContent = '—';
      revealProfile('sin registro');
    }
  }

  function revealProfile(state){
    if (profileMain) profileMain.hidden = false;
    if (loadingView) loadingView.hidden = true;
    // state string used for other UI updates later if needed
  }

  async function main(){
    try{
      const { url, key } = await getPublicEnv();
      if (!url || !key) throw new Error('Faltan variables públicas');
      const client = window.supabase.createClient(url, key);
      const { data: { user } } = await client.auth.getUser();
      if (!user){ window.location.href = '/html/login.html'; return; }

      const profileRow = await fetchProfileRow(client, user.email);
      displayUser(user, profileRow, url);
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
                // después
                await fetch('/api/auth/sync-session', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token })
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
