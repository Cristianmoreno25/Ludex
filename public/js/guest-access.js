(function(){
  function wire(id){
    const btn = document.getElementById(id);
    if (!btn) return;
    const anchor = btn.querySelector('a');
    const dest = (anchor ? anchor.getAttribute('href') : '/html/browse.html') || '/html/browse.html';
    const navigate = () => { window.location.href = dest.includes('?') ? dest + '&guest=1' : dest + '?guest=1'; };
    const handler = async (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      try{
        const envRes = await fetch('/api/public-env');
        const env = await envRes.json();
        if (!env?.url || !env?.key) { navigate(); return; }
        const client = window.supabase.createClient(env.url, env.key);
        // Si existe sesión, cerrar
        const { data: { session } } = await client.auth.getSession();
        if (session) {
          try { await client.auth.signOut(); } catch {}
          // limpiar cookies SSR en el backend
          try { await fetch('/api/auth/signout', { method: 'POST' }); } catch {}
        }
      } catch {}
      // pequeña espera para asegurar limpieza
      setTimeout(navigate, 100);
    };
    // click tanto en el botón como en el <a>
    btn.addEventListener('click', handler, { capture: true });
    if (anchor) anchor.addEventListener('click', handler, { capture: true });
  }

  document.addEventListener('DOMContentLoaded', function(){
    wire('accessBtn');
    wire('accessBtn-mobile');
    wire('accessBtn2');
    wire('accessBtn-login');
  });
})();
