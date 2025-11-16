// public/html/wishlist.js
(function () {
  const API_LISTA = '/api/lista-deseos';
  const LOGIN_URL = '/html/login.html';
  const BC_NAME = 'ludex-wishlist';
  const GAME_DETAIL_URL = (id, slug) => `/juego/${slug ?? id}`; // ajusta ruta si tu detalle usa otra
  const PLACEHOLDER = '/placeholder-game.png';

  function toast(msg) {
    if (window.__toast__) { window.__toast__(msg); return; }
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.position = 'fixed';
    el.style.bottom = '22px';
    el.style.right = '22px';
    el.style.padding = '10px 14px';
    el.style.background = '#0b74ff';
    el.style.color = 'white';
    el.style.borderRadius = '8px';
    el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';
    el.style.zIndex = 99999;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  function ensureContainer() {
    let c = document.querySelector('#wishlist-grid');
    if (!c) {
      c = document.createElement('div');
      c.id = 'wishlist-grid';
      c.style.display = 'flex';
      c.style.flexWrap = 'wrap';
      c.style.gap = '18px';
      c.style.marginTop = '20px';
      const target = document.querySelector('main') || document.body;
      target.appendChild(c);
    }
    return c;
  }

  function formatDateDistance(d) {
    try {
      const date = new Date(d);
      const diff = Date.now() - date.getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'justo ahora';
      if (mins < 60) return `${mins} min`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours} h`;
      const days = Math.floor(hours / 24);
      return `${days} d`;
    } catch { return '--'; }
  }

  function updateHeaderMeta(lista) {
    const countEl = document.querySelector('#wishlist-count');
    const updatedEl = document.querySelector('#wishlist-updated');

    if (countEl) countEl.textContent = String(lista.length);
    if (updatedEl) {
      // tomar última fecha max(created_at)
      const fechas = lista.map(it => (it.creado_en || (it.juegos && it.juegos.creado_en) || null)).filter(Boolean);
      if (fechas.length === 0) {
        updatedEl.textContent = '--';
      } else {
        const latest = fechas.reduce((a, b) => (new Date(a) > new Date(b) ? a : b));
        updatedEl.textContent = formatDateDistance(latest);
      }
    }
  }

  function makeCard(item) {
    const juego = item.juegos ?? {};
    const juegoId = juego.id ?? item.juego_id;
    const title = juego.titulo ?? juego.nombre ?? `Juego #${juegoId}`;
    const slug = juego.slug ?? null;
    const image = juego.portada_url ?? juego.cover_url ?? PLACEHOLDER;
    const precio = Number(juego.precio ?? 0);
    const precioDesc = Number(juego.precio_descuento ?? 0);

    const card = document.createElement('div');
    card.className = 'wishlist-card';

    // media (click al detalle)
    const media = document.createElement('a');
    media.href = GAME_DETAIL_URL(juegoId, slug);
    media.className = 'wishlist-card-media';
    media.style.backgroundImage = `url(${image})`;

    // cuerpo
    const body = document.createElement('div');
    body.className = 'wishlist-card-body';

    const titleEl = document.createElement('h4');
    titleEl.textContent = title;
    titleEl.className = 'wishlist-card-title';

    // precio y acciones
    const row = document.createElement('div');
    row.className = 'wishlist-price-row';

    const priceEl = document.createElement('div');
    priceEl.className = 'wishlist-price';
    if (precioDesc > 0 && precioDesc < precio) {
      priceEl.innerHTML = `<span class="price-current">$${precioDesc}</span><del>$${precio}</del>`;
    } else {
      priceEl.textContent = `$${precio}`;
    }

    const actions = document.createElement('div');
    actions.className = 'wishlist-card-actions';

    // boton "Añadir al carrito" => redirige al detalle (desde ahí se compra)
    const buyBtn = document.createElement('a');
    buyBtn.href = GAME_DETAIL_URL(juegoId, slug);
    buyBtn.className = 'btn-add-cart';
    buyBtn.innerHTML = '<i class="fa-solid fa-cart-shopping" aria-hidden="true"></i><span>Añadir al carrito</span>';
    buyBtn.setAttribute('aria-label', `Añadir ${title} al carrito`);

    // boton eliminar (estrella)
    const starBtn = document.createElement('button');
    starBtn.title = 'Eliminar de la lista';
    starBtn.dataset.juegoId = String(juegoId);
    starBtn.className = 'star-delete';
    starBtn.type = 'button';
    starBtn.textContent = '★';

    starBtn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const id = starBtn.dataset.juegoId;
      try {
        const res = await fetch(`${API_LISTA}?juegoId=${id}`, { method: 'DELETE', credentials: 'include' });
        if (res.status === 401) { window.location.href = LOGIN_URL; return; }
        const payload = await res.json();
        if (!res.ok) throw payload?.error || new Error('Error al eliminar');
        toast(payload.message ?? 'Eliminado de la lista de deseos');
        try { new BroadcastChannel(BC_NAME).postMessage({ type: 'wishlist:removed', juegoId: id }); } catch {}
        card.remove();
        // actualizar contador
        const grid = document.querySelector('#wishlist-grid');
        if (grid) updateHeaderMeta(Array.from(grid.children).map(c => c.dataset._wishlist_item || {}));
      } catch (err) {
        console.error(err);
        toast('No se pudo eliminar de la lista');
      }
    });

    actions.appendChild(buyBtn);
    actions.appendChild(starBtn);

    row.appendChild(priceEl);
    row.appendChild(actions);

    body.appendChild(titleEl);
    body.appendChild(row);

    card.appendChild(media);
    card.appendChild(body);
    return card;
  }

  async function fetchAndRender() {
    const container = ensureContainer();
    container.innerHTML = '';
    const loading = document.createElement('div');
    loading.textContent = 'Cargando...';
    loading.style.color = '#666';
    container.appendChild(loading);

    try {
      const res = await fetch(API_LISTA, { method: 'GET', credentials: 'include' });
      if (res.status === 401) {
        // no session o cookie no enviada -> redirigir al login (mantener comportamiento actual)
        window.location.href = LOGIN_URL;
        return;
      }
      const payload = await res.json();
      container.innerHTML = '';
      const lista = payload?.wishlist ?? [];
      updateHeaderMeta(lista);
      if (!lista || lista.length === 0) {
        const p = document.createElement('p');
        p.textContent = 'No tienes juegos en tu lista de deseos.';
        p.style.color = '#666';
        container.appendChild(p);
        return;
      }

      // renderizar orden natural (puedes cambiar orden)
      lista.forEach((row) => {
        const card = makeCard(row);
        // guardar metadata si se quiere usar luego
        card.dataset._wishlist_item = JSON.stringify({ juego_id: row.juego_id, id: row.id });
        container.appendChild(card);
      });
    } catch (err) {
      console.error('Error fetching wishlist', err);
      container.innerHTML = '';
      const p = document.createElement('p');
      p.textContent = 'Error cargando la lista de deseos.';
      p.style.color = '#d63447';
      container.appendChild(p);
    }
  }

  // Broadcast: si se añade/quita desde otra pestaña -> recargar
  try {
    const bc = new BroadcastChannel(BC_NAME);
    bc.onmessage = (ev) => {
      const { type } = ev.data || {};
      if (['wishlist:added', 'wishlist:removed', 'wishlist:updated'].includes(type)) {
        fetchAndRender();
      }
    };
  } catch (e) {
    // fallback: storage event
    window.addEventListener('storage', (ev) => {
      if (ev.key === 'ludex:wishlist:changed') fetchAndRender();
    });
  }

  document.addEventListener('DOMContentLoaded', fetchAndRender);
  window.__ludex_wishlist_reload = fetchAndRender;
})();
