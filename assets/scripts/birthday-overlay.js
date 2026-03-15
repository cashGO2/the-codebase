/**
 * Materio Birthday Overlay
 * ========================
 * Dynamically loaded by advanced.js when an overlay-type event is active in events.json.
 */
(async function () {
  'use strict';

  // ── Read config from global set by advanced.js ──
  var cfg = window.__materioOverlayConfig || {};
  var EYEBROW         = cfg.eyebrow            || 'Happy Birthday';
  var BRAND_LOGO_URL  = cfg.brand_logo_url     || '/assets/img/materio_new_wh.svg';
  var HEADLINE_TXT    = cfg.headline_text       || 'turns';
  var NUM             = cfg.headline_num        || '2';
  var SUB             = cfg.sub                 || 'Two years of studying smarter \u00a0✦\u00a0 Thank you';
  
  // DURATION & SPEED SETTINGS (Controllable via events.json)
  var PLANK_DURATION    = cfg.plank_duration_ms    || 12000;
  var BALLOONS_DURATION = cfg.balloons_duration_ms || 15000;
  var BALLOONS_SPEED    = cfg.balloons_speed_scale || 1.0; // 1.0 = normal, 0.5 = fast, 2.0 = slow (multiplier for time)

  // ── Once-per-day guard ──
  var STORAGE_KEY = 'materio_overlay_materio_birthday';
  var today = new Date().toISOString().slice(0, 10);
  try {
    if (localStorage.getItem(STORAGE_KEY) === today) return;
    localStorage.setItem(STORAGE_KEY, today);
  } catch (e) { /* proceed anyway */ }

  // ── In-line Balloons Logic (Extracted from reference for full control) ──
  var __assign = function() {
    __assign = Object.assign || function __assign(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
  };
  var balloonDefaultSize = { width: 233, height: 609 };
  var balloonSvgHTML = '\n<svg style="width: var(--balloon-width); height: var(--balloon-height);" viewBox="0 0 223 609" fill="none" xmlns="http://www.w3.org/2000/svg">\n<g opacity="0.8" filter="url(#filter0_f_102_49)" >\n  <path d="M117.5 253C136.167 294.5 134.7 395 125.5 453C116.3 511 133.833 578.167 125.5 606" stroke="url(#paint0_linear_102_49)" stroke-width="2"/>\n</g>\n<g opacity="0.85" filter="url(#filter1_ii_102_49)">\n  <path fill-rule="evenodd" clip-rule="evenodd" d="M176.876 204.032C181.934 198.064 209.694 160.262 210.899 127.619C213.023 70.1236 176.876 13 118.337 13C55.7949 13 18.5828 69.332 22.2724 127.619C24.0956 156.423 38.9766 178.5 51.7922 195.372C57.7811 203.257 90.0671 238.749 112.15 245.044C111.698 248.246 112.044 253.284 116.338 254H121.838V245.71C143.277 242.292 172.085 209.686 176.876 204.032Z" fill="var(--balloon-color, #84A332)"/>\n</g>\n<g filter="url(#filter2_f_102_49)">\n  <path d="M125 256.5C125 258.433 122.09 260 118.5 260C114.91 260 112 258.433 112 256.5C112 254.567 114.91 255 118.5 255C122.09 255 125 254.567 125 256.5Z" fill="var(--balloon-color, #84A332)"/>\n</g>\n<g opacity="0.2" filter="url(#filter3_f_102_49)">\n  <path d="M178.928 128.12C178.011 152.146 172.137 162.97 154.623 184.2C141.594 199.992 128.28 215 112.805 215C104.349 215 92.739 215 65.2673 177.844C56.1123 165.461 45.4818 149.259 44.1794 128.12C41.5436 85.3424 68.1267 44 112.805 44C154.623 44 180.55 85.6242 178.928 128.12Z" fill="url(#paint1_radial_102_49)"/>\n</g>\n<g style="mix-blend-mode: lighten" opacity="0.7" filter="url(#filter4_df_102_49)">\n  <path d="M72.7992 108.638L74.0985 87.5247C74.3145 84.0152 77.4883 81.4427 80.9664 81.958L94.8619 84.0166C98.4018 84.541 100.699 88.0277 99.7828 91.4871L94.0502 113.144C93.1964 116.369 89.8758 118.278 86.659 117.394L77.1969 114.792C74.4599 114.039 72.6249 111.471 72.7992 108.638Z" fill="var(--light-color, #C0F381)"/>\n</g>\n<g style="mix-blend-mode: lighten" opacity="0.5" filter="url(#filter5_f_102_49)">\n  <path d="M147.76 88.7366L144.842 67.9855C144.378 64.687 141.316 62.3976 138.021 62.8858L123.638 65.0166C120.098 65.541 117.801 69.0277 118.717 72.4871L124.462 94.1891C125.311 97.3967 128.602 99.3061 131.808 98.4512L143.364 95.3695C146.296 94.5878 148.182 91.7409 147.76 88.7366Z" fill="var(--light-color, #C0F381)"/>\n</g>\n<g style="mix-blend-mode: lighten" filter="url(#filter6_f_102_49)">\n  <path d="M46.4087 131.164C38.1642 111.726 43.2454 91.2599 47.4381 82.0988C47.7504 81.4164 48.5574 80.8601 48.8712 81.5418C48.9711 81.7589 48.9188 82.1169 48.8357 82.3409C41.2341 102.832 45.5154 122.958 47.3397 130.925C47.8434 133.124 47.2898 133.242 46.4087 131.164Z" fill="var(--light-color, #C0F381)"/>\n</g>\n</svg>\n';
  var svgFiltersHtml = '<svg style="position:absolute; width:0; height:0;"><defs><filter id="filter0_f_102_49" x="114.588" y="250.59" width="20.5082" height="357.697" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="1" result="effect1_foregroundBlur_102_49"/></filter><filter id="filter1_ii_102_49" x="22.0213" y="13" width="188.967" height="241" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/><feOffset/><feGaussianBlur stdDeviation="4.5"/><feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.4 0"/><feBlend mode="normal" in2="shape" result="effect1_innerShadow_102_49"/><feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/><feOffset/><feGaussianBlur stdDeviation="18"/><feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/><feBlend mode="overlay" in2="effect1_innerShadow_102_49" result="effect2_innerShadow_102_49"/></filter><filter id="filter2_f_102_49" x="111" y="253.959" width="15" height="7.04138" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="0.5" result="effect1_foregroundBlur_102_49"/></filter><filter id="filter3_f_102_49" x="0" y="0" width="223" height="259" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="22" result="effect1_foregroundBlur_102_49"/></filter><filter id="filter4_df_102_49" x="46.7878" y="59.8922" width="79.1969" height="87.7179" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/><feOffset dy="4"/><feGaussianBlur stdDeviation="13"/><feComposite in2="hardAlpha" operator="out"/><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.8 0"/><feBlend mode="overlay" in2="BackgroundImageFix" result="effect1_dropShadow_102_49"/><feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_102_49" result="shape"/><feGaussianBlur stdDeviation="5.5" result="effect2_foregroundBlur_102_49"/></filter><filter id="filter5_f_102_49" x="102.515" y="46.8202" width="61.3035" height="67.8351" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="8" result="effect1_foregroundBlur_102_49"/></filter><filter id="filter6_f_102_49" x="34" y="73.2313" width="22.9258" height="67.4198" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="4" result="effect1_foregroundBlur_102_49"/></filter><filter id="filter7_f_102_49" x="40" y="79.2313" width="10.9258" height="55.4198" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="1" result="effect1_foregroundBlur_102_49"/></filter><linearGradient id="paint0_linear_102_49" x1="124.798" y1="253" x2="124.798" y2="606" gradientUnits="userSpaceOnUse"><stop stop-color="white"/><stop offset="0.474934" stop-color="grey" stop-opacity="0.1"/><stop offset="0.722707" stop-color="white" stop-opacity="0.6"/><stop offset="0.93469" stop-color="grey" stop-opacity="0.7"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient><radialGradient id="paint1_radial_102_49" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(134 149.5) rotate(-123.69) scale(82.9277 65.4692)"><stop/><stop offset="1" stop-opacity="0"/></radialGradient></defs></svg>';
  var easings = ["cubic-bezier(0.22, 1, 0.36, 1)", "cubic-bezier(0.33, 1, 0.68, 1)"];
  var colorPairs = [ ["#ffec37ee", "#f8b13dff"], ["#f89640ee", "#c03940ff"], ["#3bc0f0ee", "#0075bcff"], ["#b0cb47ee", "#3d954bff"], ["#cf85b8ee", "#a3509dff"] ];

  function createBalloonElement(opts) {
    var b = document.createElement("div");
    b.innerHTML = balloonSvgHTML;
    Object.assign(b.style, {
      position: "absolute", overflow: "hidden", top: "0", left: "0", display: "inline-block",
      isolation: "isolate", transformStyle: "preserve-3d", backfaceVisibility: "hidden",
      opacity: "0.001", transform: "translate(calc(-100% + 1px), calc(-100% + 1px))",
      contain: "style, layout, paint", willChange: "transform",
      zIndex: opts.zIndex
    });
    b.style.setProperty("--balloon-color", opts.balloonColor);
    b.style.setProperty("--light-color", opts.lightColor);
    b.style.setProperty("--balloon-width", opts.width + "px");
    b.style.setProperty("--balloon-height", (opts.width * 609) / 223 + "px");
    return b;
  }

  function startBalloons() {
    var container = document.createElement("div");
    container.id = "bday-balloons-layer";
    Object.assign(container.style, {
      overflow: "hidden", position: "fixed", inset: "0", zIndex: "999",
      pointerEvents: "none", perspective: "1500px"
    });
    container.innerHTML = svgFiltersHtml;
    document.body.appendChild(container);

    var amount = Math.max(8, Math.round(window.innerWidth / 100));
    for (var i = 0; i < amount; i++) {
      (function(idx) {
        var x = Math.random() * window.innerWidth;
        var z = Math.random() * -1000;
        var color = colorPairs[idx % colorPairs.length];
        var width = 180 + Math.random() * 100;
        var b = createBalloonElement({ balloonColor: color[1], lightColor: color[0], width: width, zIndex: Math.floor(i) });
        container.appendChild(b);

        var duration = (5000 + Math.random() * 3000) * BALLOONS_SPEED;
        b.animate([
          { transform: "translate3d("+x+"px, 110vh, "+z+"px)", opacity: 1 },
          { transform: "translate3d("+(x + (Math.random()-0.5)*400)+"px, -120vh, "+z+"px)", opacity: 1 }
        ], {
          duration: duration,
          easing: easings[idx % easings.length],
          delay: Math.random() * 3000
        }).finished.then(() => b.remove());
      })(i);
    }

    setTimeout(() => {
      container.style.transition = "opacity 2s ease";
      container.style.opacity = "0";
      setTimeout(() => container.remove(), 2000);
    }, BALLOONS_DURATION);
  }

  // ── Confetti Lib ──
  let confettiLib = null;
  try {
    const cRes = await import('https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/+esm');
    confettiLib = cRes.default;
  } catch (e) {}

  // ── Styles ──
  var style = document.createElement('style');
  style.textContent = `
    #materio-bday-overlay { position: fixed; inset: 0; z-index: 10000; display: flex; align-items: center; justify-content: center; pointer-events: none; opacity: 0; transition: opacity 0.8s; box-sizing: border-box; }
    #materio-bday-overlay.visible { opacity: 1; }
    #materio-bday-overlay.pull-up { animation: bdayPullUp 0.9s cubic-bezier(0.68, -0.6, 0.32, 1.6) forwards; }
    @keyframes bdayPullUp { 0% { transform: translateY(0); opacity: 1; } 15% { transform: translateY(30px); opacity: 1; } 100% { transform: translateY(-110vh); opacity: 0; } }
    .bday-sign-wrap { position: relative; pointer-events: auto; transform-origin: top center; animation: bdaySwing 5s ease-in-out infinite alternate; transform: translateY(-110vh); transition: transform 1.5s cubic-bezier(0.22, 1, 0.36, 1); width: 100%; max-width: 700px; display: flex; justify-content: center; }
    .visible .bday-sign-wrap { transform: translateY(0); }
    @keyframes bdaySwing { 0% { transform: translateY(0) rotate(-1.2deg); } 100% { transform: translateY(0) rotate(1.2deg); } }
    .bday-rod { position: absolute; top: -110vh; width: 10px; height: 112vh; background: #7d6342; z-index: 20; background-image: repeating-linear-gradient(45deg, rgba(0,0,0,0.2) 0px, rgba(0,0,0,0.2) 2px, transparent 2px, transparent 6px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 1px, transparent 1px, transparent 4px); box-shadow: inset 2px 0 4px rgba(0,0,0,0.4), inset -2px 0 3px rgba(255,255,255,0.15), 0 5px 15px rgba(0,0,0,0.3); border-radius: 4px; }
    .bday-rod-left { left: 10%; } .bday-rod-right { right: 10%; }
    .bday-card { background: linear-gradient(135deg, rgba(32,32,35,0.95) 0%, rgba(22,22,25,0.92) 100%); backdrop-filter: blur(40px) saturate(1.8); -webkit-backdrop-filter: blur(40px) saturate(1.8); position: relative; width: 100%; border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 50px 120px rgba(0,0,0,0.85), inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 2px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,132,0,0.2); border-radius: 12px; padding: 60px 40px 64px; text-align: center; cursor: pointer; }
    .bday-bolt { position: absolute; top: 24px; width: 14px; height: 14px; background: radial-gradient(circle at 30% 30%, #aaa, #444); border-radius: 50%; box-shadow: 0 3px 5px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.4); z-index: 10; }
    .bday-bolt::after { content: ""; position: absolute; inset: 4px; border-left: 2px solid rgba(0,0,0,0.5); border-radius: 50%; }
    .bday-bolt-left { left: 10%; transform: translateX(-2px); } .bday-bolt-right { right: 10%; transform: translateX(-2px); }
    .bday-eyebrow { font-size: 11px; font-weight: 800; letter-spacing: 0.35em; text-transform: uppercase; color: #ff8400; margin-bottom: 24px; opacity: 0; }
    .bday-headline { display: flex; align-items: center; justify-content: center; gap: 20px; flex-wrap: wrap; font-family: "Instrument Serif", Georgia, serif; font-style: italic; font-size: clamp(40px, 8vw, 76px); color: #fff; line-height: 1.1; letter-spacing: -0.03em; opacity: 0; }
    .bday-logo { height: 1.1em; width: auto; vertical-align: middle; }
    .bday-num { font-style: normal; font-family: Manrope, sans-serif; font-weight: 1000; color: #ff8400; display: inline-block; filter: drop-shadow(0 0 20px rgba(255,132,0,0.5)); opacity: 0; }
    .bday-rule { width: 80px; height: 1px; background: linear-gradient(90deg, transparent, rgba(255,132,0,0.7), transparent); margin: 32px auto 28px; opacity: 0; }
    .bday-sub { font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.6); letter-spacing: 0.05em; opacity: 0; }
    .bday-animate .bday-eyebrow { animation: bdayIn 0.7s 0.6s ease forwards; }
    .bday-animate .bday-headline { animation: bdayIn 0.8s 0.8s ease forwards; }
    .bday-animate .bday-rule { animation: bdayIn 0.6s 1.1s ease forwards; }
    .bday-animate .bday-num { animation: bdayPop 0.7s 1.3s cubic-bezier(0.34,1.56,0.64,1) forwards; }
    .bday-animate .bday-sub { animation: bdayIn 0.7s 1.6s ease forwards; }
    @keyframes bdayIn { from { opacity: 0; transform: translateY(25px); filter: blur(12px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }
    @keyframes bdayPop { 0% { transform: scale(0.3) rotate(-15deg); opacity: 0; } 70% { transform: scale(1.2) rotate(5deg); } 100% { transform: scale(1) rotate(0); opacity: 1; } }
    @media (max-width: 600px) { .bday-card { padding: 40px 24px 48px; } .bday-headline { gap: 12px; } .bday-rod-left { left: 8%; } .bday-rod-right { right: 8%; } .bday-sign-wrap { max-width: 90vw; } }
  `;
  document.head.appendChild(style);

  // ── DOM ──
  var overlay = document.createElement('div');
  overlay.id = 'materio-bday-overlay';
  overlay.innerHTML = `
    <div class="bday-sign-wrap">
      <div class="bday-rod bday-rod-left"></div>
      <div class="bday-rod bday-rod-right"></div>
      <div class="bday-card">
        <div class="bday-bolt bday-bolt-left"></div>
        <div class="bday-bolt bday-bolt-right"></div>
        <div class="bday-eyebrow">${EYEBROW}</div>
        <div class="bday-headline">
          <img src="${BRAND_LOGO_URL}" class="bday-logo">
          <span>${HEADLINE_TXT}</span>
          <span class="bday-num">${NUM}</span>
        </div>
        <div class="bday-rule"></div>
        <div class="bday-sub">${SUB}</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // ── Sequence ──
  function run() {
    overlay.classList.add('visible');
    startBalloons();
    setTimeout(() => {
      overlay.querySelector('.bday-sign-wrap').classList.add('bday-animate');
      if (confettiLib) {
        confettiLib({ particleCount: 150, spread: 70, origin: { y: 0.8 }, zIndex: 10001 });
      }
    }, 1200);
    setTimeout(exit, PLANK_DURATION);
    overlay.querySelector('.bday-card').onclick = exit;
  }

  function exit() {
    overlay.classList.add('pull-up');
    setTimeout(() => overlay.remove(), 1000);
  }

  if (!document.querySelector('link[href*="Instrument+Serif"]')) {
    var l = document.createElement('link'); l.rel='stylesheet'; l.href='https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@1&display=swap';
    document.head.appendChild(l);
  }

  setTimeout(run, 2000);
})();
