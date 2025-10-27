(function(){
  const fileInput = document.getElementById('archivo');
  const btn = document.getElementById('uploadNext');
  const statusBox = document.getElementById('uploadStatus');

  async function getEnv(){ const r = await fetch('/api/public-env'); return r.json(); }

  function setStatus(t, ok=false){ statusBox.innerHTML = `<div class="${ok?'msg-success':'msg-error'}">${t}</div>`; }

  function typeFromName(name){
    const ext = (name.split('.').pop()||'').toLowerCase();
    if (["exe","msi","apk","dmg"].includes(ext)) return 'ejecutable';
    return 'instalador';
  }

  btn?.addEventListener('click', async ()=>{
    try{
      const gameId = Number(sessionStorage.getItem('new_game_id')||'');
      if (!gameId) { alert('Falta el juego. Vuelve al paso anterior.'); window.location.href='/html/add-game.html'; return; }
      const file = fileInput?.files?.[0];
      if (!file) { alert('Selecciona un archivo'); return; }
      btn.disabled = true; btn.textContent = 'Subiendo...';
      setStatus('Subiendo archivo...');

      const env = await getEnv();
      const client = window.supabase.createClient(env.url, env.key);
      const { data: { user } } = await client.auth.getUser();
      if (!user) { window.location.href = '/html/login.html'; return; }

      const ext = (file.name.split('.').pop()||'zip').toLowerCase();
      const path = `games/${gameId}/build-${Date.now()}.${ext}`;
      const { error: upErr } = await client.storage.from('game-files').upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      await client.from('juego_archivos').insert({ juego_id: gameId, tipo: typeFromName(file.name), storage_path: path, size_bytes: file.size });
      setStatus('Archivo subido correctamente', true);
      window.location.href = '/html/add-game-terminar.html';
    } catch(e){
      console.error(e); setStatus(e.message||'No se pudo subir el archivo');
    } finally {
      btn.disabled = false; btn.textContent = 'Siguiente';
    }
  });
})();

