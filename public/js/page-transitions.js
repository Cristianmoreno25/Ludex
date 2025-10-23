// Page transitions: View Transitions API with fade fallback + parallax + accordion
(function(){
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ready(fn){ if(document.readyState!=='loading'){ fn(); } else { document.addEventListener('DOMContentLoaded', fn); } }

  ready(function(){
    // Remove preload class to allow initial fade-in if present
    document.documentElement.classList.remove('pt-preload');

    // Reveal on scroll (complementary to landing-effects if present)
    if (!reduce && 'IntersectionObserver' in window){
      const revealEls = Array.from(document.querySelectorAll('.reveal'));
      const io = new IntersectionObserver((entries)=>{
        entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in-view'); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
      revealEls.forEach(el=>io.observe(el));
    }

    // Parallax for hero art
    const art = document.getElementById('heroArt');
    if (art && !reduce) {
      const onMove = (y) => {
        const offset = Math.max(-10, Math.min(10, y * 0.04));
        art.style.transform = `translateY(${offset}px)`;
      };
      window.addEventListener('scroll', ()=> onMove(window.scrollY));
      window.addEventListener('mousemove', (e)=> onMove((e.clientY - (window.innerHeight/2))/20));
    }

    // FAQ accordion (if present)
    document.querySelectorAll('.faq-item .faq-q').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const item = btn.closest('.faq-item');
        const open = item.classList.contains('open');
        document.querySelectorAll('.faq-item.open').forEach(i=> i.classList.remove('open'));
        if (!open) item.classList.add('open');
      });
    });

    // Link transitions
    if (!reduce) {
      const links = document.querySelectorAll('a[href]:not([target="_blank"])');
      links.forEach(a=>{
        const href = a.getAttribute('href') || '';
      	if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
        const url = new URL(a.href, location.href);
        if (url.origin !== location.origin) return;
        if (a.dataset.noTransition === 'true') return;
        a.addEventListener('click', function(e){
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // allow open in new tab
          e.preventDefault();
          const go = () => { window.location.href = a.href; };
          if (document.startViewTransition) {
            const cls = a.dataset.anim; if(cls){ document.documentElement.classList.add(cls); } const vt = document.startViewTransition(go); vt.finished.finally(()=>{ if(cls){ document.documentElement.classList.remove(cls); } });
          } else {
            document.documentElement.classList.add('fade-out');
            setTimeout(go, 80);
          }
        });
      });
    }

    // Prefetch on hover/viewport for "Continuar sin cuenta" to speed up index -> browse
    try {
      const prefetch = (url) => {
        try {
          const l = document.createElement('link');
          l.rel = 'prefetch';
          l.href = url;
          l.as = 'document';
          document.head.appendChild(l);
        } catch (_) {}
      };
      const ctas = Array.from(document.querySelectorAll('a[href$="browse.html"]'));
      ctas.forEach((cta) => {
        cta.addEventListener('pointerenter', () => prefetch(cta.href), { once: true });
      });
      if ('IntersectionObserver' in window && ctas.length) {
        const io = new IntersectionObserver((entries) => {
          if (entries.some(e => e.isIntersecting)) {
            ctas.forEach((cta) => prefetch(cta.href));
            io.disconnect();
          }
        });
        ctas.forEach((cta) => io.observe(cta));
      }
    } catch (_) {}
  });
})();

