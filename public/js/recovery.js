// Password recovery using Supabase magic link only (no 6-digit code)
(function(){
  const qs = (id) => document.getElementById(id);
  const step1 = qs('step1');
  const step2 = qs('step2');
  const formSend = qs('form-send');
  const formReset = qs('form-reset');
  const gotoStep2Btn = qs('gotoStep2');
  const backToStep1Btn = qs('backToStep1');
  const backBtn = qs('backBtn');
  const msg1 = qs('recoveryMessage');
  const msg2 = qs('recoveryMessage2');

  function showStep(n){
    if(n===1){ step1.classList.remove('hidden'); step2.classList.add('hidden'); }
    else { step1.classList.add('hidden'); step2.classList.remove('hidden'); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function showMessage(box, text, type='info'){
    const el = box || msg1 || msg2;
    if(!el) { alert(text); return; }
    const color = type==='error' ? 'color:#991b1b; background:#fef2f2; border:1px solid #ef4444;'
               : type==='success' ? 'color:#065f46; background:#ecfdf5; border:1px solid #10b981;'
               : 'color:#1e3a8a; background:#eff6ff; border:1px solid #93c5fd;';
    el.innerHTML = `<div style="padding:10px 12px;border-radius:12px;${color}">${text}</div>`;
  }
  async function getEnv(){ const r = await fetch('/api/public-env'); return r.json(); }

  // Parse hash tokens from magic link
  function parseHash(){
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    const q = new URLSearchParams(hash);
    return { access_token: q.get('access_token'), refresh_token: q.get('refresh_token'), type: q.get('type') };
  }

  // Step 1: send reset email
  formSend && formSend.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = (qs('email').value||'').trim();
    if(!email || !/^\S+@\S+\.\S+$/.test(email)){ showMessage(msg1,'Introduce un correo válido.','error'); return; }
    try{
      showMessage(msg1,'Enviando correo...','info');
      const { url, key } = await getEnv();
      const client = window.supabase.createClient(url, key);
      await client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/html/recovery.html` });
      sessionStorage.setItem('recovery_email', email);
      showMessage(msg1,'Te enviamos un enlace para restablecer tu contraseña. Revisa tu correo.','success');
    }catch(err){ console.error(err); showMessage(msg1,'No pudimos enviar el correo. Intenta de nuevo.','error'); }
  });

  // Step 2: set new password (requires session from magic link)
  formReset && formReset.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const pw = qs('newPassword').value||'';
    const cpw = qs('confirmPassword').value||'';
    if(pw.length < 8){ showMessage(msg2,'La contraseña debe tener al menos 8 caracteres.','error'); return; }
    if(pw !== cpw){ showMessage(msg2,'Las contraseñas no coinciden.','error'); return; }
    try{
      showMessage(msg2,'Actualizando contraseña...','info');
      const { url, key } = await getEnv();
      const client = window.supabase.createClient(url, key);
      // Asegura la sesión a partir del hash si aún no existe
      const { data: sess } = await client.auth.getSession();
      if(!sess?.session){
        const tok = parseHash();
        if (tok.access_token && tok.refresh_token){
          await client.auth.setSession({ access_token: tok.access_token, refresh_token: tok.refresh_token });
        }
      }
      const { error } = await client.auth.updateUser({ password: pw });
      if(error) throw error;
      showMessage(msg2,'Contraseña cambiada. Te llevamos al inicio de sesión...','success');
      setTimeout(()=>{ window.location.href = '/html/login.html'; }, 1200);
    }catch(err){ console.error(err); showMessage(msg2,'No pudimos cambiar la contraseña. Vuelve a abrir el enlace del correo.','error'); }
  });

  // If user arrives from magic link, go to step 2
  (function initFromLink(){
    const tok = parseHash();
    if(tok.access_token && tok.refresh_token){
      showStep(2);
      showMessage(msg2,'Enlace verificado. Establece tu nueva contraseña.','info');
    }
  })();

  // helpers
  gotoStep2Btn && gotoStep2Btn.addEventListener('click', ()=> showStep(2));
  backToStep1Btn && backToStep1Btn.addEventListener('click', ()=> showStep(1));
  backBtn && backBtn.addEventListener('click', ()=>{ if(history.length>1) history.back(); else showStep(1); });

})();