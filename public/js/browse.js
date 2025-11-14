// browse.js — Refactor limpio: filtros, búsqueda, pills y sidebar (overlay + responsive)
// Reemplaza/pega todo este archivo en ../js/browse.js
'use strict';

(function () {
  // -------------------------
  // Config
  // -------------------------
  const DESKTOP_MIN = 900; // breakpoint para comportamiento de sidebar
  const SEARCH_DEBOUNCE_MS = 180;
  const CLOSE_SIDEBAR_ON_SELECT = false; // si quieres que se cierre al seleccionar un item (desktop)

  // -------------------------
  // Utilidades
  // -------------------------
  function qS(selector, root = document) { return root.querySelector(selector); }
  function qSA(selector, root = document) { return Array.from((root || document).querySelectorAll(selector)); }
  function isDesktop() { return window.innerWidth >= DESKTOP_MIN; }

  function debounce(fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  // safe number parse (returns NaN if not numeric)
  function toNumber(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : NaN;
  }

  // -------------------------
  // Cached DOM refs (queried once on DOM ready)
  // -------------------------
  document.addEventListener('DOMContentLoaded', () => {
    const cards = qSA('.card');
    const searchInput = qS('#search');
    const clearBtn = qS('#clearSearch');
    const categoryPills = qSA('.category-pill');
    const pricePills = qSA('.price-pill');
    const menuBtn = qS('#menuBtn');
    const sidebar = qS('#sidebar');
    const closeSidebarBtn = qS('#closeSidebar');
    const sideItems = qSA('.side-item');
    const bottomNavItems = qSA('.bottom-nav .nav-item');
    const cartBtn = qS('#cartBtn');

    // early exit if minimal structure is missing
    if (!cards.length) {
      // still proceed: some pages may not have cards
      console.warn('browse.js: no .card elements found — filters will be inert.');
    }

    // -------------------------
    // State
    // -------------------------
    let state = {
      q: '',
      selectedCategory: 'All Games',
      selectedPrice: 'all'
    };

    // -------------------------
    // Overlay (one-time creation)
    // -------------------------
    let overlay = qS('.sidebar-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay';
      document.body.appendChild(overlay);
    }

    // -------------------------
    // Filtering logic
    // -------------------------
    function matchesFilters(cardEl) {
      if (!cardEl) return false;

      const title = (cardEl.dataset.title || '').toLowerCase();
      const category = (cardEl.dataset.category || '').toLowerCase();
      const priceNum = toNumber(cardEl.dataset.price || '0');

      // search:
      if (state.q) {
        if (!title.includes(state.q)) return false;
      }

      // category:
      if (state.selectedCategory && state.selectedCategory.toLowerCase() !== 'all games') {
        if (state.selectedCategory.toLowerCase() !== category) return false;
      }

      // price rules:
      switch (state.selectedPrice) {
        case 'free':
          if (priceNum !== 0) return false;
          break;
        case 'lt5':
          if (!(priceNum > 0 && priceNum < 5)) return false;
          break;
        case 'lt15':
          if (!(priceNum > 0 && priceNum < 15)) return false;
          break;
        // 'all' -> no restriction
      }

      return true;
    }

    function renderFilters() {
      // guard
      if (!cards) return;
      for (const c of cards) {
        if (matchesFilters(c)) {
          c.style.display = '';
        } else {
          c.style.display = 'none';
        }
      }
    }

    // -------------------------
    // Search handlers
    // -------------------------
    if (searchInput) {
      const onSearch = debounce((ev) => {
        state.q = (ev.target.value || '').trim().toLowerCase();
        renderFilters();
      }, SEARCH_DEBOUNCE_MS);

      searchInput.addEventListener('input', onSearch);
    }

    if (clearBtn && searchInput) {
      clearBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        searchInput.value = '';
        state.q = '';
        renderFilters();
        searchInput.focus();
      });
    }

    // -------------------------
    // Pills (category / price)
    // -------------------------
    function bindPills(pills, type) {
      if (!pills || !pills.length) return;
      pills.forEach(p => {
        p.addEventListener('click', (e) => {
          e.preventDefault();
          // clear siblings
          pills.forEach(x => x.classList.remove('active'));
          p.classList.add('active');

          if (type === 'category') {
            state.selectedCategory = p.dataset.category || 'All Games';
          } else if (type === 'price') {
            state.selectedPrice = p.dataset.price || 'all';
          }
          renderFilters();
          // asegurar que la pill activa sea visible cuando hay scroll horizontal
          try { p.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); } catch(_){}
        });
      });
    }

    bindPills(categoryPills, 'category');
    bindPills(pricePills, 'price');

    // -------------------------
    // Cart button (optional)
    // -------------------------
    if (cartBtn) {
      cartBtn.addEventListener('click', () => {
        window.location.href = './carrito.html';
      });
    }

    // -------------------------
    // Sidebar: open / close helpers
    // -------------------------
    function openSidebar() {
      if (!sidebar) return;
      if (!isDesktop()) return; // guard: only desktop opens
      sidebar.classList.add('open');
      sidebar.setAttribute('aria-hidden', 'false');
      document.body.classList.add('sidebar-open');
      overlay.classList.add('visible');
      // prevent page scroll while sidebar open
      document.documentElement.classList.add('no-scroll');
    }

    function closeSidebar() {
      if (!sidebar) return;
      sidebar.classList.remove('open');
      sidebar.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('sidebar-open');
      overlay.classList.remove('visible');
      document.documentElement.classList.remove('no-scroll');
    }

    function toggleSidebar() {
      if (!sidebar) return;
      if (sidebar.classList.contains('open')) closeSidebar();
      else openSidebar();
    }

    // -------------------------
    // Menu button behavior
    // -------------------------
    if (menuBtn) {
      menuBtn.addEventListener('click', (ev) => {
        // on mobile we don't open the large sidebar; show micro-feedback
        if (!isDesktop()) {
          menuBtn.classList.add('disabled');
          setTimeout(() => menuBtn.classList.remove('disabled'), 140);
          return;
        }
        toggleSidebar();
      });
    }

    // overlay click -> close
    overlay.addEventListener('click', closeSidebar);

    // close button (if present)
    if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeSidebar);

    // click outside to close (safety): handled by overlay; this listener is tolerant
    document.addEventListener('click', (ev) => {
      if (!sidebar || !sidebar.classList.contains('open')) return;
      // if click not inside sidebar and not on menuBtn, close
      if (!sidebar.contains(ev.target) && ev.target !== menuBtn && !overlay.contains(ev.target)) {
        closeSidebar();
      }
    }, true);

    // escape key closes
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && sidebar && sidebar.classList.contains('open')) {
        closeSidebar();
      }
    });

    // ensure we close sidebar when resizing to mobile
    // Ajuste al cambiar de tamaño: garantiza que los grupos horizontales no se queden
    // desplazados desde el estado de escritorio
    function syncFilterScroll() {
      document.querySelectorAll('.filter-group').forEach(group => {
        const needsHorizontal = group.scrollWidth > (group.clientWidth + 4);
        if (!needsHorizontal) { group.scrollLeft = 0; return; }
        const active = group.querySelector('.pill.active');
        if (active) {
          try { active.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' }); } catch(_){}
        } else {
          group.scrollLeft = 0;
        }
      });
    }

    window.addEventListener('resize', () => {
      if (!isDesktop() && sidebar && sidebar.classList.contains('open')) {
        closeSidebar();
      }
      syncFilterScroll();
    });

    // sincronizar en el primer render (por si la página abre en un ancho intermedio)
    syncFilterScroll();

    // -------------------------
    // Side nav items (active state + optional actions)
    // -------------------------
    if (sideItems && sideItems.length) {
      sideItems.forEach(item => {
        item.addEventListener('click', (ev) => {
          ev.preventDefault();

          // mark active
          sideItems.forEach(i => {
            i.classList.remove('active');
            i.setAttribute('aria-pressed', 'false');
          });
          item.classList.add('active');
          item.setAttribute('aria-pressed', 'true');

          // map to bottom nav (if any) by data-section
          const section = item.dataset.section;
          if (bottomNavItems && bottomNavItems.length) {
            bottomNavItems.forEach(b => b.classList.remove('active'));
            // try to match by dataset-section or fallback to index mapping
            const mapped = bottomNavItems.find(b => (b.dataset && b.dataset.section) === section);
            if (mapped) mapped.classList.add('active');
            else {
              // fallback mapping by known names
              if (section === 'home' && bottomNavItems[0]) bottomNavItems[0].classList.add('active');
              if (section === 'notifications' && bottomNavItems[1]) bottomNavItems[1].classList.add('active');
              if (section === 'wishlist' && bottomNavItems[2]) bottomNavItems[2].classList.add('active');
              if (section === 'library' && bottomNavItems[3]) bottomNavItems[3].classList.add('active');
            }
          }

          // optional actions per section
          if (section === 'home') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } else if (section === 'notifications') {
            // replace with your SPA navigation logic or a real redirect
            // window.location.href = './notifications.html';
          } else if (section === 'wishlist') {
            // window.location.href = './wishlist.html';
          } else if (section === 'library') {
            // window.location.href = './library.html';
          }

          // close sidebar on selection? (configurable)
          if (CLOSE_SIDEBAR_ON_SELECT && isDesktop()) closeSidebar();
        });
      });
    }

    // -------------------------
    // Bottom nav click sync (optional)
    // -------------------------
    if (bottomNavItems && bottomNavItems.length) {
      bottomNavItems.forEach((btn, idx) => {
        btn.addEventListener('click', (ev) => {
          // allow natural navigation if it's an <a href> — don't preventDefault unless you want SPA behavior
          // visual sync: mark active on bottom and side
          bottomNavItems.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          // reflect in side nav
          if (sideItems && sideItems.length) {
            sideItems.forEach(si => {
              si.classList.remove('active');
              si.setAttribute('aria-pressed', 'false');
            });

            // try to map by index or data-section:
            // prefer dataset.section on bottom nav items (if set)
            const targetSection = btn.dataset.section;
            if (targetSection) {
              const match = sideItems.find(s => s.dataset.section === targetSection);
              if (match) {
                match.classList.add('active');
                match.setAttribute('aria-pressed', 'true');
              }
            } else {
              // fallback index mapping
              const fallback = sideItems[idx];
              if (fallback) {
                fallback.classList.add('active');
                fallback.setAttribute('aria-pressed', 'true');
              }
            }
          }
        });
      });
    }

    // -------------------------
    // Initial render
    // -------------------------
    renderFilters();

    // expose minimal hooks for debugging (optional)
    window.__browse = {
      state,
      renderFilters,
      openSidebar,
      closeSidebar,
      toggleSidebar
    };
  }); // end DOMContentLoaded
})();
