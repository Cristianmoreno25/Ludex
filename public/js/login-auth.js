// Handles login (email or username + password) and Google OAuth
(function(){
  const qs = (id) => document.getElementById(id);
  async function getEnv(){ const r = await fetch('/api/public-env'); return r.json(); }

  function showMessage(text, type='error'){
    const box = qs('loginMessage');
    if (!box) { alert(text); return; }
    const cls = type === 'error' ? 'msg error' : 'msg info';
    box.innerHTML = `<div class="${cls}">${text}</div>`;
  }

  function mapAuthError(msg){
    const m = String(msg || '').toLowerCase();
    if (m.includes('invalid login credentials')) return 'Credenciales inválidas.';
    if (m.includes('email not confirmed') || m.includes('not confirmed')) return 'Debes confirmar tu correo electrónico.';
    return msg || 'Error al iniciar sesión';
  }

  async function primeSubmenuSnapshot(accessToken){
    if (!accessToken) return;
    const helper = window.LudexSubmenuCache?.prime;
    if (typeof helper !== 'function') return;
    try {
      await helper(accessToken);
    } catch (_){}
  }

  async function resolveIdentity(identity){
    const v = String(identity || '').trim();
    if (v.includes('@')) return v; // email
    const r = await fetch('/api/auth/resolve-identity', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: v })
    });
    const j = await r.json().catch(()=>({}));
    if (!r.ok) throw new Error(j.error || 'Usuario no encontrado');
    return j.email;
  }

  async function loginPassword(e){
    e.preventDefault();
    const identity = qs('identity')?.value || '';
    const password = qs('password')?.value || '';
    if (!identity.trim() || !password) { showMessage('Completa correo/usuario y contraseña.'); return; }

    const btn = qs('signInBtn');
    try {
      btn && (btn.disabled = true, btn.textContent = 'Ingresando...');
      showMessage('', 'info');
      const email = await resolveIdentity(identity);
      const { url, key } = await getEnv();
      const client = window.supabase.createClient(url, key);
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      try {
        const u = data?.user || (await client.auth.getUser()).data.user;
        if (u) {
          const md = u.user_metadata || {};
          const display = md.usuario || md.nombre_completo || (u.email ? u.email.split('@')[0] : 'Usuario');
          sessionStorage.setItem('lx_display_name', String(display));
          sessionStorage.setItem('lx_is_logged', '1');
          sessionStorage.setItem('lx_last_provider', 'password');
        }
      } catch {}
      // Sincronizar sesión a cookies para SSR/middleware
      let cachedSession = null;
      try {
        const { data: { session } } = await client.auth.getSession();
        if (session?.access_token && session?.refresh_token) {
          cachedSession = session;
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
      if (cachedSession?.access_token) {
        await primeSubmenuSnapshot(cachedSession.access_token);
      }
      window.location.href = '/html/browse.html';
    } catch (err) {
      console.error(err);
      showMessage(mapAuthError(err?.message));
    } finally {
      btn && (btn.disabled = false, btn.textContent = 'Iniciar sesión');
    }
  }

  async function loginGoogle(){
    try {
      const { url, key } = await getEnv();
      const client = window.supabase.createClient(url, key);
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        // Usamos la misma ruta de verificación para centralizar el flujo
        // Allí se hace setSession + sync-profile y si el proveedor es Google
        // se redirige a complete-profile.html
        options: { redirectTo: `${window.location.origin}/html/verification.html` }
      });
      if (error) throw error;
      
      // Para Google OAuth, la información se guardará en el callback
      // que se maneja en browse.html o donde se procese el redirect
    } catch (err) {
      console.error(err); showMessage('No se pudo iniciar con Google');
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    const form = qs('loginForm');
    form && form.addEventListener('submit', loginPassword);
    const g = qs('socialGoogle'); g && g.addEventListener('click', loginGoogle);
    const f = qs('socialFacebook'); f && f.addEventListener('click', ()=> showMessage('Facebook no está configurado.', 'info'));
  });
})();

