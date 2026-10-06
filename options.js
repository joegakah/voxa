const DEFAULTS = { rate: 1, hover: true, autoNext: true, voices: {} };
const $ = (id) => document.getElementById(id);
let cfg = { ...DEFAULTS };

function flash() {
  $("saved").textContent = "Saved";
  setTimeout(() => ($("saved").textContent = ""), 1200);
}
function save(patch) {
  Object.assign(cfg, patch);
  chrome.storage.sync.set(patch, flash);
}

function buildVoices() {
  const voices = speechSynthesis.getVoices();
  const box = $("voices");
  box.innerHTML = "";
  if (!voices.length) {
    box.innerHTML = '<div class="row">No voices found on this system yet.</div>';
    return;
  }
  const names = new Intl.DisplayNames([navigator.language], { type: "language" });
  const groups = {};
  voices.forEach((v) => (groups[v.lang.split(/[-_]/)[0].toLowerCase()] ||= []).push(v));
  Object.keys(groups).sort().forEach((code) => {
    const row = document.createElement("div");
    row.className = "row";
    const label = document.createElement("label");
    let name = code;
    try { name = names.of(code) || code; } catch (_) {}
    label.textContent = name;
    const sel = document.createElement("select");
    sel.innerHTML = '<option value="">Automatic (best available)</option>';
    groups[code].forEach((v) => {
      const o = document.createElement("option");
      o.value = v.voiceURI;
      o.textContent = `${v.name} (${v.lang})`;
      sel.appendChild(o);
    });
    sel.value = (cfg.voices || {})[code] || "";
    sel.addEventListener("change", () => {
      const voices = { ...(cfg.voices || {}) };
      if (sel.value) voices[code] = sel.value; else delete voices[code];
      save({ voices });
    });
    row.append(label, sel);
    box.appendChild(row);
  });
}

chrome.storage.sync.get(DEFAULTS, (v) => {
  cfg = v;
  $("rate").value = v.rate;
  $("rv").textContent = v.rate + "x";
  $("hover").checked = v.hover;
  $("autoNext").checked = v.autoNext;
  buildVoices();
  speechSynthesis.addEventListener("voiceschanged", buildVoices);
});
$("rate").addEventListener("input", (e) => {
  $("rv").textContent = e.target.value + "x";
  save({ rate: parseFloat(e.target.value) });
});
$("hover").addEventListener("change", (e) => save({ hover: e.target.checked }));
$("autoNext").addEventListener("change", (e) => save({ autoNext: e.target.checked }));
