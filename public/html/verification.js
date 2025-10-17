(() => {
  const statusBox = document.getElementById('status');
  const verifyBtn = document.getElementById('verifyBtn');
  const resendBtn = document.getElementById('resendBtn');

  function setStatus(text, kind = 'info') {
    if (!statusBox) return;
    statusBox.textContent = text;
    statusBox.style.color = kind === 'error' ? '#ef4444' : '#9ca3af';
  }

  function parseHash() {
    const raw = window.location.hash || '';
    const hash = raw.startsWith('#') ? raw.slice(1) : raw;
    const qs = new URLSearchParams(hash);
    return {
      access_token: qs.get('access_token'),
      refresh_token: qs.get('refresh_token'),
      type: qs.get('type'),
    };
  }

  async function getPublicEnv() {
    const r = await fetch('/api/public-env');
    return r.json();
  }

  async function verifyAndSync() {
    try {
      if (verifyBtn) { verifyBtn.disabled = true; verifyBtn.textContent = 'Verificando...'; }
      setStatus('Procesando verificacion...');

      const { url, key } = await getPublicEnv();
      if (!url || !key) throw new Error('Faltan variables públicas de Supabase');
      const client = window.supabase.createClient(url, key);

      // Prefer tokens from hash; fall back to sessionStorage if user clicks de nuevo
      let { access_token, refresh_token } = parseHash();
      if (!access_token || !refresh_token) {
        try {
          const saved = sessionStorage.getItem('verify_tokens');
          if (saved) {
            const t = JSON.parse(saved);
            access_token = t.access_token;
            refresh_token = t.refresh_token;
          }
        } catch (_) {}
      }
      if (!access_token || !refresh_token) {
        throw new Error('El enlace no incluye los tokens de acceso. Abre el link desde tu correo.');
      }

      const { error: sessErr } = await client.auth.setSession({ access_token, refresh_token });
      if (sessErr) throw sessErr;

      const sync = await fetch('/api/auth/sync-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token }),
      });
      if (!sync.ok) {
        const j = await sync.json().catch(() => ({}));
        throw new Error(j.error || 'No se pudo sincronizar el perfil');
      }

      setStatus('Cuenta verificada y perfil creado. Redirigiendo...');
      setTimeout(() => { window.location.href = '/html/verification.html'; }, 1200);
    } catch (e) {
      console.error(e);
      setStatus(e.message || 'Error durante la verificacion', 'error');
      if (verifyBtn) { verifyBtn.disabled = false; verifyBtn.textContent = 'Verificar'; }
    }
  }

  if (verifyBtn) verifyBtn.addEventListener('click', verifyAndSync);
  if (resendBtn) resendBtn.addEventListener('click', async () => {
    try {
      const emailParam = new URLSearchParams(window.location.search).get('email');
      if (!emailParam) { setStatus('No se pudo reenviar: falta email en la URL.', 'error'); return; }
      const { url, key } = await getPublicEnv();
      const client = window.supabase.createClient(url, key);
      const emailRedirectTo = `${window.location.origin}/html/verification.html`;
      await client.auth.resend({ type: 'signup', email: emailParam, options: { emailRedirectTo } });
      setStatus('Enlace reenviado. Revisa tu correo.');
    } catch (e) {
      setStatus('No se pudo reenviar el enlace.', 'error');
    }
  });

  // Auto-verify if tokens are present in the URL hash
  const tokens = parseHash();
  if (tokens.access_token && tokens.refresh_token) {
    try { sessionStorage.setItem('verify_tokens', JSON.stringify(tokens)); } catch (_) {}
    setStatus('Detectamos el enlace de verificacion. Verificando...');
    // Ejecutar automaticamente la verificacion para evitar dobles clics
    verifyAndSync();
  } else {
    setStatus('Abre este enlace desde el correo de verificacion.');
  }
})();
