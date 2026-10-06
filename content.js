(() => {
  if (window.__voxa) return;
  if (window !== window.top && window.innerWidth < 300) return;
  window.__voxa = true;

  const DEFAULTS = { rate: 1, hover: true, autoNext: true, voices: {} };
  let cfg = { ...DEFAULTS };
  chrome.storage.sync.get(DEFAULTS, (v) => (cfg = v));
  chrome.storage.onChanged.addListener((c) => {
    for (const k in c) cfg[k] = c[k].newValue;
    if (c.rate) rateSel.value = String(cfg.rate);
    if (c.hover && !cfg.hover) hideHover();
  });

  const BLOCKS = "p, li, blockquote, h1, h2, h3, h4, h5, h6, dd, figcaption";
  const MIN_CHARS = 40;

  /* ---------- UI (Shadow DOM) ---------- */
  const host = document.createElement("div");
  host.id = "voxa-host";
  host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML = `
  <style>
    :host{all:initial}
    *{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
    button{all:unset;cursor:pointer;display:grid;place-items:center}
    button:focus-visible{outline:2px solid #7fe0c3;outline-offset:2px}
    svg{width:18px;height:18px;fill:currentColor}
    .hover{position:fixed;width:30px;height:30px;border-radius:50%;background:#10222b;color:#7fe0c3;
      box-shadow:0 2px 8px rgba(0,0,0,.28);pointer-events:auto;opacity:0;transform:scale(.85);
      transition:opacity .15s,transform .15s;visibility:hidden}
    .hover.show{opacity:1;transform:none;visibility:visible}
    .tab{position:fixed;right:0;width:40px;height:64px;border-radius:14px 0 0 14px;background:#10222b;color:#7fe0c3;
      box-shadow:-2px 2px 10px rgba(0,0,0,.3);pointer-events:auto;gap:2px;align-content:center;visibility:hidden;
      transform:translateX(100%);transition:transform .18s,visibility .18s}
    .tab.show{visibility:visible;transform:none}
    .tab small{font-size:10px;font-weight:600;color:#a9c4c0;letter-spacing:.02em}
    .player{position:fixed;right:16px;bottom:16px;display:flex;align-items:center;gap:6px;padding:6px 8px 6px 6px;
      border-radius:999px;background:#10222b;color:#e8f3f1;box-shadow:0 4px 16px rgba(0,0,0,.35);pointer-events:auto;
      transform:translateY(24px);opacity:0;visibility:hidden;transition:transform .2s,opacity .2s,visibility .2s}
    .player.show{transform:none;opacity:1;visibility:visible}
    .player button{width:32px;height:32px;border-radius:50%}
    .player button:hover{background:#1d3944}
    .player .main{background:#7fe0c3;color:#10222b}
    .player .main:hover{background:#9bead2}
    .badge{font-size:12px;font-weight:600;padding:0 8px;color:#a9c4c0;min-width:28px;text-align:center}
    select{all:unset;cursor:pointer;font-size:12px;padding:4px 6px;border-radius:6px;color:#e8f3f1}
    select:hover{background:#1d3944}
    option{color:#000}
    @media (prefers-reduced-motion:reduce){*{transition:none!important}}
  </style>
  <button class="hover" aria-label="Read this paragraph aloud">${svg("play")}</button>
  <button class="tab" aria-label="Read selection aloud">${svg("play")}<small>Voxa</small></button>
  <div class="player" role="group" aria-label="Voxa player">
    <button class="main" aria-label="Pause or resume">${svg("pause")}</button>
    <button class="stop" aria-label="Stop">${svg("stop")}</button>
    <span class="badge">--</span>
    <select aria-label="Speed">
      <option value="0.75">0.75x</option><option value="1">1x</option><option value="1.25">1.25x</option>
      <option value="1.5">1.5x</option><option value="1.75">1.75x</option><option value="2">2x</option>
    </select>
  </div>`;
  document.documentElement.appendChild(host);

  function svg(n) {
    const p = {
      play: '<path d="M8 5v14l11-7z"/>',
      pause: '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>',
      stop: '<path d="M6 6h12v12H6z"/>',
    }[n];
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
  }

  const hoverBtn = root.querySelector(".hover");
  const tab = root.querySelector(".tab");
  const player = root.querySelector(".player");
  const mainBtn = player.querySelector(".main");
  const stopBtn = player.querySelector(".stop");
  const badge = player.querySelector(".badge");
  const rateSel = player.querySelector("select");
  rateSel.addEventListener("change", () => {
    cfg.rate = parseFloat(rateSel.value);
    chrome.storage.sync.set({ rate: cfg.rate });
  });
  chrome.storage.sync.get({ rate: 1 }, (v) => (rateSel.value = String(v.rate)));

  // keep the page selection alive when clicking our buttons
  for (const b of [hoverBtn, tab, mainBtn, stopBtn]) b.addEventListener("mousedown", (e) => e.preventDefault());

  /* ---------- Hover on paragraphs ---------- */
  let hoverEl = null;
  let hideTimer = null;

  function usable(el) {
    if (!el || host.contains(el)) return false;
    if (el.closest("input, textarea, select, [contenteditable=''], [contenteditable='true'], nav, header button")) return false;
    const t = (el.innerText || "").trim();
    return t.length >= MIN_CHARS;
  }

  function placeHover() {
    if (!hoverEl) return;
    const r = hoverEl.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return hideHover();
    const left = Math.max(4, r.left - 36);
    const top = Math.min(Math.max(4, r.top + 2), innerHeight - 36);
    hoverBtn.style.left = left + "px";
    hoverBtn.style.top = top + "px";
  }
  function showHover(el) {
    hoverEl = el;
    placeHover();
    hoverBtn.classList.add("show");
  }
  function hideHover() {
    hoverBtn.classList.remove("show");
    hoverEl = null;
  }

  document.addEventListener(
    "mouseover",
    (e) => {
      if (!cfg.hover || !(e.target instanceof Element)) return;
      let el = e.target.closest(BLOCKS);
      while (el && !usable(el)) el = el.parentElement && el.parentElement.closest(BLOCKS);
      if (!el) return;
      clearTimeout(hideTimer);
      if (el !== hoverEl) showHover(el);
    },
    true
  );
  document.addEventListener(
    "mouseout",
    (e) => {
      if (!hoverEl) return;
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hideHover, 350);
    },
    true
  );
  hoverBtn.addEventListener("mouseenter", () => clearTimeout(hideTimer));
  hoverBtn.addEventListener("mouseleave", () => (hideTimer = setTimeout(hideHover, 350)));
  addEventListener("scroll", placeHover, { passive: true, capture: true });
  addEventListener("resize", placeHover);

  hoverBtn.addEventListener("click", () => {
    if (!hoverEl) return;
    readBlock(hoverEl);
  });

  /* ---------- Selection tab ---------- */
  let selText = "";
  function updateSelectionTab() {
    const sel = getSelection();
    const text = sel ? sel.toString().trim() : "";
    const anchor = sel && sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
    if (text.length < 2 || (anchor && host.contains(anchor))) {
      tab.classList.remove("show");
      return;
    }
    selText = text;
    const r = sel.getRangeAt(0).getBoundingClientRect();
    const mid = r.top + r.height / 2;
    tab.style.top = Math.min(Math.max(8, mid - 32), innerHeight - 72) + "px";
    tab.classList.add("show");
  }
  document.addEventListener("mouseup", () => setTimeout(updateSelectionTab, 10));
  document.addEventListener("keyup", (e) => {
    if (e.key === "Escape") return;
    setTimeout(updateSelectionTab, 10);
  });
  document.addEventListener("selectionchange", () => {
    const s = getSelection();
    if (!s || s.toString().trim().length < 2) tab.classList.remove("show");
  });
  tab.addEventListener("click", () => {
    if (selText) readText(selText, { mode: "selection" });
  });

  /* ---------- Language + voice ---------- */
  async function detect(text) {
    const pageLang = (document.documentElement.lang || navigator.language || "en").toLowerCase();
    try {
      const r = await chrome.runtime.sendMessage({ type: "detect", text: text.slice(0, 600) });
      if (r && r.lang && r.lang !== "und" && (r.reliable || text.length > 80)) return r.lang;
    } catch (_) {}
    return pageLang;
  }

  function voicesReady() {
    return new Promise((res) => {
      const v = speechSynthesis.getVoices();
      if (v.length) return res(v);
      speechSynthesis.addEventListener("voiceschanged", () => res(speechSynthesis.getVoices()), { once: true });
      setTimeout(() => res(speechSynthesis.getVoices()), 1500);
    });
  }

  function pickVoice(voices, lang) {
    const base = lang.toLowerCase().split(/[-_]/)[0];
    const saved = cfg.voices && cfg.voices[base];
    if (saved) {
      const s = voices.find((v) => v.voiceURI === saved);
      if (s) return s;
    }
    const score = (v) => {
      let s = 0;
      if (v.lang.toLowerCase() === lang.toLowerCase().replace("_", "-")) s += 2;
      if (/natural|neural|online/i.test(v.name)) s += 4;
      if (/google/i.test(v.name)) s += 3;
      if (!v.localService) s += 1;
      return s;
    };
    return voices
      .filter((v) => v.lang.toLowerCase().split(/[-_]/)[0] === base)
      .sort((a, b) => score(b) - score(a))[0];
  }

  /* ---------- Speaking ---------- */
  let session = 0;
  let activeEl = null;
  let activePrev = null;
  let paused = false;

  function chunk(text) {
    const parts = text.replace(/\s+/g, " ").trim().match(/[^.!?。！？]+[.!?。！？]*\s*/g) || [text];
    const out = [];
    let cur = "";
    for (const p of parts) {
      if ((cur + p).length > 220 && cur) {
        out.push(cur);
        cur = p;
      } else cur += p;
    }
    if (cur.trim()) out.push(cur);
    return out;
  }

  function mark(el) {
    unmark();
    activeEl = el;
    activePrev = { bg: el.style.backgroundColor, tr: el.style.transition };
    el.style.transition = "background-color .2s";
    el.style.backgroundColor = "rgba(127,224,195,.28)";
  }
  function unmark() {
    if (activeEl && activePrev) {
      activeEl.style.backgroundColor = activePrev.bg;
      activeEl.style.transition = activePrev.tr;
    }
    activeEl = activePrev = null;
  }

  function stop() {
    session++;
    speechSynthesis.cancel();
    paused = false;
    unmark();
    player.classList.remove("show");
  }

  function setPlayIcon(playing) {
    mainBtn.innerHTML = svg(playing ? "pause" : "play");
  }

  async function readText(text, opts = {}) {
    stop();
    const my = session;
    const lang = await detect(text);
    if (my !== session) return;
    const voices = await voicesReady();
    const voice = pickVoice(voices, lang);
    const parts = chunk(text);
    badge.textContent = lang.split(/[-_]/)[0].toUpperCase();
    setPlayIcon(true);
    player.classList.add("show");

    let i = 0;
    const next = () => {
      if (my !== session) return;
      if (i >= parts.length) {
        if (opts.onDone) opts.onDone();
        else stop();
        return;
      }
      const u = new SpeechSynthesisUtterance(parts[i++]);
      if (voice) u.voice = voice;
      u.lang = voice ? voice.lang : lang;
      u.rate = cfg.rate;
      u.onend = next;
      u.onerror = (e) => {
        if (e.error !== "interrupted" && e.error !== "canceled") next();
      };
      speechSynthesis.speak(u);
    };
    next();
  }

  function nextBlock(el) {
    const all = [...document.querySelectorAll(BLOCKS)].filter((n) => !host.contains(n));
    const idx = all.indexOf(el);
    for (let j = idx + 1; j < all.length; j++) {
      const n = all[j];
      if (all.some((o) => o !== n && n.contains(o) && o.matches(BLOCKS) && all.indexOf(o) > idx)) continue;
      if (usable(n) && n.offsetParent !== null) return n;
    }
    return null;
  }

  function readBlock(el) {
    const text = (el.innerText || "").trim();
    mark(el);
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    readText(text, {
      mode: "block",
      onDone: () => {
        const n = cfg.autoNext ? nextBlock(el) : null;
        if (n) readBlock(n);
        else stop();
      },
    });
    // readText calls stop() first, which clears the mark, so set it again
    mark(el);
  }

  mainBtn.addEventListener("click", () => {
    if (paused) {
      speechSynthesis.resume();
      paused = false;
      setPlayIcon(true);
    } else {
      speechSynthesis.pause();
      paused = true;
      setPlayIcon(false);
    }
  });
  stopBtn.addEventListener("click", stop);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && player.classList.contains("show")) stop();
  });
  addEventListener("pagehide", () => speechSynthesis.cancel());

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "read-text" && msg.text) readText(msg.text, { mode: "selection" });
    if (msg.type === "read-selection") {
      const t = (getSelection() || "").toString().trim();
      if (t) readText(t, { mode: "selection" });
    }
  });
})();
