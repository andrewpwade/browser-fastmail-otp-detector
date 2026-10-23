// Optional on-page suggestion: when a login-code field gets focus and a fresh code is waiting,
// show a small "Fill code" chip next to it. Registered only if the user enables it in settings.
(() => {
  const F = globalThis.__mccFill;
  if (!F || globalThis.__mccContent) return;
  globalThis.__mccContent = true;

  let host = null;
  let dismissed = null; // id of a code the user closed on this page

  const hide = () => { host?.remove(); host = null; };

  const ask = async (msg) => {
    try { return await chrome.runtime.sendMessage(msg); } catch { return null; }
  };

  function place(field) {
    if (!host) return;
    const r = field.getBoundingClientRect();
    host.style.top = `${Math.min(r.bottom + 4, innerHeight - 44)}px`;
    host.style.left = `${Math.max(4, Math.min(r.left, innerWidth - 220))}px`;
  }

  function show(els, offer) {
    hide();
    host = document.createElement("div");
    host.style.cssText = "all:initial;position:fixed;z-index:2147483647";
    const root = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = `
      .chip{display:flex;align-items:center;gap:2px;font:600 13px system-ui,sans-serif;background:#3b5bdb;color:#fff;
        border-radius:8px;box-shadow:0 2px 10px #0004;padding:2px}
      button{all:unset;cursor:pointer;padding:6px 10px;border-radius:6px}
      button:hover{background:#ffffff26}.x{padding:6px 8px;opacity:.8}`;
    const chip = document.createElement("div");
    chip.className = "chip";
    const fillBtn = document.createElement("button");
    fillBtn.textContent = `Fill code ${offer.masked}`;
    const x = document.createElement("button");
    x.className = "x";
    x.textContent = "✕";
    x.title = "Dismiss";
    // mousedown must not steal focus from the field
    for (const b of [fillBtn, x]) b.addEventListener("mousedown", (e) => e.preventDefault());
    fillBtn.addEventListener("click", async (e) => {
      if (!e.isTrusted) return; // ignore clicks scripted by the page
      const r = await ask({ type: "claim", id: offer.id });
      if (r?.code) F.fillEls(els, r.code);
      hide();
    });
    x.addEventListener("click", (e) => {
      if (!e.isTrusted) return;
      dismissed = offer.id;
      hide();
    });
    chip.append(fillBtn, x);
    root.append(style, chip);
    document.documentElement.append(host);
    place(els[0]);
  }

  async function onFocus(el) {
    const t = F.targetFor(el, false);
    if (!t) return;
    const offer = await ask({ type: "latest" });
    if (!offer || offer.id === dismissed) return;
    if (document.activeElement !== el) return; // focus moved while we were asking
    show(t.els, offer);
  }

  addEventListener("focusin", (e) => onFocus(e.target), true);
  addEventListener("focusout", () => setTimeout(hide, 200), true);
  addEventListener("scroll", () => host && hide(), true);
  addEventListener("resize", hide);
  // A code field may already have focus when the page loads.
  setTimeout(() => document.activeElement && onFocus(document.activeElement), 500);
})();
