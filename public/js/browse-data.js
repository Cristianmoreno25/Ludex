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
            <img src="${imgUrl}" alt="${esc(g.titulo)}">
            ${hasDiscount ? `<span class="badge sale">-${Math.round((1 - price/Number(g.precio))*100)}%</span>` : ''}
            <button class="fav">★</button>
          </div>
          <div class="card-body">
            <h3 class="card-title"><a href="./product.html">${esc(g.titulo)}</a></h3>
            <p class="card-sub">
              ${money(price)}
              ${hasDiscount ? `<span class="muted"> ${money(g.precio)} / por</span>` : '<span class="muted"> / por</span>'}
            </p>
            <button class="btn small primary">Añadir al carrito</button>
          </div>`;
        frag.appendChild(art);
      });
      grid.appendChild(frag);
    } catch(e){
      console.error('browse-data:', e);
    }
  }

  document.addEventListener('DOMContentLoaded', loadGames);
})();

