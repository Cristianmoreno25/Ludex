// Simple client-side flow for password recovery (front-end only placeholders)
document.addEventListener('DOMContentLoaded', function () {
  const step1 = document.getElementById('step1');
  const step2 = document.getElementById('step2');

  const formSend = document.getElementById('form-send');
  const formReset = document.getElementById('form-reset');

  const gotoStep2Btn = document.getElementById('gotoStep2');
  const backToStep1Btn = document.getElementById('backToStep1');
  const backBtn = document.getElementById('backBtn');

  // show/hide helpers
  function showStep(n) {
    if (n === 1) {
      step1.classList.remove('hidden');
      step2.classList.add('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      step1.classList.add('hidden');
      step2.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Step1: submit email to "send" code
  formSend.addEventListener('submit', function (e) {
    e.preventDefault();
    const email = (document.getElementById('email').value || '').trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      alert('Introduce un correo válido.');
      return;
    }

    // Placeholder: aquí podrías llamar a tu API que envía el correo:
    // fetch('/api/auth/send-reset', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email }) })

    alert('Correo de verificación enviado (placeholder) a: ' + email);
    showStep(2);
  });

  // Step2: submit code + new password
  formReset.addEventListener('submit', function (e) {
    e.preventDefault();
    const code = (document.getElementById('code').value || '').trim();
    const pw = (document.getElementById('newPassword').value || '');
    const cpw = (document.getElementById('confirmPassword').value || '');

    if (!/^\d{4,6}$/.test(code)) {
      alert('Introduce un código válido (4-6 dígitos).');
      return;
    }
    if (pw.length < 6) {
      alert('La contraseña debe contener al menos 6 caracteres.');
      return;
    }
    if (pw !== cpw) {
      alert('Las contraseñas no coinciden.');
      return;
    }

    // Placeholder: enviar al backend para verificar el código y reemplazar contraseña
    // fetch('/api/auth/reset', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ code, password: pw }) })

    alert('Contraseña cambiada (placeholder). Ahora puedes iniciar sesión con tu nueva contraseña.');
    // opcional: redirigir a login
    // window.location.href = '/login.html';
    showStep(1); // volver a primer paso o redirigir
  });

  // quick navigation
  gotoStep2Btn.addEventListener('click', function () { showStep(2); });
  backToStep1Btn.addEventListener('click', function () { showStep(1); });

  // back button (topbar) simple behavior: history back if available
  backBtn && backBtn.addEventListener('click', function () {
    if (window.history.length > 1) window.history.back();
    else showStep(1);
  });

  // init: ensure step1 visible
  showStep(1);
});
