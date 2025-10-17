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
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
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
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/html/browse.html` }
      });
      if (error) throw error;
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

