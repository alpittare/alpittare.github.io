/* ==========================================================================
   EXAFABS homepage orchestration. Pure enhancement: the page is fully
   visible and usable before this file runs. This file is the ONLY script
   loaded with the document; GSAP, ScrollTrigger, Lenis and the WebGL
   network are injected AFTER first paint so LCP stays pure HTML/CSS.
   Any failure adds html.js-fail, which force-restores every animated
   element via CSS.
   ========================================================================== */
(function () {
  'use strict';

  var html = document.documentElement;
  var REDUCED = false;
  try { REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function forceVisible() {
    html.classList.add('js-fail');
    // the canvas may never have been started — let the static SVG show instead
    html.classList.remove('webgl-on');
    var tw = document.getElementById('typeline');
    if (tw && tw.getAttribute('data-text')) tw.textContent = tw.getAttribute('data-text');
  }

  function loadScript(src) {
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(true); };
      s.onerror = function () { resolve(false); };
      document.head.appendChild(s);
    });
  }

  function run() {
    try { boot(); } catch (e) { forceVisible(); throw e; }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  /* ---- Universal features: must work in every mode, no libraries ---- */

  function initClock() {
    var el = document.getElementById('clock');
    if (!el) return;
    function setNow() {
      try {
        el.textContent = 'IST ' + new Date().toLocaleTimeString('en-GB', { hour12: false, timeZone: 'Asia/Kolkata' });
      } catch (e) { el.textContent = ''; }
    }
    setNow();
    if (!REDUCED) setInterval(setNow, 1000);
  }

  function initForm() {
    var form = document.getElementById('contactForm');
    var status = document.getElementById('formStatus');
    if (!form || !window.fetch || !window.FormData) return; // native POST still works
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var hp = document.getElementById('honeypot');
      if (hp && hp.value.trim() !== '') return; // bot
      var btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;
      if (status) { status.removeAttribute('data-state'); status.textContent = 'Transmitting…'; }
      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      }).then(function (res) {
        return res.json().catch(function () { return { success: res.ok }; });
      }).then(function (data) {
        if (!data || !data.success) throw new Error('send failed');
        if (status) { status.setAttribute('data-state', 'ok'); status.textContent = 'Signal received — reply incoming.'; }
        form.reset();
      }).catch(function () {
        if (status) { status.setAttribute('data-state', 'err'); status.textContent = 'Could not send — email alpit@exafabs.ai instead.'; }
      }).then(function () {
        if (btn) btn.disabled = false;
      });
    });
  }

  function initCursor() {
    var fine = false;
    try { fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) {}
    if (!fine) return false;
    var dot = document.querySelector('.cur-dot');
    var ring = document.querySelector('.cur-ring');
    if (!dot || !ring) return false;
    html.classList.add('cursor-on');
    var cx = -100, cy = -100, rx = -100, ry = -100;
    window.addEventListener('mousemove', function (e) {
      cx = e.clientX; cy = e.clientY;
      dot.style.transform = 'translate(' + cx + 'px,' + cy + 'px)';
    }, { passive: true });
    (function ringLoop() {
      var dx = (cx - rx) * 0.16, dy = (cy - ry) * 0.16;
      if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) { // skip style writes at rest
        rx += dx;
        ry += dy;
        ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px)';
      }
      requestAnimationFrame(ringLoop);
    })();
    document.addEventListener('mouseover', function (e) {
      if (e.target.closest && e.target.closest('a, button')) ring.classList.add('is-active');
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest && e.target.closest('a, button')) ring.classList.remove('is-active');
    });
    return true;
  }

  function boot() {
    var canvas = document.getElementById('net');

    var nav = document.querySelector('.site-nav');
    function navState(y) { if (nav) nav.classList.toggle('nav--solid', y > 24); }
    navState(window.scrollY || 0);
    // Lenis drives native window scroll, so this one listener covers both modes
    window.addEventListener('scroll', function () { navState(window.scrollY); }, { passive: true });

    initClock();
    initForm();

    /* ---- Reduced motion: only the network (for its static frame) ---- */
    if (REDUCED) {
      loadScript('/assets/js/network.js').then(function () {
        if (!canvas || !window.ExafabsNetwork || html.classList.contains('js-fail')) return;
        var net = null;
        try { net = window.ExafabsNetwork.attach(canvas); } catch (e) {}
        if (net) {
          html.classList.add('webgl-on');
          net.staticFrame();
        }
      });
      return;
    }

    var fine = initCursor();

    // Heavy libraries load AFTER first paint — two frames from now.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var gsapChain = loadScript('/assets/js/vendor/gsap.min.js').then(function (ok) {
          return ok ? loadScript('/assets/js/vendor/ScrollTrigger.min.js') : false;
        });
        Promise.all([gsapChain, loadScript('/assets/js/vendor/lenis.min.js'), loadScript('/assets/js/network.js')])
          .then(function () {
            try { enhancedBoot(); } catch (e) { forceVisible(); }
          });
      });
    });

    function enhancedBoot() {
      var net = null;
      if (canvas && window.ExafabsNetwork && !html.classList.contains('js-fail')) {
        try { net = window.ExafabsNetwork.attach(canvas); } catch (e) { net = null; }
      }
      if (net) html.classList.add('webgl-on');

      var gsap = window.gsap;
      var hasGsap = !!(gsap && window.ScrollTrigger);
      if (!hasGsap) {
        if (net) net.start(); // page is already fully visible
        return;
      }
      gsap.registerPlugin(window.ScrollTrigger);

      /* ---- Lenis smooth scroll synced to GSAP's ticker ---- */
      var lenis = null;
      if (window.Lenis) {
        lenis = new window.Lenis({ duration: 1.15, autoRaf: false });
        lenis.on('scroll', function () { window.ScrollTrigger.update(); });
        gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
        gsap.ticker.lagSmoothing(0);
      }

      document.addEventListener('click', function (ev) {
        if (!lenis || !ev.target.closest) return;
        var a = ev.target.closest('a[href^="#"]');
        if (!a || a.classList.contains('skip-link')) return; // skip link keeps native focus behavior
        var sel = a.getAttribute('href');
        if (sel.length < 2) return;
        var el = document.querySelector(sel);
        if (!el) return;
        ev.preventDefault();
        lenis.scrollTo(el, { offset: -64 });
        el.tabIndex = -1;
        el.focus({ preventScroll: true });
        try { history.pushState(null, '', sel); } catch (e) {}
      });

      /* ---- Entrance choreography ---- */
      var preloaderEl = document.getElementById('preloader');
      var words = document.querySelectorAll('.hero-title .word');
      var micro = document.querySelector('.hero .micro');
      var ctas = document.querySelectorAll('.hero-ctas .btn');
      var foot = document.querySelector('.hero-foot');
      var grid = document.querySelector('.hero-grid');
      var tw = document.getElementById('typeline');

      function typewrite(el) {
        if (!el) return;
        var txt = el.getAttribute('data-text') || el.textContent;
        el.setAttribute('data-text', txt);
        el.textContent = '';
        gsap.set(el, { opacity: 1 });
        // full sentence for assistive tech; the typing effect is aria-hidden
        var sr = document.createElement('span');
        sr.className = 'sr-only';
        sr.textContent = txt;
        var fx = document.createElement('span');
        fx.setAttribute('aria-hidden', 'true');
        var tn = document.createTextNode('');
        var caret = document.createElement('span');
        caret.className = 'caret';
        fx.appendChild(tn);
        fx.appendChild(caret);
        el.appendChild(sr);
        el.appendChild(fx);
        var prog = { i: 0 };
        gsap.to(prog, {
          i: txt.length,
          duration: Math.min(1.6, txt.length * 0.034),
          ease: 'none',
          onUpdate: function () { tn.data = txt.slice(0, Math.round(prog.i)); }
        });
      }

      // All hiding happens at entrance() build time — full masks only when
      // the libraries arrived before the inline counter finished.
      var entrance = function (withMasks) {
        var tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
        if (net) {
          net.start();
          tl.fromTo(canvas, { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'power1.out' }, 0);
        }
        if (withMasks) {
          tl.from(micro, { y: 14, opacity: 0, duration: 0.6, immediateRender: true }, 0.18);
          tl.from(words, {
            yPercent: 118, rotation: 4, transformOrigin: '0% 100%',
            duration: 0.95, stagger: 0.09, immediateRender: true
          }, 0.28);
          tl.from(ctas, { y: 18, opacity: 0, duration: 0.7, stagger: 0.09, immediateRender: true, clearProps: 'all' }, 0.88);
          tl.add(function () { typewrite(tw); }, 1.1);
          tl.from('.site-nav', { y: -14, opacity: 0, duration: 0.7, immediateRender: true }, 1.2);
          tl.from(foot, { opacity: 0, duration: 0.8, immediateRender: true }, 1.35);
        } else {
          tl.add(function () { typewrite(tw); }, 0.35);
        }
        tl.add(function () { if (grid) grid.classList.add('glow'); }, withMasks ? 1.1 : 0.3);
        tl.add(function () { if (grid) grid.classList.remove('glow'); }, withMasks ? 3.2 : 2.4);
      };

      var preloading = !!(preloaderEl && html.classList.contains('preload'));
      var preDone = html.classList.contains('preload-done');

      if (preloading && !preDone) {
        // Fast path: cinematic hand-off when the inline counter completes.
        gsap.set(tw, { opacity: 0 });
        var started = false;
        var subT = performance.now();
        var onDone = function () {
          if (started) return;
          started = true;
          try {
            // If the hand-off arrives long after subscribe (tab was hidden,
            // CSS failsafe already revealed the page), never re-hide content.
            if (performance.now() - subT > 3000) {
              entrance(false);
              return;
            }
            var plLine = preloaderEl.querySelector('.pl-line');
            if (net && plLine) {
              // The progress line shatters into the particles of the network
              var r = plLine.getBoundingClientRect();
              net.seedLine(r.left, r.top + 0.5, r.right, r.top + 0.5);
            }
            entrance(true);
          } catch (e) { forceVisible(); }
        };
        window.addEventListener('xf:preload-done', onDone, { once: true });
        // close the subscribe race: the event may have fired a tick ago
        if (html.classList.contains('preload-done')) onDone();
        // insurance: if the inline driver never fires, restore everything —
        // but a hidden tab freezes the rAF driver, so wait for visibility
        setTimeout(function () {
          if (started) return;
          if (document.hidden) {
            var onVis = function () {
              if (document.hidden) return;
              document.removeEventListener('visibilitychange', onVis);
              setTimeout(function () { if (!started) { started = true; forceVisible(); } }, 1500);
            };
            document.addEventListener('visibilitychange', onVis);
            return;
          }
          started = true;
          forceVisible();
        }, 4000);
      } else if (preloading && preDone) {
        // Slow path: the headline is already the visible LCP — never re-hide it.
        entrance(false);
      } else {
        // Repeat visit: no preloader, full entrance immediately.
        gsap.set(tw, { opacity: 0 });
        entrance(true);
      }

      // Hero recedes as you scroll past it
      gsap.to('.hero-inner', {
        y: 70, opacity: 0.3, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
      });

      initCounters(gsap);
      initMarquee(gsap, lenis);

      /* ---- Magnetic buttons ---- */
      if (fine) {
        var btns = document.querySelectorAll('.btn');
        for (var b = 0; b < btns.length; b++) {
          (function (btn) {
            var qx = gsap.quickTo(btn, 'x', { duration: 0.4, ease: 'power3' });
            var qy = gsap.quickTo(btn, 'y', { duration: 0.4, ease: 'power3' });
            btn.addEventListener('mousemove', function (e) {
              var r = btn.getBoundingClientRect();
              qx((e.clientX - (r.left + r.width / 2)) * 0.18);
              qy((e.clientY - (r.top + r.height / 2)) * 0.3);
            });
            btn.addEventListener('mouseleave', function () { qx(0); qy(0); });
          })(btns[b]);
        }
      }

      /* ---- Card tilt toward cursor (max 6deg) ---- */
      if (fine) {
        var cards = document.querySelectorAll('.card');
        for (var c = 0; c < cards.length; c++) {
          (function (card) {
            gsap.set(card, { transformPerspective: 900 });
            var trx = gsap.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power3' });
            var trY = gsap.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power3' });
            card.addEventListener('mousemove', function (e) {
              var r = card.getBoundingClientRect();
              var dx = (e.clientX - r.left) / r.width - 0.5;
              var dy = (e.clientY - r.top) / r.height - 0.5;
              trY(dx * 6);
              trx(-dy * 6);
            });
            card.addEventListener('mouseleave', function () { trx(0); trY(0); });
          })(cards[c]);
        }
      }
    }
  }

  /* ---- Metric counters: count up once when scrolled into view ---- */
  function initCounters(gsap) {
    var nums = document.querySelectorAll('.metric .num[data-count]');
    for (var i = 0; i < nums.length; i++) {
      (function (el) {
        var target = parseInt(el.getAttribute('data-count'), 10);
        if (!target) return;
        window.ScrollTrigger.create({
          trigger: el, start: 'top 90%', once: true,
          onEnter: function () {
            var o = { v: 0 };
            gsap.to(o, {
              v: target, duration: 1.1, ease: 'power2.out',
              onUpdate: function () { el.textContent = Math.round(o.v).toLocaleString('en-US'); }
            });
          }
        });
      })(nums[i]);
    }
  }

  /* ---- Marquee: CSS animation, scroll-velocity reactive playbackRate ---- */
  function initMarquee(gsap, lenis) {
    var track = document.querySelector('.marquee-track');
    if (!track || !track.getAnimations) return;
    var anim = null;
    try { anim = track.getAnimations()[0] || null; } catch (e) {}
    if (!anim || !('playbackRate' in anim)) return;
    var target = 1;
    if (lenis) {
      lenis.on('scroll', function (e) {
        var v = Math.abs(e.velocity || 0);
        target = Math.min(1 + v * 0.05, 4);
      });
    }
    gsap.ticker.add(function () {
      var cur = anim.playbackRate || 1;
      // idle guard: don't touch the Animation object every frame at rest
      if (Math.abs(target - 1) < 0.005 && Math.abs(cur - 1) < 0.005) {
        if (cur !== 1) anim.playbackRate = 1;
        return;
      }
      anim.playbackRate = cur + (target - cur) * 0.08;
      target += (1 - target) * 0.03; // decay back to base speed
    });
  }
})();
