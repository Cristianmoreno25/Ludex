(function(){
  const CACHE_KEY = 'lx_submenu_html_v2';
  const CACHE_TS = 'lx_submenu_html_v2_ts';
  const SNAPSHOT_TS_KEY = 'lx_submenu_snapshot_ts';
  const NEEDS_KEY = 'lx_needs_completion';
  const PROVIDER_KEY = 'lx_last_provider';
  const FORCE_KEY = 'lx_force_completion';

  async function primeSubmenuState(accessToken) {
    if (!accessToken) return;
    try {
      const res = await fetch('/api/auth/submenu-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken })
      });
      if (!res.ok) {
        console.debug('[submenu-cache] no se pudo obtener snapshot del submenu');
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data?.displayName) {
        sessionStorage.setItem('lx_display_name', String(data.displayName));
      }
      sessionStorage.setItem('lx_is_logged', '1');
      if (data?.avatarUrl) {
        sessionStorage.setItem('lx_avatar_url', String(data.avatarUrl));
      } else {
        sessionStorage.removeItem('lx_avatar_url');
      }
      if (data?.submenuHtml) {
        sessionStorage.setItem(CACHE_KEY, data.submenuHtml);
        sessionStorage.setItem(CACHE_TS, String(Date.now()));
      }
      if (typeof data?.needsCompletion === 'boolean') {
        sessionStorage.setItem(NEEDS_KEY, data.needsCompletion ? '1' : '0');
        sessionStorage.setItem(FORCE_KEY, data.needsCompletion ? '1' : '0');
      }
      sessionStorage.setItem(SNAPSHOT_TS_KEY, String(Date.now()));
    } catch (err) {
      console.debug('[submenu-cache] fallo al guardar snapshot:', err?.message || err);
    }
  }

  function clearSubmenuState() {
    try {
      sessionStorage.removeItem(CACHE_KEY);
      sessionStorage.removeItem(CACHE_TS);
      sessionStorage.removeItem('lx_display_name');
      sessionStorage.removeItem('lx_is_logged');
      sessionStorage.removeItem('lx_avatar_url');
      sessionStorage.removeItem(SNAPSHOT_TS_KEY);
      sessionStorage.removeItem(NEEDS_KEY);
      sessionStorage.removeItem(PROVIDER_KEY);
      sessionStorage.removeItem(FORCE_KEY);
    } catch (_){}
  }

  window.LudexSubmenuCache = {
    prime: primeSubmenuState,
    clear: clearSubmenuState,
  };
})();
