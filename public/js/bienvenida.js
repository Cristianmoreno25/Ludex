/*// Ludex landing — interactions with register/login + single access CTA
document.addEventListener('DOMContentLoaded', function(){
  // possible elements: desktop card button and mobile sticky button
  var accessDesktop = document.getElementById('accessBtn');
  var accessMobile = document.getElementById('accessBtn-mobile');

  function accessAsGuest(){
    // Aquí reemplaza con la lógica real (navegación / token guest)
    window.alert('Entrando como invitado (placeholder)');
    // ejemplo: window.location.href = '/app/dashboard';
  }

  if(accessDesktop){
    accessDesktop.addEventListener('click', accessAsGuest);
  }
  if(accessMobile){
    accessMobile.addEventListener('click', accessAsGuest);
  }
});*/
