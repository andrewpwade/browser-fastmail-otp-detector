// Optional on-page suggestion: when a login-code field gets focus and a fresh code is waiting,
// show a small "Fill code" chip next to it. Registered only if the user enables it in settings.
(() => {
  const F = globalThis.__mccFill;
  if (!F || globalThis.__mccContent) return;
  globalThis.__mccContent = true;

  let host = null;
  const dismissed = new Set(); // ids the user closed on this page

  let hideTimer = null;
  let shownFor = null; // the field the current chip belongs to
  const hide = () => { host?.remove(); host = null; shownFor = null; };

  const ask = async (msg) => {
    try { return await chrome.runtime.sendMessage(msg); } catch { return null; }
  };

  const ago = (t) => {
    const m = Math.floor((Date.now() - t) / 60000);
    return m < 1 ? "just now" : `${m} min ago`;
  };

  function place(field) {
    if (!host) return;
    const r = field.getBoundingClientRect();
    host.style.top = `${Math.min(r.bottom + 4, innerHeight - 44)}px`;
    host.style.left = `${Math.max(4, Math.min(r.left, innerWidth - 220))}px`;
  }

  const STYLE = `
    .chip,.menu{display:flex;font:600 13px system-ui,sans-serif;background:#3b5bdb;color:#fff;
      border-radius:8px;box-shadow:0 2px 10px #0004;padding:2px}
    .chip{align-items:center;gap:2px}
    .menu{flex-direction:column;margin-top:4px}.menu[hidden]{display:none}
    button{all:unset;cursor:pointer;padding:6px 10px;border-radius:6px;white-space:nowrap}
    button:hover{background:#ffffff26}.x{padding:6px 8px;opacity:.8}
    .menu button{font-weight:500}`;

  // One offer: a single "Fill code ••••34" chip. Several: "Fill code ▾" opens a list so the
  // user can pick by sender.
  function show(field, els, offers) {
    hide();
    host = document.createElement("div");
    host.style.cssText = "all:initial;position:fixed;z-index:2147483647";
    const root = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = STYLE;

    const button = (text, cls) => {
      const b = document.createElement("button");
      b.textContent = text;
      if (cls) b.className = cls;
      b.addEventListener("mousedown", (e) => e.preventDefault()); // don't steal focus from the field
      return b;
    };

    async function fillWith(e, id) {
      if (!e.isTrusted) return; // ignore clicks scripted by the page
      if (document.activeElement !== field || !F.onScreen(field)) return hide();
      const r = await ask({ type: "claim", id });
      if (r?.code) {
        F.fillEls(els, r.code);
        F.watch(id, els); // only counts as used once it is submitted and accepted
        dismissed.add(id); // don't offer the code being tried again on this page
      }
      hide();
    }

    const chip = document.createElement("div");
    chip.className = "chip";
    const main = button(offers.length === 1 ? `Fill code ${offers[0].masked}` : "Fill code ▾");
    const x = button("✕", "x");
    x.title = "Dismiss";
    x.addEventListener("click", (e) => {
      if (!e.isTrusted) return;
      offers.forEach((o) => dismissed.add(o.id));
      hide();
    });
    chip.append(main, x);
    root.append(style, chip);

    if (offers.length === 1) {
      main.addEventListener("click", (e) => fillWith(e, offers[0].id));
    } else {
      const menu = document.createElement("div");
      menu.className = "menu";
      menu.hidden = true;
      for (const o of offers) {
        const row = button(`${(o.from || "Unknown sender").slice(0, 24)} · ${o.masked} · ${ago(o.at)}`);
        row.addEventListener("click", (e) => fillWith(e, o.id));
        menu.append(row);
      }
      main.addEventListener("click", (e) => { if (e.isTrusted) menu.hidden = !menu.hidden; });
      root.append(menu);
    }
    clearTimeout(hideTimer); // a blur from the previous field must not remove the chip we just showed
    document.documentElement.append(host);
    shownFor = field;
    place(field);
  }

  async function onFocus(el) {
    const t = F.targetFor(el, false);
    if (!t || !F.onScreen(el) || shownFor === el) return;
    const offers = ((await ask({ type: "latest" })) ?? []).filter((o) => !dismissed.has(o.id));
    if (!offers.length) return;
    if (document.activeElement !== el || shownFor === el) return; // focus moved, or already shown, while we were asking
    show(el, t.els, offers);
  }

  // The background script asks this after a submitted code's page has navigated: is there still a code field?
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg.type === "hasCodeField") reply(!!F.findTarget(false));
  });

  addEventListener("focusin", (e) => onFocus(e.target), true);
  addEventListener("focusout", () => { hideTimer = setTimeout(hide, 200); }, true);
  addEventListener("scroll", () => host && hide(), true);
  addEventListener("resize", hide);
  // A code field may already have focus when the page loads.
  setTimeout(() => document.activeElement && onFocus(document.activeElement), 500);
})();
