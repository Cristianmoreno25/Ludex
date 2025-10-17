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
          <li><a href="/browse.html"><i class="fa-solid fa-house" aria-hidden="true"></i> Inicio</a></li>
          <li><a href="/notifications.html"><i class="fa-solid fa-bell" aria-hidden="true"></i> Notificaciones</a></li>
          <li><a href="/wishlist.html"><i class="fa-solid fa-star" aria-hidden="true"></i> Juegos deseados</a></li>
          <li><a href="/library.html"><i class="fa-solid fa-book" aria-hidden="true"></i> Librería</a></li>
        </ul>
      </nav>
      <nav class="bottom-nav" aria-label="Navegación inferior">
        <a href="/browse.html" class="nav-item"><i class="fa-solid fa-house" aria-hidden="true"></i><span>Inicio</span></a>
        <a href="/notifications.html" class="nav-item"><i class="fa-solid fa-bell" aria-hidden="true"></i><span>Alertas</span></a>
        <a href="/wishlist.html" class="nav-item"><i class="fa-solid fa-star" aria-hidden="true"></i><span>Favoritos</span></a>
        <a href="/library.html" class="nav-item"><i class="fa-solid fa-bars" aria-hidden="true"></i><span>Biblioteca</span></a>
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

  function wireMenuInteractions(root) {
    // buscar elementos
    let btn = root.querySelector('#submenu-open-btn') || root.querySelector('.menu-icon-button');
    let submenu = root.querySelector('#site-submenu') || root.querySelector('.submenu');
    let bottomNav = root.querySelector('.bottom-nav') || document.querySelector('.bottom-nav');

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

    // Atributos iniciales
    btn.setAttribute('aria-controls', submenu.id || 'site-submenu');
    btn.setAttribute('aria-expanded', document.body.classList.contains('sidebar-collapsed') ? 'false' : 'true');

    // Toggle handler: en desktop hace collapse/expand; en mobile no hace nada (botón oculto por CSS)
    function toggleSidebarDesktop(e) {
      if (window.innerWidth <= MOBILE_BREAK) return; // no hacemos nada en mobile
      e && e.stopPropagation();
      if (document.body.classList.contains('sidebar-collapsed')) {
        document.body.classList.remove('sidebar-collapsed');
        btn.setAttribute('aria-expanded', 'true');
      } else {
        document.body.classList.add('sidebar-collapsed');
        btn.setAttribute('aria-expanded', 'false');
      }
    }

    // Asignar listener (defensivo: remover antes)
    btn.removeEventListener('click', toggleSidebarDesktop);
    btn.addEventListener('click', toggleSidebarDesktop);

    // Cerrar sidebar si se redimensiona a mobile; si volvemos a desktop no forzamos open
    let resizeTimer = null;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (window.innerWidth <= MOBILE_BREAK) {
          // limpiar clases que pudieran forzar aparecido del sidebar
          if (document.body.classList.contains('sidebar-collapsed')) {
            document.body.classList.remove('sidebar-collapsed');
            btn.setAttribute('aria-expanded', 'true');
          }
          // también quitar cualquier clase overlay si existe
          if (document.body.classList.contains('submenu-open')) {
            document.body.classList.remove('submenu-open');
          }
        } else {
          // En desktop: si no existe la clase sidebar-collapsed, la barra estará visible por CSS.
          // No forzamos apertura automática.
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

  // Init
  (async function init() {
    ensureFontAwesome();
    const placeholder = document.getElementById(PLACEHOLDER_ID);
    if (!placeholder) {
      console.error(`[submenu.js] No se encontró el placeholder #${PLACEHOLDER_ID}.`);
      return;
    }

    const fetched = await fetchFirstAvailable(possiblePaths);
    if (fetched && fetched.html) {
      placeholder.innerHTML = fetched.html;
    } else {
      placeholder.innerHTML = FALLBACK_HTML;
      console.warn('[submenu.js] Se inyectó fallback del submenu.');
    }

    try {
      wireMenuInteractions(placeholder);
    } catch (err) {
      console.error('[submenu.js] Error wiring menu:', err);
    }

    console.info('[submenu.js] Inicializado correctamente.');
  })();

})();
