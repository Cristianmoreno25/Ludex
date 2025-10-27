(function(){
  const qs = (s)=>document.querySelector(s);
  const msg = qs('#editMsg');
  const nombre = qs('#nombre');
  const categoriaSel = qs('#categoria');
  const precio = qs('#precio');
  const descripcion = qs('#descripcion');
  const coverInput = qs('#cover');
  const coverPreview = qs('#coverPreview');
  const estadoLabel = qs('#estadoLabel');
  const saveBtn = qs('#saveBtn');
  const toReviewBtn = qs('#toReviewBtn');

  function setMsg(t, kind='info'){
    if (!msg) return;
    const cls = kind==='error' ? 'msg-error' : (kind==='success'?'msg-success':'msg-info');
    msg.innerHTML = `<div class="${cls}" style="padding:10px;border-radius:12px">${t}</div>`;
  }

  function showToast(text){
    const toast = document.createElement('div');
    toast.style.cssText = [
      'position:fixed','right:16px','bottom:16px','z-index:9999','max-width:340px',
      'padding:12px 14px','border-radius:14px','color:#fff',
      'box-shadow:0 12px 24px rgba(0,0,0,.25)',
      'background:linear-gradient(135deg,#22c55e,#16a34a)'
    ].join(';');
    toast.textContent = text;
    document.body.appendChild(toast);
    setTimeout(()=>{ toast.style.opacity='0'; toast.style.transition='opacity .3s'; }, 1200);
    setTimeout(()=>{ toast.remove(); }, 1600);
  }

  function previewCover(file){
    if (!file) { coverPreview.innerHTML = ''; return; }
    const url = URL.createObjectURL(file);
    coverPreview.innerHTML = `<img src="${url}" alt="preview" style="max-width:280px;border-radius:12px;border:1px solid #22324e">`;
  }

  function getId(){
    const p = new URLSearchParams(location.search);
    const id = Number(p.get('id')||'');
    if (!id) { location.href = '/html/developer.html'; }
    return id;
  }

  async function getEnv(){ const r = await fetch('/api/public-env'); return r.json(); }

  coverInput?.addEventListener('change', (e)=>{
    const f = e.target.files?.[0];
    previewCover(f);
  });

  async function loadCategorias(client){
    const { data } = await client.from('categorias').select('id,nombre').order('nombre');
    categoriaSel.innerHTML = '<option value="">Selecciona una categoría</option>' +
      (data||[]).map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
  }

  function setEditableByEstado(estado){
    // Ahora siempre editable; solo impedimos que el dev publique directamente (lo hace el trigger en BD)
    [nombre, categoriaSel, precio, descripcion, coverInput, saveBtn, toReviewBtn].forEach(el => el && (el.disabled = false));
    estadoLabel.textContent = estado;
    estadoLabel.className = 'badge ' + (estado==='publicado' ? 'bg-success' : (estado==='revision' ? 'bg-warning' : 'bg-secondary'));
  }

  async function loadGame(){
    const env = await getEnv();
    const client = window.supabase.createClient(env.url, env.key);
    const { data: { user } } = await client.auth.getUser();
    if (!user) { location.href = '/html/login.html'; return; }
    const id = getId();
    await loadCategorias(client);
    const { data: game, error } = await client
      .from('juegos')
      .select('*')
      .eq('id', id)
      .eq('developer_auth_id', user.id)
      .maybeSingle();
    if (error || !game) { setMsg('No se pudo cargar el juego', 'error'); return; }

    nombre.value = game.titulo || '';
    precio.value = Number(game.precio || 0).toString();
    descripcion.value = game.descripcion || '';
    try { if (game.categoria_id) categoriaSel.value = String(game.categoria_id); } catch{}
    setEditableByEstado(game.estado);

    // cargar portada actual si existe en juego_archivos (tipo 'otro')
    try {
      const { data: files } = await client
        .from('juego_archivos')
        .select('storage_path, tipo')
        .eq('juego_id', id)
        .order('id', { ascending: false });
      const cover = (files||[]).find(f => f.tipo === 'otro');
      if (cover) {
        const { data: pub } = client.storage.from('game-images').getPublicUrl(cover.storage_path);
        if (pub?.publicUrl) {
          coverPreview.innerHTML = `<img src="${pub.publicUrl}" alt="cover" style="max-width:280px;border-radius:12px;border:1px solid #22324e">`;
        }
      }
    } catch {}

    // Guardar cambios
    saveBtn?.addEventListener('click', async ()=>{
      try{
        saveBtn.disabled = true; setMsg('Guardando...');
        const patch = {
          titulo: nombre.value.trim(),
          categoria_id: categoriaSel.value ? Number(categoriaSel.value) : null,
          precio: Number(precio.value || 0),
          descripcion: descripcion.value.trim() || null,
        };
        const { error: upErr } = await client.from('juegos').update(patch).eq('id', id).eq('developer_auth_id', user.id);
        if (upErr) throw upErr;

        const file = coverInput?.files?.[0];
        if (file) {
          const ext = (file.name.split('.').pop()||'png').toLowerCase();
          const path = `games/${id}/cover-${Date.now()}.${ext}`;
          const { error: up } = await client.storage.from('game-images').upload(path, file, { upsert: true });
          if (!up) {
            await client.from('juego_archivos').insert({ juego_id: id, tipo: 'otro', storage_path: path, size_bytes: file.size });
          }
        }
        setMsg('Cambios guardados.', 'success');
        showToast('¡Cambios guardados con éxito!');
        setTimeout(()=>{ location.href = '/html/developer.html'; }, 800);
      } catch(e){ setMsg(e.message||'No se pudo guardar', 'error'); }
      finally { saveBtn.disabled = false; }
    });

    // Enviar a revisión
    toReviewBtn?.addEventListener('click', async ()=>{
      try{
        toReviewBtn.disabled = true; setMsg('Enviando a revisión...');
        const { error: upErr } = await client
          .from('juegos')
          .update({ estado: 'revision' })
          .eq('id', id)
          .eq('developer_auth_id', user.id);
        if (upErr) throw upErr;
        setMsg('Enviado a revisión. Te notificaremos al publicarse.', 'success');
        setTimeout(()=> location.href='/html/developer.html', 900);
      } catch(e){ setMsg(e.message||'No se pudo enviar', 'error'); }
      finally { toReviewBtn.disabled = false; }
    });
  }

  loadGame();
})();
