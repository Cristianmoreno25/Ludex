(function(){
  function qs(s){ return document.querySelector(s); }
  const grid = qs('#cardsGrid');

  function money(n){ return `$${Number(n||0).toFixed(2)}`; }
  function esc(s){ return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  async function getEnv(){ const r = await fetch('/api/public-env'); return r.json(); }

  async function loadGames(){
    try{
      if (!grid) return;
      // limpiar ejemplos si existen
      grid.innerHTML = '';

      const env = await getEnv();
      const client = window.supabase.createClient(env.url, env.key);

      // obtener categorías para mapear id -> nombre
      const { data: cats } = await client.from('categorias').select('id,nombre');
      const catMap = new Map((cats||[]).map(c => [c.id, c.nombre]));

      // juegos publicados
      const { data: games, error } = await client
        .from('juegos')
        .select('id, titulo, descripcion, categoria_id, precio, precio_descuento, actualizado_en, publicado_en')
        .eq('estado', 'publicado')
        .order('publicado_en', { ascending: false, nullsFirst: false })
        .order('actualizado_en', { ascending: false });
      if (error) throw error;
      const ids = (games||[]).map(g => g.id);

      // portadas (tipo 'otro') para todos los juegos a la vez
      let coversByGame = new Map();
      if (ids.length){
        const { data: covers } = await client
          .from('juego_archivos')
          .select('juego_id, storage_path, tipo')
          .in('juego_id', ids)
          .order('id', { ascending: false });
        (covers||[])
          .filter(f => f.tipo === 'otro')
          .forEach(f => { if (!coversByGame.has(f.juego_id)) coversByGame.set(f.juego_id, f.storage_path); });
      }

      // render
      const frag = document.createDocumentFragment();
      (games||[]).forEach(g => {
        const category = esc(catMap.get(g.categoria_id) || 'Action');
        const hasDiscount = g.precio_descuento && Number(g.precio_descuento) < Number(g.precio);
        const price = hasDiscount ? Number(g.precio_descuento) : Number(g.precio);

        // imagen
        let imgUrl = '../images/game1.jpg';
        const path = coversByGame.get(g.id);
        if (path){
          const { data: pub } = client.storage.from('game-images').getPublicUrl(path);
          if (pub?.publicUrl) imgUrl = pub.publicUrl;
        }

        const art = document.createElement('article');
        art.className = 'card';
        art.dataset.category = category;
        art.dataset.price = String(price);
        art.dataset.title = g.titulo;
        art.innerHTML = `
          <div class="card-media">
            <img src="${imgUrl}" alt="${esc(g.titulo)}" onerror="this.onerror=null;this.src='../images/game1.jpg'">
            ${hasDiscount ? `<span class="badge sale">-${Math.round((1 - price/Number(g.precio))*100)}%</span>` : ''}
            <button class="fav" data-game-id="${g.id}" title="Añadir a deseados">★</button>
          </div>
          <div class="card-body">
            <h3 class="card-title"><a href="./product.html">${esc(g.titulo)}</a></h3>
            <p class="card-sub">
              ${money(price)}
              ${hasDiscount ? `<span class="muted"> ${money(g.precio)} / por</span>` : '<span class="muted"> / por</span>'}
            </p>
            <button class="btn small primary add-to-cart" data-game-id="${g.id}">Añadir al carrito</button>
          </div>`;
        frag.appendChild(art);
      });
      grid.appendChild(frag);

      // enganchar acciones condicionadas por sesión
      wireActions();
    } catch(e){
      console.error('browse-data:', e);
    }
  }

  async function ensureUser(client){
    try {
      const { data: { user } } = await client.auth.getUser();
      if (!user) {
        // público puede ver, pero acciones requieren login
        window.location.href = '/html/login.html';
        return null;
      }
      return user;
    } catch { window.location.href = '/html/login.html'; return null; }
  }

  async function addToCart(client, gameId){
    // obtener o crear carrito abierto
    let carritoId = null;
    try {
      const { data: carts } = await client
        .from('carritos')
        .select('id, estado')
        .eq('estado', 'abierto')
        .limit(1);
      if (carts && carts.length) carritoId = carts[0].id;
      if (!carritoId) {
        const { data: ins } = await client
          .from('carritos')
          .insert({ estado: 'abierto' })
          .select('id')
          .single();
        carritoId = ins?.id || null;
      }
      if (!carritoId) return;

      // insertar item (trigger pone precio si no se envía)
      await client
        .from('carrito_items')
        .upsert({ carrito_id: carritoId, juego_id: gameId }, { onConflict: 'carrito_id,juego_id' });
      toast('Añadido al carrito');
    } catch (e) { console.error(e); toast('No se pudo añadir', true); }
  }

  async function toggleWishlist(client, gameId, btn){
    try {
      // comprobar si existe
      const { data: row } = await client
        .from('lista_deseos')
        .select('id')
        .eq('juego_id', gameId)
        .maybeSingle();
      if (row) {
        await client.from('lista_deseos').delete().eq('id', row.id);
        btn.classList.remove('active');
        toast('Quitado de deseados');
      } else {
        await client.from('lista_deseos').insert({ juego_id: gameId });
        btn.classList.add('active');
        toast('Añadido a deseados');
      }
    } catch(e){ console.error(e); toast('Acción no disponible', true); }
  }

  function toast(text, isError=false){
    try{
      const t = document.createElement('div');
      t.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:9999;padding:10px 12px;border-radius:12px;color:#fff;box-shadow:0 10px 22px rgba(0,0,0,.25);';
      t.style.background = isError ? '#ef4444' : '#10b981';
      t.textContent = text;
      document.body.appendChild(t);
      setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity .25s'; }, 1100);
      setTimeout(()=> t.remove(), 1400);
    } catch{}
  }

  async function wireActions(){
    const env = await getEnv();
    const client = window.supabase.createClient(env.url, env.key);

    // carrito
    document.querySelectorAll('.add-to-cart').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const user = await ensureUser(client);
        if (!user) return;
        const gid = Number(btn.getAttribute('data-game-id'));
        if (!gid) return;
        await addToCart(client, gid);
      });
    });

    // wishlist
    document.querySelectorAll('.card .fav').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const user = await ensureUser(client);
        if (!user) return;
        const gid = Number(btn.getAttribute('data-game-id'));
        if (!gid) return;
        await toggleWishlist(client, gid, btn);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', loadGames);
})();

