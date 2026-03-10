/* ============================================================
   Solar AI OS -- Landing Page Script
   ============================================================ */

(function () {
  "use strict";

  /* Navbar scroll */
  var navbar = document.getElementById("navbar");
  function handleScroll() {
    if (window.scrollY > 40) { navbar.classList.add("scrolled"); }
    else { navbar.classList.remove("scrolled"); }
  }
  window.addEventListener("scroll", handleScroll, { passive: true });
  handleScroll();

  /* Mobile nav toggle */
  var navToggle = document.getElementById("navToggle");
  var navLinks  = document.getElementById("navLinks");
  if (navToggle && navLinks) {
    navToggle.addEventListener("click", function () {
      var open = navLinks.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    navLinks.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        navLinks.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
    document.addEventListener("click", function (e) {
      if (!navbar.contains(e.target)) {
        navLinks.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* Smooth scroll */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var href = this.getAttribute("href");
      if (href === "#") return;
      var target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.scrollY - (navbar ? navbar.offsetHeight : 0) - 16;
      window.scrollTo({ top: top, behavior: "smooth" });
    });
  });

  /* Fade-in on scroll */
  var fadeEls = document.querySelectorAll(".fade-in");
  if ("IntersectionObserver" in window && fadeEls.length > 0) {
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var siblings = entry.target.parentElement
          ? Array.from(entry.target.parentElement.querySelectorAll(".fade-in")) : [];
        var idx = siblings.indexOf(entry.target);
        setTimeout(function () { entry.target.classList.add("visible"); }, Math.min(idx * 80, 400));
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    fadeEls.forEach(function (el) { obs.observe(el); });
  } else {
    fadeEls.forEach(function (el) { el.classList.add("visible"); });
  }

  /* Email form */
  var form = document.getElementById("emailForm");
  var inp  = document.getElementById("emailInput");
  var succ = document.getElementById("emailSuccess");
  if (form && inp && succ) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inp.value.trim())) {
        inp.focus();
        inp.style.borderColor = "rgba(239,68,68,0.6)";
        inp.style.boxShadow   = "0 0 0 3px rgba(239,68,68,0.12)";
        setTimeout(function () { inp.style.borderColor = ""; inp.style.boxShadow = ""; }, 2000);
        return;
      }
      form.style.display = "none";
      succ.removeAttribute("hidden");
    });
    inp.addEventListener("input", function () { inp.style.borderColor = ""; inp.style.boxShadow = ""; });
  }

  /* SVG orbit groups */
  document.querySelectorAll(".svg-orbit-group").forEach(function (el) {
    el.style.animationName           = "orbit-cw";
    el.style.animationTimingFunction = "linear";
    el.style.animationIterationCount = "infinite";
    if (!el.style.animationDuration) el.style.animationDuration = "12s";
  });

  /* Feature icon backgrounds (color-mix polyfill) */
  document.querySelectorAll(".feature-icon-wrap").forEach(function (w) {
    var ic = getComputedStyle(w).getPropertyValue("--ic").trim();
    if (!ic) return;
    var h = ic.replace("#",""), r=167,g=139,b=250;
    if (h.length===6) { r=parseInt(h.slice(0,2),16); g=parseInt(h.slice(2,4),16); b=parseInt(h.slice(4,6),16); }
    w.style.background  = "rgba("+r+","+g+","+b+",0.12)";
    w.style.borderColor = "rgba("+r+","+g+","+b+",0.22)";
  });

  /* Highlight recommended download for detected OS */
  (function () {
    var ua = navigator.userAgent.toLowerCase();
    var p = /windows/.test(ua) ? "Windows" : /mac os x|macintosh/.test(ua) ? "macOS" : /linux/.test(ua) ? "Linux" : null;
    if (!p) return;
    document.querySelectorAll(".btn-download").forEach(function (btn) {
      var lbl = btn.querySelector(".btn-download-platform");
      if (!lbl || lbl.textContent.trim() !== p) return;
      btn.style.cssText += ";border-color:var(--amber);background:rgba(245,158,11,0.06);box-shadow:0 0 24px rgba(245,158,11,0.1);position:relative;";
      var badge = document.createElement("span");
      badge.textContent = "Recommended";
      badge.style.cssText = "position:absolute;top:-11px;left:50%;transform:translateX(-50%);background:var(--amber);color:#1a0800;font-size:0.62rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:2px 9px;border-radius:100px;white-space:nowrap;font-family:var(--font);";
      btn.appendChild(badge);
    });
  })();

  /* Console easter egg */
  if (typeof console !== "undefined" && console.log) {
    console.log("%c☀ Solar AI OS%c
Your AI, at the center of everything.
Open source — github.com/solar-ai-os
",
      "color:#f59e0b;font-size:1.4rem;font-weight:700;","color:#a78bfa;font-size:0.9rem;");
  }

})();
