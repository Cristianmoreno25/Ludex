// Minimal interactions: reveal-on-scroll, parallax hero, FAQ accordion
(function(){
  document.addEventListener('DOMContentLoaded', function(){
    // Reveal on scroll
    const revealEls = Array.from(document.querySelectorAll('.reveal'));
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in-view'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
    revealEls.forEach(el=>io.observe(el));

    // Parallax (subtle) for hero illustration
    const art = document.getElementById('heroArt');
    if (art) {
      const onMove = (y) => {
        const offset = Math.max(-10, Math.min(10, y * 0.04));
        art.style.transform = `translateY(${offset}px)`;
      };
      window.addEventListener('scroll', ()=> onMove(window.scrollY));
      window.addEventListener('mousemove', (e)=> onMove((e.clientY - (window.innerHeight/2))/20));
    }

    // FAQ accordion
    document.querySelectorAll('.faq-item .faq-q').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const item = btn.closest('.faq-item');
        const open = item.classList.contains('open');
        document.querySelectorAll('.faq-item.open').forEach(i=> i.classList.remove('open'));
        if (!open) item.classList.add('open');
      });
    });
  });
})();

