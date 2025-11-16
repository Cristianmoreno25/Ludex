// public/js/carrito.js
// Manejo del carrito: lista items, imágenes desde storage, actualizar cantidad, eliminar y checkout.

(function () {
    const qs = (s) => document.querySelector(s);
    const qsa = (s) => Array.from(document.querySelectorAll(s));

    async function getEnv() {
        const res = await fetch('/api/public-env');
        return res.ok ? res.json() : { url: null, key: null };
    }

    function money(n) {
        return `$${Number(n || 0).toFixed(2)}`;
    }

    async function ensureUser(client) {
        try {
        const { data } = await client.auth.getUser();
        const user = data?.user ?? null;
        if (!user) {
            window.location.href = '/html/login.html';
            return null;
        }
        return user;
        } catch (err) {
        window.location.href = '/html/login.html';
        return null;
        }
    }

    function renderEmpty() {
        const container = qs('#cartItems');
        if (!container) return;
        container.innerHTML = '<div class="empty">Tu carrito está vacío.</div>';
        const totalItemsEl = qs('#totalItems');
        const totalMontoEl = qs('#totalMonto');
        if (totalItemsEl) totalItemsEl.textContent = '0';
        if (totalMontoEl) totalMontoEl.textContent = money(0);
    }

    function buildItemNode(item) {
        const div = document.createElement('div');
        div.className = 'cart-item card';
        div.dataset.itemId = item.id;

        const imgSrc = item.juego?.cover || '../images/juego1.png';

        div.innerHTML =
        '<div class="card-row">' +
        '<div class="thumb"><img src="' +
        imgSrc +
        '" alt="' +
        (item.juego?.titulo || 'Juego') +
        '"></div>' +
        '<div class="item-info">' +
        '<h3>' +
        (item.juego?.titulo || '—') +
        '</h3>' +
        '<p class="unit">Precio unitario: ' +
        money(item.precio_unitario) +
        '</p>' +
        '<p class="subtotal">Subtotal: <span class="subtotal-val">' +
        money(item.cantidad * item.precio_unitario) +
        '</span></p>' +
        '<div class="quantity">' +
        '<button class="decrease btn-qty">-</button>' +
        '<span class="qty">' +
        item.cantidad +
        '</span>' +
        '<button class="increase btn-qty">+</button>' +
        '<button class="remove btn small warn">Eliminar</button>' +
        '</div>' +
        '</div>' +
        '</div>';

        return div;
    }

    async function loadCart() {
        try {
        const env = await getEnv();
        if (!env || !env.url || !env.key) {
            console.error('No env for supabase');
            renderEmpty();
            return;
        }

        window.supabase = window.supabase || supabase; // si ya existe en la ventana
        const client = window.supabase.createClient(env.url, env.key);

        const user = await ensureUser(client);
        if (!user) return;

        // Obtener carrito abierto del usuario
        const { data: carts, error: cartsErr } = await client
            .from('carritos')
            .select('id, total_items, total_monto')
            .eq('estado', 'abierto')
            .limit(1);

        if (cartsErr) {
            console.error('Error fetching carts', cartsErr);
            renderEmpty();
            return;
        }

        const carritoId = carts && carts.length ? carts[0].id : null;
        if (!carritoId) {
            renderEmpty();
            return;
        }

        // Obtener items del carrito
        const { data: items, error: itemsErr } = await client
            .from('carrito_items')
            .select('id, juego_id, cantidad, precio_unitario')
            .eq('carrito_id', carritoId);

        if (itemsErr) {
            console.error('Error fetching carrito_items', itemsErr);
            renderEmpty();
            return;
        }

        if (!items || items.length === 0) {
            renderEmpty();
            return;
        }

        // Obtener detalles de juegos (en paralelo)
        const juegoIds = Array.from(new Set(items.map((it) => it.juego_id)));
        const juegosPromises = juegoIds.map((id) =>
            client.from('juegos').select('id, titulo, slug, precio, precio_descuento').eq('id', id).maybeSingle()
        );
        const juegosRes = await Promise.all(juegosPromises);
        const juegosById = {};
        juegosRes.forEach((r) => {
            if (r && r.data) juegosById[r.data.id] = r.data;
        });

        // Obtener archivos (covers) para los juegos en una sola consulta
        const { data: filesRes, error: filesErr } = await client
            .from('juego_archivos')
            .select('juego_id, storage_path')
            .in('juego_id', juegoIds)
            .eq('tipo', 'otro'); // asumimos portada como tipo 'otro' o ajústalo si en tu proyecto es diferente

        const filesByJuego = {};
        if (!filesErr && Array.isArray(filesRes)) {
            filesRes.forEach((f) => {
            if (f && f.juego_id) filesByJuego[f.juego_id] = f.storage_path;
            });
        }

        // Construir UI con URLs públicas de storage si existen
        const container = qs('#cartItems');
        if (!container) return;
        container.innerHTML = '';

        let totalItems = 0;
        let totalMonto = 0;

        for (const it of items) {
            const juego = juegosById[it.juego_id] ? { ...juegosById[it.juego_id] } : null;

            // Si existe storage_path, obtener publicUrl desde el bucket 'game-images'
            if (filesByJuego[it.juego_id]) {
            try {
                const path = filesByJuego[it.juego_id];
                const { data: pub } = client.storage.from('game-images').getPublicUrl(path);
                juego.cover = (pub && pub.publicUrl) ? pub.publicUrl : null;
            } catch (err) {
                console.warn('No se pudo obtener publicUrl', err);
                juego.cover = null;
            }
            } else {
            juego.cover = null;
            }

            const obj = { id: it.id, juego, cantidad: it.cantidad, precio_unitario: Number(it.precio_unitario) };
            const node = buildItemNode(obj);
            container.appendChild(node);
            totalItems += obj.cantidad;
            totalMonto += obj.cantidad * obj.precio_unitario;
        }

        const totalItemsEl = qs('#totalItems');
        const totalMontoEl = qs('#totalMonto');
        if (totalItemsEl) totalItemsEl.textContent = String(totalItems);
        if (totalMontoEl) totalMontoEl.textContent = money(totalMonto);

        // Attach handlers
        qsa('.cart-item').forEach((ci) => {
            const dec = ci.querySelector('.decrease');
            const inc = ci.querySelector('.increase');
            const qtySpan = ci.querySelector('.qty');
            const removeBtn = ci.querySelector('.remove');
            const itemId = Number(ci.dataset.itemId);

            if (dec) {
            dec.addEventListener('click', async () => {
                let q = Number(qtySpan.textContent);
                if (q <= 1) return;
                q = q - 1;
                await updateQuantity(itemId, q);
                await reloadTotals();
            });
            }

            if (inc) {
            inc.addEventListener('click', async () => {
                let q = Number(qtySpan.textContent);
                q = q + 1;
                await updateQuantity(itemId, q);
                await reloadTotals();
            });
            }

            if (removeBtn) {
            removeBtn.addEventListener('click', async () => {
                if (!confirm('¿Eliminar este producto del carrito?')) return;
                await removeItem(itemId);
                await reloadTotals();
            });
            }
        });
        } catch (e) {
        console.error('Error cargando carrito:', e);
        renderEmpty();
        }
    }

    async function updateQuantity(itemId, cantidad) {
        try {
        const env = await getEnv();
        const client = window.supabase.createClient(env.url, env.key);
        await client.from('carrito_items').update({ cantidad }).eq('id', itemId);
        } catch (err) {
        console.error('Error updating quantity', err);
        }
    }

    async function removeItem(itemId) {
        try {
        const env = await getEnv();
        const client = window.supabase.createClient(env.url, env.key);
        await client.from('carrito_items').delete().eq('id', itemId);
        } catch (err) {
        console.error('Error removing item', err);
        }
    }

    async function reloadTotals() {
        await loadCart();
    }

    async function doCheckout() {
        try {
        const env = await getEnv();
        const client = window.supabase.createClient(env.url, env.key);
        const { data, error } = await client.rpc('checkout_carrito');
        if (error) {
            console.error('Checkout error', error);
            alert('No fue posible completar el pago');
            return;
        }
        alert('Pago simulado realizado. ¡Gracias!');
        window.location.href = '/html/library.html';
        } catch (err) {
        console.error('Error en checkout', err);
        alert('No fue posible completar el pago');
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        loadCart();
        const cb = qs('#checkoutBtn');
        if (cb) cb.addEventListener('click', doCheckout);
    });
})();
