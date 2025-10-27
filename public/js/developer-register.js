(function(){
  const qs = (sel) => document.querySelector(sel);
  const statusBox = qs('#status');
  const msgBox = qs('#formMessage');
  const form = qs('#devForm');
  const submitBtn = qs('#submitBtn');
  const countrySel = qs('#pais_id');

  function setStatus(text, kind='info'){
    if (!statusBox) return;
    statusBox.textContent = text;
    statusBox.classList.remove('error','ok');
    statusBox.style.display = text ? 'block' : 'none';
    if (kind === 'error') statusBox.classList.add('error');
    if (kind === 'ok') statusBox.classList.add('ok');
  }
  function showMessage(text, type='error'){
    if (!msgBox) return; 
    msgBox.innerHTML = text ? `<div class="msg ${type==='error'?'error':'success'}">${text}</div>` : '';
  }

  async function getPublicEnv(){ const r = await fetch('/api/public-env'); return r.json(); }

  async function loadCountries(){
    try {
      const r = await fetch('/api/paises');
      const { paises } = await r.json();
      const list = (paises && paises.length ? paises : [
        { id: 1, nombre: 'Colombia' },
        { id: 2, nombre: 'Chile' },
        { id: 3, nombre: 'Argentina' },
        { id: 4, nombre: 'United States' },
        { id: 5, nombre: 'Spain' },
      ]);
      list.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id; opt.textContent = p.nombre; countrySel.appendChild(opt);
      });
    } catch (e) { /* silent fallback */ }
  }

  function sanitizeNit(n){
    return String(n||'').trim();
  }

  function validate(payload){
    if (!payload.nombre_estudio) return 'El nombre del estudio es obligatorio.';
    if (!payload.razon_social) return 'La razón social es obligatoria.';
    if (!payload.nit) return 'El NIT es obligatorio.';
    if (!payload.pais_id) return 'Selecciona un país.';
    if (payload.nit.length < 5) return 'El NIT parece inválido.';
    return null;
  }

  async function prefill(client, user){
    try{
      // Prefill si ya existe registro
      const { data } = await client
        .from('desarrolladores')
        .select('nombre_estudio, razon_social, nit, direccion, pais_id, telefono, documentos, estado_verificacion')
        .eq('user_auth_id', user.id)
        .maybeSingle();
      if (data){
        qs('#nombre_estudio').value = data.nombre_estudio || '';
        qs('#razon_social').value = data.razon_social || '';
        qs('#nit').value = data.nit || '';
        qs('#direccion').value = data.direccion || '';
        qs('#telefono').value = data.telefono || '';
        try{ if (data.pais_id) countrySel.value = String(data.pais_id); } catch(_){ }
        const docs = data.documentos || {};
        qs('#website').value = docs.website || '';
        qs('#github').value = docs.github || '';
        if (data.estado_verificacion){
          setStatus(`Estado de verificación: ${data.estado_verificacion}`, data.estado_verificacion==='verificado'?'ok':'info');
          submitBtn.textContent = 'Actualizar información';
        }
      }
    } catch(e){ /* ignore */ }
  }

  async function main(){
    setStatus('Cargando...');
    await loadCountries();
    try{
      const { url, key } = await getPublicEnv();
      if (!url || !key) throw new Error('Variables públicas de Supabase no disponibles');
      const client = window.supabase.createClient(url, key);

      const { data: { user } } = await client.auth.getUser();
      if (!user){
        setStatus('No has iniciado sesión. Redirigiendo a login...', 'error');
        setTimeout(() => { window.location.href = '/html/login.html'; }, 1000);
        return;
      }

      setStatus('Listo para enviar');
      await prefill(client, user);

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        showMessage('');

        const payload = {
          user_auth_id: user.id,
          nombre_estudio: String(qs('#nombre_estudio').value || '').trim(),
          razon_social: String(qs('#razon_social').value || '').trim(),
          nit: sanitizeNit(qs('#nit').value),
          direccion: String(qs('#direccion').value || '').trim() || null,
          pais_id: countrySel.value ? Number(countrySel.value) : null,
          telefono: String(qs('#telefono').value || '').trim() || null,
          documentos: {
            website: String(qs('#website').value || '').trim() || null,
            github: String(qs('#github').value || '').trim() || null,
          },
        };

        const err = validate(payload);
        if (err){ showMessage(err, 'error'); return; }

        try{
          submitBtn.disabled = true; submitBtn.textContent = 'Enviando...';
          setStatus('Enviando solicitud...');

          // upsert por user_auth_id; RLS permite update si es dueño
          const { error, data } = await client
            .from('desarrolladores')
            .upsert(payload, { onConflict: 'user_auth_id' })
            .select('estado_verificacion')
            .single();
          if (error) {
            const m = String(error.message || '').toLowerCase();
            if (m.includes('nit')) throw new Error('El NIT ya está registrado por otra cuenta.');
            throw error;
          }

          setStatus(`Solicitud registrada. Estado: ${data?.estado_verificacion || 'pendiente'}`, 'ok');
          showMessage('Tu información fue guardada correctamente.', 'success');
          submitBtn.textContent = 'Actualizar información';

          // Redirigir opcionalmente al panel
          // setTimeout(() => { window.location.href = '/html/developer.html'; }, 1200);
        } catch(e){
          console.error(e);
          showMessage(e.message || 'No se pudo guardar la solicitud', 'error');
          setStatus('Error al guardar', 'error');
        } finally {
          submitBtn.disabled = false;
        }
      });
    } catch (e){
      console.error(e); setStatus(e.message || 'Error inicializando la página', 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', main);
})();

