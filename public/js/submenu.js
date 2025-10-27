// js/submenu.js - control de sidebar: toggle en desktop, oculto en mobile
(() => {
  const possiblePaths = [
    '/partials/submenu.html',
    '/submenu.html',
    '/partials/partials/submenu.html',
    'partials/submenu.html',
    './partials/submenu.html',
    '../partials/submenu.html',
    './submenu.html',
    '../submenu.html',
    'submenu.html'
  ];

  const PLACEHOLDER_ID = 'submenu-container';
  const MOBILE_BREAK = 900;

  const FALLBACK_HTML = `
    <div class="submenu-root" id="site-submenu-root">
      <button class="menu-icon-button" id="submenu-open-btn" aria-label="Abrir menú" aria-expanded="false" aria-controls="site-submenu">
        <i class="fa-solid fa-bars" aria-hidden="true"></i>
      </button>
      <nav id="site-submenu" class="submenu" role="navigation" aria-label="Navegación principal">
        <ul>
          <li><a href="./browse.html"><i class="fa-solid fa-house" aria-hidden="true"></i> Inicio</a></li>
          <li><a href="./notifications.html"><i class="fa-solid fa-bell" aria-hidden="true"></i> Notificaciones</a></li>
          <li><a href="./wishlist.html"><i class="fa-solid fa-star" aria-hidden="true"></i> Juegos deseados</a></li>
          <li><a href="./library.html"><i class="fa-solid fa-book" aria-hidden="true"></i> Biblioteca</a></li>
        </ul>
        <hr class="submenu-sep">
        <ul class="auth-list">
          <li id="auth-user-row" style="display:none">
            <a href="./Profile.html"><i class="fa-regular fa-user" aria-hidden="true"></i> <span id="auth-username">Usuario</span></a>
          </li>
          <li id="auth-login-row"><a href="./login.html"><i class="fa-solid fa-right-to-bracket"></i> Iniciar sesión</a></li>
          <li id="auth-register-row"><a href="./register.html"><i class="fa-solid fa-user-plus"></i> Registrarse</a></li>
          <li id="auth-logout-row" style="display:none">
            <a href="#" id="logoutLink"><i class="fa-solid fa-right-from-bracket"></i> Cerrar sesión</a>
          </li>
        </ul>
      </nav>
      <nav class="bottom-nav" aria-label="Navegación inferior">
        <a href="./browse.html" class="nav-item"><i class="fa-solid fa-house" aria-hidden="true"></i><span>Inicio</span></a>
        <a href="./notifications.html" class="nav-item"><i class="fa-solid fa-bell" aria-hidden="true"></i><span>Alertas</span></a>
        <a href="./wishlist.html" class="nav-item"><i class="fa-solid fa-star" aria-hidden="true"></i><span>Favoritos</span></a>
        <a href="./library.html" class="nav-item"><i class="fa-solid fa-bars" aria-hidden="true"></i><span>Biblioteca</span></a>
      </nav>
    </div>
  `;

  function ensureFontAwesome() {
    const hasFA = Array.from(document.styleSheets).some(s => {
      try { return s.href && (s.href.includes('font-awesome') || s.href.includes('fontawesome')); }
      catch(e) { return false; }
    }) || !!document.querySelector('link[href*="font-awesome"], link[href*="fontawesome"]');

    if (!hasFA) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css';
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
      console.info('[submenu.js] FontAwesome inyectado dinámicamente.');
    }
  }

  function ensureSupabase() {
    return new Promise((resolve, reject) => {
      if (window.supabase?.createClient) return resolve();
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('No se pudo cargar supabase-js'));
      document.head.appendChild(s);
    });
  }

  async function getPublicEnv() {
    try {
      const r = await fetch('/api/public-env');
      return await r.json();
    } catch (_) {
      return {};
    }
  }

  function dedupeMenuButton(root) {
    try {
      const header = document.querySelector('.topbar-left') || document.querySelector('.page-header .page-left') || document.querySelector('.page-left');
      const headerBtn = header ? header.querySelector('#submenu-open-btn') : null;
      const all = Array.from(document.querySelectorAll('#submenu-open-btn'));
      const keep = headerBtn || all[0] || null;
      all.forEach((node) => {
        if (keep && node !== keep) node.remove();
      });
      // Además, elimina cualquier botón duplicado incluido dentro del partial cargado
      if (root) {
        const internal = root.querySelectorAll('#submenu-open-btn');
        internal.forEach((n) => { if (!keep || n !== keep) n.remove(); });
      }
      return keep;
    } catch (_) { return null; }
  }

  async function fetchFirstAvailable(paths) {
    for (const p of paths) {
      try {
        const res = await fetch(p, { cache: 'no-store' });
        if (res.ok) {
          const txt = await res.text();
          console.info(`[submenu.js] Cargado submenu desde: "${p}"`);
          return { html: txt, path: p };
        } else {
          console.warn(`[submenu.js] ruta encontrada pero status ${res.status} al pedir "${p}"`);
        }
      } catch (err) {
        console.debug(`[submenu.js] no se pudo fetch "${p}" — ${err.message}`);
      }
    }
    return null;
  }

  // Inserta el botón del menú lo antes posible para evitar retrasos visuales
  function ensureEarlyButton() {
    if (document.getElementById('submenu-open-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'menu-icon-button';
    btn.id = 'submenu-open-btn';
    btn.setAttribute('aria-label', 'Abrir menú');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<i class="fa-solid fa-bars" aria-hidden="true"></i>';
    const hostLeft = document.querySelector('.topbar-left') || document.querySelector('.page-header .page-left') || document.querySelector('.page-left');
    if (hostLeft) hostLeft.insertAdjacentElement('afterbegin', btn);
    else document.body.appendChild(btn);
  }

  function wireMenuInteractions(root) {
    // buscar elementos
    let btn = root.querySelector('#submenu-open-btn') || root.querySelector('.menu-icon-button') || document.getElementById('submenu-open-btn');
    let submenu = root.querySelector('#site-submenu') || root.querySelector('.submenu');
    let bottomNav = root.querySelector('.bottom-nav') || document.querySelector('.bottom-nav');
    let overlay = root.querySelector('#submenu-overlay') || root.querySelector('.overlay');

    // si falta submenu, inyectar fallback
    if (!submenu) {
      console.warn('[submenu.js] No se encontró .submenu. Inyectando fallback.');
      root.innerHTML = FALLBACK_HTML;
      btn = root.querySelector('#submenu-open-btn');
      submenu = root.querySelector('#site-submenu');
      bottomNav = root.querySelector('.bottom-nav') || document.querySelector('.bottom-nav');
    }

    // Si no existe botón (raro), crearlo pero estará oculto en mobile por CSS
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'menu-icon-button';
      btn.id = 'submenu-open-btn';
      btn.setAttribute('aria-label', 'Abrir menú');
      btn.setAttribute('aria-expanded', 'false');
      btn.innerHTML = '<i class="fa-solid fa-bars" aria-hidden="true"></i>';
      document.body.appendChild(btn);
    }

    // Colocar el botón dentro del header para que esté junto al título (no superpuesto)
    try {
      const hostLeft = document.querySelector('.topbar-left') || document.querySelector('.page-header .page-left') || document.querySelector('.page-left');
      if (hostLeft && btn.parentNode !== hostLeft) {
        hostLeft.insertAdjacentElement('afterbegin', btn);
      }
    } catch (_) {}

    // Atributos iniciales (overlay cerrado por defecto)
    btn.setAttribute('aria-controls', submenu.id || 'site-submenu');
    btn.setAttribute('aria-expanded', document.body.classList.contains('submenu-open') ? 'true' : 'false');

    // Toggle handler: en desktop hace collapse/expand; en mobile no hace nada (botón oculto por CSS)
    function toggleSidebarDesktop(e) {
      if (window.innerWidth <= MOBILE_BREAK) return; // no hacemos nada en mobile
      e && e.stopPropagation();
      const isOpen = document.body.classList.toggle('submenu-open');
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }

    // Asignar listener (defensivo: remover antes)
    btn.removeEventListener('click', toggleSidebarDesktop);
    btn.addEventListener('click', toggleSidebarDesktop);

    // Cerrar al pulsar overlay
    if (overlay) {
      overlay.addEventListener('click', () => {
        document.body.classList.remove('submenu-open');
        btn.setAttribute('aria-expanded', 'false');
      });
    }

    // Cerrar sidebar si se redimensiona a mobile; si volvemos a desktop no forzamos open
    let resizeTimer = null;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (window.innerWidth <= MOBILE_BREAK) {
          // Asegurar overlay cerrado en mobile
          if (document.body.classList.contains('submenu-open')) {
            document.body.classList.remove('submenu-open');
          }
          btn.setAttribute('aria-expanded', 'false');
        } else {
          // En desktop no forzamos apertura automática (overlay)
        }
      }, 120);
    }
    window.removeEventListener('resize', onResize);
    window.addEventListener('resize', onResize);

    // Si el usuario hace click en enlaces dentro del submenu y está en mobile, no hay necesidad de cerrar (sidebar está oculto).
    // Opcional: en desktop no cerramos al click (porque es fija), pero si quieres que se oculte al navegar, podrías añadir lógica.

    // Ejecutar una vez para sincronizar estado inicial según ancho
    onResize();

    console.info('[submenu.js] Botón y wiring listos. Estado inicial:', {
      isMobile: window.innerWidth <= MOBILE_BREAK,
      sidebarCollapsed: document.body.classList.contains('sidebar-collapsed')
    });
  }

  async function initAuthUI(root) {
    try {
      await ensureSupabase();
      const { url, key } = await getPublicEnv();
      if (!url || !key) throw new Error('Faltan variables públicas de Supabase');

      const client = window.supabase.createClient(url, key);

      // Esqueleto visual: reservar espacio para el nombre y evitar saltos
      (function setNameSkeleton(){
        const topbarRight = document.querySelector('.topbar-right') || document.querySelector('.page-header .topbar-right');
        if (topbarRight) {
          let nameEl = topbarRight.querySelector('#topbar-username');
          if (!nameEl) {
            nameEl = document.createElement('span');
            nameEl.id = 'topbar-username';
            nameEl.style.marginLeft = '8px';
            nameEl.style.fontWeight = '600';
            nameEl.style.fontSize = '0.9rem';
            topbarRight.appendChild(nameEl);
          }
          nameEl.textContent = '';
          nameEl.style.display = 'inline-block';
          nameEl.style.minWidth = '10ch'; // evita salto
          nameEl.style.opacity = '0.6';
        }
      })();

      // Si venimos como invitado explícito (?guest=1), forzar signout cliente+SSR
      try {
        const qs = new URLSearchParams(location.search);
        if (qs.get('guest') === '1') {
          try { await client.auth.signOut(); } catch(_){ }
          try { await fetch('/api/auth/signout', { method: 'POST' }); } catch(_){ }
          try { sessionStorage.removeItem('lx_submenu_html_v2'); sessionStorage.removeItem('lx_submenu_html_v2_ts'); sessionStorage.removeItem('lx_display_name'); sessionStorage.removeItem('lx_is_logged'); } catch(_){ }
        }
      } catch(_){ }
      const { data: { user } } = await client.auth.getUser();
      const isLogged = !!user;

      const $ = sel => root.querySelector(sel);
      const loginRow = $('#auth-login-row');
      const registerRow = $('#auth-register-row');
      const logoutRow = $('#auth-logout-row');
      const userRow = $('#auth-user-row');
      const userNameSpan = $('#auth-username');

      if (isLogged) {
        // Asegurar que exista perfil en tabla usuarios y decidir si requiere completar
        try {
          const { data: { session } } = await client.auth.getSession();
          const token = session?.access_token;
          if (token) {
            await fetch('/api/auth/sync-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ access_token: token }) });
            const needsRes = await fetch('/api/auth/needs-completion', { headers: { Authorization: `Bearer ${token}` } });
            const needsData = await needsRes.json().catch(()=>({}));
            const provider = user?.app_metadata?.provider;
            const onComplete = location.pathname.includes('/html/complete-profile.html');
            if (provider === 'google' && needsData?.needs && !onComplete) {
              window.location.href = '/html/complete-profile.html';
              return;
            }
          }
        } catch(_){ }
        const display = (user?.user_metadata?.usuario || user?.user_metadata?.nombre_completo || (user?.email ? user.email.split('@')[0] : 'Usuario'));
        // ya no confiamos en caches previos para evitar mostrar nombres viejos
        try { sessionStorage.setItem('lx_display_name', String(display)); sessionStorage.setItem('lx_is_logged', '1'); } catch(_){ }
        if (userNameSpan) userNameSpan.textContent = display;
        if (userRow) userRow.style.display = '';
        if (loginRow) loginRow.style.display = 'none';
        if (registerRow) registerRow.style.display = 'none';
        if (logoutRow) logoutRow.style.display = '';

        const logoutLink = root.querySelector('#logoutLink');
        if (logoutLink) {
          logoutLink.addEventListener('click', async (e) => {
            e.preventDefault();
            try { await client.auth.signOut(); } catch (_) {}
            try { await fetch('/api/auth/signout', { method: 'POST' }); } catch (_){ }
            try { sessionStorage.removeItem('lx_submenu_html_v2'); sessionStorage.removeItem('lx_submenu_html_v2_ts'); sessionStorage.removeItem('lx_display_name'); sessionStorage.removeItem('lx_is_logged'); } catch(_){ }
            window.location.href = '/html/login.html';
          });
        }
      } else {
        if (userRow) userRow.style.display = 'none';
        if (loginRow) loginRow.style.display = '';
        if (registerRow) registerRow.style.display = '';
        if (logoutRow) logoutRow.style.display = 'none';
        try { sessionStorage.removeItem('lx_display_name'); sessionStorage.removeItem('lx_is_logged'); } catch(_){ }
      }

      // Topbar: nombre junto al icono de perfil; mantener enlaces existentes cuando no hay sesión
      const topbarRight = document.querySelector('.topbar-right') || document.querySelector('.page-header .topbar-right');
      if (topbarRight) {
        const nameId = 'topbar-username';
        let nameEl = topbarRight.querySelector('#' + nameId);
        if (!nameEl) {
          nameEl = document.createElement('span');
          nameEl.id = nameId;
          nameEl.style.marginLeft = '8px';
          nameEl.style.fontWeight = '600';
          nameEl.style.fontSize = '0.9rem';
          topbarRight.appendChild(nameEl);
        }

        const profileLink = topbarRight.querySelector('a[href*="Profile.html"], a[title="Perfil"], a[aria-label="Perfil"]');
        const cartLink = topbarRight.querySelector('a[href*="carrito.html"]');
        if (isLogged) {
          nameEl.textContent = userNameSpan?.textContent || '';
          nameEl.style.opacity = '1';
          if (profileLink) profileLink.setAttribute('href', './Profile.html');
          if (cartLink) cartLink.setAttribute('href', './carrito.html');
        } else {
          nameEl.textContent = '';
          nameEl.style.opacity = '0.6';
          // Perfil debe llevar a login si no hay sesión
          if (profileLink) profileLink.setAttribute('href', './login.html');
        }
      }
    } catch (e) {
      console.warn('[submenu.js] initAuthUI:', e && e.message ? e.message : e);
    }
  }

  // Init
  (async function init() {
    // Cache simple del HTML del submenu para mostrarlo instantáneamente
    const CACHE_KEY = 'lx_submenu_html_v2';
    const CACHE_TS = 'lx_submenu_html_v2_ts';
    const CACHE_MAX_AGE_MS = 5 * 60 * 1000;
    // Mostrar el botón desde el primer render
    ensureEarlyButton();
    ensureFontAwesome();
    const placeholder = document.getElementById(PLACEHOLDER_ID);
    if (!placeholder) {
      console.error(`[submenu.js] No se encontró el placeholder #${PLACEHOLDER_ID}.`);
      return;
    }

    let usedCache = false;
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      const ts = Number(sessionStorage.getItem(CACHE_TS) || '0');
      const freshEnough = Date.now() - ts < CACHE_MAX_AGE_MS;
      if (cached && freshEnough) {
        placeholder.innerHTML = cached;
        usedCache = true;
        dedupeMenuButton(placeholder);
        try { wireMenuInteractions(placeholder); } catch (err) { console.error('[submenu.js] wiring (cache):', err); }
        await initAuthUI(placeholder);
      }
    } catch(_){}

    // Fetch en segundo plano (o si no había cache)
    (async () => {
      const fetched = await fetchFirstAvailable(possiblePaths);
      let html = fetched && fetched.html ? fetched.html : FALLBACK_HTML;
      if (!fetched || !fetched.html) console.warn('[submenu.js] Se inyectó fallback del submenu.');

      const current = sessionStorage.getItem(CACHE_KEY) || '';
      if (!usedCache || current !== html) {
        const render = async () => {
          placeholder.innerHTML = html;
          dedupeMenuButton(placeholder);
          try { wireMenuInteractions(placeholder); } catch (err) { console.error('[submenu.js] wiring (fresh):', err); }
          await initAuthUI(placeholder);
          try { sessionStorage.setItem(CACHE_KEY, html); sessionStorage.setItem(CACHE_TS, String(Date.now())); } catch(_){ }
        };
        if ('requestIdleCallback' in window) {
          // @ts-ignore
          requestIdleCallback(render, { timeout: 800 });
        } else {
          setTimeout(render, 0);
        }
      }
    })();

    console.info('[submenu.js] Inicializado correctamente.');
  })();

})();
