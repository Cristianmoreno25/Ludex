// js/submenu.js - control de sidebar: toggle en desktop, oculto en mobile
(() => {
  if (document.body) document.body.classList.add('submenu-loading');
  let submenuReady = false;
  const markPageReady = () => {
    if (submenuReady) return;
    submenuReady = true;
    if (document.body) {
      document.body.classList.remove('submenu-loading');
      document.body.classList.add('submenu-ready');
    }
  };
  const possiblePaths = [
    '/html/submenu.html',
    '/submenu.html',
    './submenu.html',
    '../submenu.html',
    'submenu.html',
    '/partials/submenu.html'
  ];

  const PLACEHOLDER_ID = 'submenu-container';
  const MOBILE_BREAK = 900;
  const SNAPSHOT_TS_KEY = 'lx_submenu_snapshot_ts';
  const SNAPSHOT_MAX_AGE = 5 * 60 * 1000; // 5 min
  const NEEDS_KEY = 'lx_needs_completion';
  const PROVIDER_KEY = 'lx_last_provider';
  const FORCE_KEY = 'lx_force_completion';
  let globalMenuHandlerAttached = false;
  let trackedMenuButton = null;

  function attachGlobalMenuHandler() {
    if (globalMenuHandlerAttached) return;
    document.addEventListener('click', (event) => {
      const target = event.target && event.target.closest ? event.target.closest('#submenu-open-btn') : null;
      if (!target) return;
      if (window.innerWidth <= MOBILE_BREAK) return;
      event.preventDefault();
      event.stopPropagation();
      const isOpen = document.body.classList.toggle('submenu-open');
      const btn = trackedMenuButton || target;
      if (btn) btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }, true);
    globalMenuHandlerAttached = true;
  }

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
        <a href="#" id="logoutLink" data-logout="true"><i class="fa-solid fa-right-from-bracket"></i> Cerrar sesión</a>
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
    if (window.__LUD_publicEnv) return window.__LUD_publicEnv;
    try {
      const cached = sessionStorage.getItem('lx_public_env');
      if (cached) {
        window.__LUD_publicEnv = JSON.parse(cached);
        return window.__LUD_publicEnv;
      }
    } catch (_){}
    try {
      const r = await fetch('/api/public-env');
      const data = await r.json();
      window.__LUD_publicEnv = data;
      try { sessionStorage.setItem('lx_public_env', JSON.stringify(data)); } catch(_){}
      return data;
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

  function applyTopbarSnapshot(isLogged, displayName, avatarUrl) {
    try {
      const topbarRight = document.querySelector('.topbar-right') || document.querySelector('.page-header .topbar-right');
      if (!topbarRight) return;
      let avatarLink = topbarRight.querySelector('#topbar-avatar-link');
      if (!avatarLink) {
        avatarLink = document.createElement('a');
        avatarLink.id = 'topbar-avatar-link';
        avatarLink.className = 'avatar-link';
        avatarLink.setAttribute('aria-label', 'Perfil');
        avatarLink.setAttribute('data-topbar-profile', 'true');
        topbarRight.appendChild(avatarLink);
      }
      let avatarEl = avatarLink.querySelector('#topbar-avatar');
      if (!avatarEl) {
        avatarEl = document.createElement('span');
        avatarEl.id = 'topbar-avatar';
        avatarLink.appendChild(avatarEl);
      }
      let loginCTA = topbarRight.querySelector('#topbar-login-link');
      if (!loginCTA) {
        loginCTA = document.createElement('a');
        loginCTA.id = 'topbar-login-link';
        loginCTA.className = 'login-link';
        loginCTA.textContent = 'Iniciar sesión';
        loginCTA.href = './login.html';
        topbarRight.appendChild(loginCTA);
      }
      const cartLink = topbarRight.querySelector('a[href*="carrito.html"]');
      if (isLogged) {
        avatarEl.innerHTML = '';
        if (avatarUrl) {
          const img = document.createElement('img');
          img.src = avatarUrl;
          img.alt = 'Avatar';
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'cover';
          avatarEl.appendChild(img);
        } else {
          avatarEl.textContent = (displayName || 'U').charAt(0).toUpperCase();
        }
        avatarLink.setAttribute('href', './Profile.html');
        avatarLink.style.display = 'inline-flex';
        loginCTA.style.display = 'none';
        if (cartLink) cartLink.setAttribute('href', './carrito.html');
      } else {
        avatarLink.style.display = 'none';
        loginCTA.style.display = 'inline-flex';
        loginCTA.href = './login.html';
        if (cartLink) cartLink.setAttribute('href', './login.html');
      }
    } catch (_){}
  }

  function primeAuthUIFromCache(root) {
    if (!root) return;
    try {
      const isLogged = sessionStorage.getItem('lx_is_logged') === '1';
      const displayName = sessionStorage.getItem('lx_display_name') || 'Usuario';
      const avatarUrl = sessionStorage.getItem('lx_avatar_url') || '';

      const loginRow = root.querySelector('#auth-login-row');
      const registerRow = root.querySelector('#auth-register-row');
      const logoutRow = root.querySelector('#auth-logout-row');
      const userRow = root.querySelector('#auth-user-row');
      const userNameSpan = root.querySelector('#auth-username');
      const authList = root.querySelector('.auth-list');
      let guestRow = root.querySelector('#auth-guest-row');
      authList?.querySelectorAll('#auth-guest-row').forEach((node) => {
        if (!guestRow) guestRow = node;
        if (guestRow && node !== guestRow) node.remove();
      });
      const ensureGuest = () => {
        if (guestRow || !authList) return;
        guestRow = document.createElement('li');
        guestRow.id = 'auth-guest-row';
        guestRow.className = 'guest-info';
        guestRow.innerHTML = '<p>Inicia sesión para ver tu perfil.</p><div><a href="./login.html">Iniciar sesión</a> · <a href="./register.html">Registrarse</a></div>';
        authList.prepend(guestRow);
      };

      if (isLogged) {
        if (userRow) userRow.style.display = '';
        if (userNameSpan) userNameSpan.textContent = displayName;
        if (loginRow) loginRow.style.display = 'none';
        if (registerRow) registerRow.style.display = 'none';
        if (logoutRow) logoutRow.style.display = '';
        if (guestRow) guestRow.style.display = 'none';
      } else {
        if (userRow) userRow.style.display = 'none';
        if (loginRow) loginRow.style.display = 'none';
        if (registerRow) registerRow.style.display = 'none';
        if (logoutRow) logoutRow.style.display = 'none';
        ensureGuest();
        if (guestRow) guestRow.style.display = '';
      }

      applyTopbarSnapshot(isLogged, displayName, avatarUrl);
    } catch (_){}
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

  async function performLogout(client) {
    try {
      await client.auth.signOut();
    } catch (_){}
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
    } catch (_){}
    try { window.LudexSubmenuCache?.clear?.(); } catch (_){}
    try {
      sessionStorage.removeItem('lx_submenu_html_v2');
      sessionStorage.removeItem('lx_submenu_html_v2_ts');
      sessionStorage.removeItem('lx_display_name');
      sessionStorage.removeItem('lx_is_logged');
      sessionStorage.removeItem('lx_avatar_url');
      sessionStorage.removeItem(SNAPSHOT_TS_KEY);
      sessionStorage.removeItem(NEEDS_KEY);
      sessionStorage.removeItem(PROVIDER_KEY);
      sessionStorage.removeItem(FORCE_KEY);
    } catch(_){}
    document.body.classList.remove('submenu-open');
    const btn = document.getElementById('submenu-open-btn');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    window.location.href = '/html/login.html';
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
    trackedMenuButton = btn;
    attachGlobalMenuHandler();

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
    const forcedGuest = (() => {
      try {
        return new URLSearchParams(location.search).get('guest') === '1';
      } catch (_){ return false; }
    })();
    if (forcedGuest) {
      try {
        sessionStorage.removeItem('lx_submenu_html_v2');
        sessionStorage.removeItem('lx_submenu_html_v2_ts');
        sessionStorage.removeItem('lx_display_name');
        sessionStorage.removeItem('lx_is_logged');
        sessionStorage.removeItem('lx_avatar_url');
        sessionStorage.removeItem(SNAPSHOT_TS_KEY);
        sessionStorage.removeItem(NEEDS_KEY);
        sessionStorage.removeItem(PROVIDER_KEY);
        sessionStorage.removeItem(FORCE_KEY);
      } catch (_){}
    }
    primeAuthUIFromCache(root);
    const snapshotTs = Number(sessionStorage.getItem(SNAPSHOT_TS_KEY) || '0');
    const hasFreshSnapshot = !forcedGuest && snapshotTs && (Date.now() - snapshotTs < SNAPSHOT_MAX_AGE);
    const cachedNeeds = sessionStorage.getItem(NEEDS_KEY) === '1';
    const cachedProvider = sessionStorage.getItem(PROVIDER_KEY) || '';
    const onCompletePage = location.pathname.includes('/html/complete-profile.html');
    const forceCompletion = sessionStorage.getItem(FORCE_KEY) === '1';
    const shouldForceCheck = !forcedGuest && cachedNeeds && forceCompletion && cachedProvider === 'google' && !onCompletePage;
    const skipServerFetch = hasFreshSnapshot && !shouldForceCheck;

    try {
      await ensureSupabase();
      const { url, key } = await getPublicEnv();
      if (!url || !key) throw new Error('Faltan variables públicas de Supabase');

      const client = window.supabase.createClient(url, key);

      // Esqueleto visual: reservar espacio para el nombre y evitar saltos
      (function setNameSkeleton(){
        const topbarRight = document.querySelector('.topbar-right') || document.querySelector('.page-header .topbar-right');
        if (topbarRight) {
          const oldBtn = topbarRight.querySelector('.icon-btn a[href*="Profile.html"]');
          if (oldBtn && oldBtn.parentElement) oldBtn.parentElement.remove();
          let nameEl = topbarRight.querySelector('#topbar-username');
          if (!nameEl) {
            nameEl = document.createElement('span');
            nameEl.id = 'topbar-username';
            nameEl.style.fontWeight = '600';
            nameEl.style.fontSize = '0.9rem';
            topbarRight.appendChild(nameEl);
          }
          const cachedName = sessionStorage.getItem('lx_display_name') || '';
          nameEl.textContent = cachedName;
          nameEl.style.display = 'none';
          nameEl.style.minWidth = '0';
          nameEl.style.opacity = '0';

          let avatarLink = topbarRight.querySelector('#topbar-avatar-link');
          if (!avatarLink) {
            avatarLink = document.createElement('a');
            avatarLink.id = 'topbar-avatar-link';
            avatarLink.className = 'avatar-link';
            avatarLink.setAttribute('aria-label', 'Perfil');
            avatarLink.setAttribute('data-topbar-profile', 'true');
            topbarRight.appendChild(avatarLink);
          }
          let avatar = avatarLink.querySelector('#topbar-avatar');
          if (!avatar) {
            avatar = document.createElement('span');
            avatar.id = 'topbar-avatar';
            avatarLink.appendChild(avatar);
          }
          const cachedAvatar = sessionStorage.getItem('lx_avatar_url');
          if (cachedAvatar) {
            avatar.innerHTML = `<img src="${cachedAvatar}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;">`;
          } else {
            avatar.textContent = (cachedName || 'U').charAt(0).toUpperCase();
          }
        }
      })();

      // Si venimos como invitado explícito (?guest=1), forzar signout cliente+SSR
      if (forcedGuest) {
        try { await client.auth.signOut(); } catch(_){}
        try { await fetch('/api/auth/signout', { method: 'POST' }); } catch(_){}
        try {
          const newQs = new URLSearchParams(location.search);
          newQs.delete('guest');
          const newUrl = location.pathname + (newQs.toString() ? `?${newQs}` : '') + location.hash;
          window.history.replaceState({}, document.title, newUrl);
        } catch(_){}
      }
      const { data: { user } } = await client.auth.getUser();
      let profileRow = null;
      if (user?.email) {
        try {
          const { data: row } = await client
            .from('usuarios')
            .select('avatar_path')
            .eq('correo_electronico', user.email)
            .maybeSingle();
          profileRow = row || null;
        } catch (fetchErr) {
          console.debug('[submenu] No se pudo obtener avatar personalizado:', fetchErr.message);
        }
      }
      const isLogged = !!user;

      const $ = sel => root.querySelector(sel);
      const loginRow = $('#auth-login-row');
      const registerRow = $('#auth-register-row');
      const logoutRow = $('#auth-logout-row');
      const userRow = $('#auth-user-row');
      const userNameSpan = $('#auth-username');
      const authList = root.querySelector('.auth-list');
      let guestRow = $('#auth-guest-row');
      const hideGuestBlock = () => {
        if (guestRow) guestRow.style.display = 'none';
        authList?.querySelectorAll('#auth-guest-row').forEach((n, idx) => { if (!guestRow || n !== guestRow) n.remove(); });
      };
      const removeGuestRows = () => {
        authList?.querySelectorAll('#auth-guest-row').forEach(node => {
          if (guestRow && node === guestRow) return;
          node.remove();
        });
      };

      if (isLogged) {
        // Asegurar que exista perfil en tabla usuarios y decidir si requiere completar
        try {
          const { data: { session } } = await client.auth.getSession();
          const token = session?.access_token;
      if (token && !skipServerFetch) {
        await fetch('/api/auth/sync-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ access_token: token }) });
        const needsRes = await fetch('/api/auth/needs-completion', { headers: { Authorization: `Bearer ${token}` } });
        const needsData = await needsRes.json().catch(()=>({}));
        const provider = user?.app_metadata?.provider;
        try {
              sessionStorage.setItem(NEEDS_KEY, needsData?.needs ? '1' : '0');
              sessionStorage.setItem(SNAPSHOT_TS_KEY, String(Date.now()));
              if (provider === 'google') {
                sessionStorage.setItem(FORCE_KEY, needsData?.needs ? '1' : '0');
              } else {
                sessionStorage.setItem(FORCE_KEY, '0');
              }
            } catch(_){}
            const onComplete = location.pathname.includes('/html/complete-profile.html');
            if (provider === 'google' && needsData?.needs && !onComplete) {
              window.location.href = '/html/complete-profile.html';
              return;
            }
          }
        } catch(_){ }
        const display = (user?.user_metadata?.usuario || user?.user_metadata?.nombre_completo || (user?.email ? user.email.split('@')[0] : 'Usuario'));
        // ya no confiamos en caches previos para evitar mostrar nombres viejos
        try {
          sessionStorage.setItem('lx_display_name', String(display));
          sessionStorage.setItem('lx_is_logged', '1');
          sessionStorage.setItem(SNAPSHOT_TS_KEY, String(Date.now()));
        } catch(_){ }
        if (userNameSpan) userNameSpan.textContent = display;
        if (userRow) userRow.style.display = '';
        if (loginRow) loginRow.style.display = 'none';
        if (registerRow) registerRow.style.display = 'none';
        if (logoutRow) logoutRow.style.display = '';
        hideGuestBlock();
        removeGuestRows();

        const logoutLinks = root.querySelectorAll('#logoutLink, [data-logout="true"]');
        logoutLinks.forEach((logoutLink) => {
          logoutLink.addEventListener('click', async (e) => {
            e.preventDefault();
            await performLogout(client);
          });
        });
      } else {
        if (userRow) userRow.style.display = 'none';
        if (loginRow) loginRow.style.display = 'none';
        if (registerRow) registerRow.style.display = 'none';
        if (logoutRow) logoutRow.style.display = 'none';
        hideGuestBlock();
        if (!guestRow && authList) {
          guestRow = document.createElement('li');
          guestRow.id = 'auth-guest-row';
          guestRow.className = 'guest-info';
          guestRow.innerHTML = '<p>Inicia sesión para ver tu perfil.</p><div><a href="./login.html">Iniciar sesión</a> · <a href="./register.html">Registrarse</a></div>';
          authList.prepend(guestRow);
        }
        if (guestRow) guestRow.style.display = '';
        try {
          sessionStorage.setItem('lx_is_logged', '0');
          sessionStorage.removeItem('lx_display_name');
          sessionStorage.removeItem('lx_avatar_url');
          sessionStorage.removeItem(SNAPSHOT_TS_KEY);
          sessionStorage.removeItem(NEEDS_KEY);
        } catch(_){ }
      }

      // Top bar avatar entry
      const topbarRight = document.querySelector('.topbar-right') || document.querySelector('.page-header .topbar-right');
      if (topbarRight) {
        const nameEl = topbarRight.querySelector('#topbar-username');
        if (nameEl) nameEl.remove();

        let avatarLink = topbarRight.querySelector('#topbar-avatar-link');
        if (!avatarLink) {
          avatarLink = document.createElement('a');
          avatarLink.id = 'topbar-avatar-link';
          avatarLink.className = 'avatar-link';
          avatarLink.setAttribute('aria-label', 'Perfil');
          avatarLink.setAttribute('data-topbar-profile', 'true');
          topbarRight.appendChild(avatarLink);
        } else {
          avatarLink.style.display = 'inline-flex';
        }

        let avatarEl = avatarLink.querySelector('#topbar-avatar');
        if (!avatarEl) {
          avatarEl = document.createElement('span');
          avatarEl.id = 'topbar-avatar';
          avatarEl.textContent = 'U';
          avatarLink.appendChild(avatarEl);
        }
        let loginCTA = topbarRight.querySelector('#topbar-login-link');
        if (!loginCTA) {
          loginCTA = document.createElement('a');
          loginCTA.id = 'topbar-login-link';
          loginCTA.className = 'login-link';
          loginCTA.textContent = 'Iniciar sesión';
          loginCTA.href = './login.html';
          topbarRight.appendChild(loginCTA);
        }

        const cartLink = topbarRight.querySelector('a[href*="carrito.html"]');

        const applyAvatar = (url, fallback) => {
          avatarEl.innerHTML = '';
          if (url) {
            const img = document.createElement('img');
            img.src = url;
            img.alt = 'Avatar';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            avatarEl.appendChild(img);
            try { sessionStorage.setItem('lx_avatar_url', url); } catch(_){}
          } else {
            avatarEl.textContent = fallback || 'U';
            try { sessionStorage.removeItem('lx_avatar_url'); } catch(_){}
          }
        };

        if (isLogged) {
          const letter = (userNameSpan?.textContent || 'U').charAt(0).toUpperCase();
          let avatarUrl = null;
          if (profileRow?.avatar_path) {
            avatarUrl = `${url}/storage/v1/object/public/avatars/${encodeURIComponent(profileRow.avatar_path)}`;
          } else if (user?.user_metadata?.avatar_url) {
            avatarUrl = user.user_metadata.avatar_url;
          } else if (user?.user_metadata?.avatar_path) {
            avatarUrl = `${url}/storage/v1/object/public/avatars/${encodeURIComponent(user.user_metadata.avatar_path)}`;
          }
          applyAvatar(avatarUrl, letter);
          avatarLink.setAttribute('href', './Profile.html');
          avatarLink.style.display = 'inline-flex';
          if (loginCTA) loginCTA.style.display = 'none';
          if (cartLink) cartLink.setAttribute('href', './carrito.html');
        } else {
          applyAvatar(null, 'U');
          avatarLink.setAttribute('href', './login.html');
          avatarLink.style.display = 'none';
          if (loginCTA) {
            loginCTA.style.display = 'inline-flex';
            loginCTA.href = './login.html';
          }
        }
      }
    } catch (e) {
      console.warn('[submenu.js] initAuthUI:', e && e.message ? e.message : e);
      markPageReady();
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
    attachGlobalMenuHandler();
    ensureFontAwesome();
    const placeholder = document.getElementById(PLACEHOLDER_ID);
    if (!placeholder) {
      console.error(`[submenu.js] No se encontró el placeholder #${PLACEHOLDER_ID}.`);
      markPageReady();
      return;
    }

    let usedCache = false;
    let fallbackRendered = false;
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
        markPageReady();
      }
    } catch(_){}

    if (!usedCache) {
      placeholder.innerHTML = FALLBACK_HTML;
      dedupeMenuButton(placeholder);
      try { wireMenuInteractions(placeholder); } catch (err) { console.error('[submenu.js] wiring (fallback):', err); }
      await initAuthUI(placeholder);
      markPageReady();
      fallbackRendered = true;
    }

    // Fetch en segundo plano (o si no había cache)
    (async () => {
      const fetched = await fetchFirstAvailable(possiblePaths);
      let html = fetched && fetched.html ? fetched.html : FALLBACK_HTML;
      if (!fetched || !fetched.html) console.warn('[submenu.js] Se inyectó fallback del submenu.');

      const current = sessionStorage.getItem(CACHE_KEY) || '';
      if (!usedCache || current !== html) {
        const render = async () => {
          const wasOpen = document.body.classList.contains('submenu-open');
          if (!fallbackRendered || html !== FALLBACK_HTML) {
            placeholder.innerHTML = html;
            dedupeMenuButton(placeholder);
            try { wireMenuInteractions(placeholder); } catch (err) { console.error('[submenu.js] wiring (fresh):', err); }
            await initAuthUI(placeholder);
            if (wasOpen && window.innerWidth > MOBILE_BREAK) {
              document.body.classList.add('submenu-open');
              const btn = document.getElementById('submenu-open-btn');
              if (btn) btn.setAttribute('aria-expanded', 'true');
            }
            markPageReady();
          }
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
