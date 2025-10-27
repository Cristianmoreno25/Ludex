(function(){
  const qs = (s)=>document.querySelector(s);
  const categoriaSel = qs('#categoria');
  const nextBtn = qs('#nextBtn');
  const coverInput = qs('#cover');
  const coverPreview = qs('#coverPreview');

  function previewCover(file){
    if (!file) { coverPreview.innerHTML=''; return; }
    const url = URL.createObjectURL(file);
    coverPreview.innerHTML = `<img src="${url}" alt="preview" style="max-width:260px;border-radius:12px;border:1px solid #22324e">`;
  }

  async function getEnv(){ const r = await fetch('/api/public-env'); return r.json(); }

  async function ensureVerifiedDev(client){
    const { data: { user } } = await client.auth.getUser();
    if (!user) { window.location.href = '/html/login.html'; return Promise.reject('no user'); }
    const { data } = await client.from('desarrolladores').select('estado_verificacion').eq('user_auth_id', user.id).maybeSingle();
    if (!data || data.estado_verificacion !== 'verificado') {
      window.location.href = '/html/developer-register.html';
      return Promise.reject('not verified');
    }
    return user;
  }

  async function loadCategorias(client){
    const { data, error } = await client.from('categorias').select('id,nombre').order('nombre');
    if (error) { categoriaSel.innerHTML = '<option value="">Error cargando categorías</option>'; return; }
    categoriaSel.innerHTML = '<option value="">Selecciona una categoría</option>' +
      (data||[]).map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
  }

  coverInput?.addEventListener('change', (e)=>{
    const f = e.target.files?.[0];
    previewCover(f);
  });

  nextBtn?.addEventListener('click', async ()=>{
    try{
      nextBtn.disabled = true; nextBtn.textContent = 'Procesando...';
      const env = await getEnv();
      const client = window.supabase.createClient(env.url, env.key);
      const user = await ensureVerifiedDev(client);

      const titulo = qs('#nombre').value.trim();
      const categoria_id = categoriaSel.value ? Number(categoriaSel.value) : null;
      const precio = Number(qs('#precio').value || 0);
      const descripcion = qs('#descripcion').value.trim() || null;
      if (!titulo || !categoria_id || isNaN(precio)) { alert('Completa título, categoría y precio.'); return; }

      // 1) Crear juego en borrador
      const { data: ins, error: insErr } = await client
        .from('juegos')
        .insert({ developer_auth_id: user.id, titulo, categoria_id, precio, descripcion, estado: 'borrador' })
        .select('id')
        .single();
      if (insErr) throw insErr;
      const gameId = ins.id;

      // 2) Subir portada (opcional) a bucket público 'game-images' y registrar en juego_archivos
      const file = coverInput?.files?.[0];
      if (file) {
        const ext = (file.name.split('.').pop()||'png').toLowerCase();
        const path = `games/${gameId}/cover-${Date.now()}.${ext}`;
        const { error: upErr } = await client.storage.from('game-images').upload(path, file, { upsert: true });
        if (!upErr) {
          await client.from('juego_archivos').insert({ juego_id: gameId, tipo: 'otro', storage_path: path, size_bytes: file.size });
        }
      }

      // Guardar id temporal y pasar al paso de archivos
      sessionStorage.setItem('new_game_id', String(gameId));
      window.location.href = '/html/add-game-archivo.html';
    } catch(e){
      console.error(e); alert(e.message || 'No se pudo crear el juego');
    } finally {
      nextBtn.disabled = false; nextBtn.textContent = 'Siguiente';
    }
  });

  (async function init(){
    try{
      const env = await getEnv();
      const client = window.supabase.createClient(env.url, env.key);
      await ensureVerifiedDev(client);
      await loadCategorias(client);
    } catch {}
  })();
})();

