(function(){
  const btn = document.getElementById('finishBtn');
  const msg = document.getElementById('finishMsg');

  function setMsg(t, ok=false){ msg.innerHTML = `<div class="${ok?'msg-success':'msg-error'}">${t}</div>`; }
  async function getEnv(){ const r = await fetch('/api/public-env'); return r.json(); }

  btn?.addEventListener('click', async ()=>{
    try{
      const gameId = Number(sessionStorage.getItem('new_game_id')||'');
      if (!gameId) { window.location.href='/html/add-game.html'; return; }
      btn.disabled = true; btn.textContent = 'Enviando...'; setMsg('Enviando a revisión...');
      const env = await getEnv();
      const client = window.supabase.createClient(env.url, env.key);
      const { data: { user } } = await client.auth.getUser();
      if (!user) { window.location.href = '/html/login.html'; return; }

      // Cambiar estado a 'revision'
      const { error } = await client
        .from('juegos')
        .update({ estado: 'revision' })
        .eq('id', gameId)
        .eq('developer_auth_id', user.id);
      if (error) throw error;

      setMsg('Tu juego fue enviado a revisión. Te notificaremos al publicarse.', true);
      // limpiar id temporal y volver al panel
      try{ sessionStorage.removeItem('new_game_id'); } catch{}
      setTimeout(()=> window.location.href='/html/developer.html', 1000);
    } catch(e){
      console.error(e); setMsg(e.message||'No se pudo finalizar');
    } finally { btn.disabled = false; btn.textContent = 'Enviar a revisión'; }
  });
})();

