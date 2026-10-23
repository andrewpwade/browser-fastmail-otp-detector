// Finds a login-code field on the page and fills it. Injected on demand (popup Fill button)
// or registered as a content script when the user enables on-page suggestions.
(() => {
  if (globalThis.__mccFill) return;

  const TEXTY = /^(text|tel|number|password|)$/i;
  const HINT = /otp|one.?time|verif|2fa|mfa|passcode|security.?code|auth\w*.?code|\btoken\b|\bpin\b|(^|[^a-z])code([^a-z]|$)/i;
  const SKIP = /search|e-?mail|user|phone|zip|postal|coupon|promo|discount|gift|captcha|cvc|cvv|card|country|area|dial|currency|voucher|referral|invite/i;
// Fields that declare themselves as something other than a one-time code.
const OTHER_AUTOCOMPLETE = /(^|\s)(username|email|tel|postal-code|new-password|current-password|name|street-address|organization|country\S*|cc-\S+)(\s|$)/;

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  };
  const usable = (el) => el?.tagName === "INPUT" && !el.disabled && !el.readOnly && TEXTY.test(el.type) && visible(el);

  function isCodeField(el) {
    if (!usable(el)) return false;
    if (el.autocomplete === "one-time-code") return true;
    if (OTHER_AUTOCOMPLETE.test(el.autocomplete)) return false;
    const attrs = [el.name, el.id, el.placeholder, el.getAttribute("aria-label"), el.getAttribute("data-testid")].join(" ");
    return HINT.test(attrs) && !SKIP.test(attrs);
  }

  // Really on screen and not covered or see-through. Stops a page from tricking a click onto
  // the "Fill code" chip by focusing a hidden field.
  function onScreen(el) {
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return false;
    for (let n = el, i = 0; n && i < 8; n = n.parentElement, i++) {
      const s = getComputedStyle(n);
      if (s.opacity === "0" || s.visibility === "hidden") return false;
    }
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && (hit === el || el.contains(hit) || hit.closest("label")?.control === el);
  }

  // A row of 4–8 single-character boxes (the "six little squares" pattern).
  function splitGroup(el) {
    if (!usable(el) || el.maxLength !== 1) return null;
    let node = el.parentElement;
    for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
      const boxes = [...node.querySelectorAll("input")].filter((i) => usable(i) && i.maxLength === 1);
      if (boxes.length > 8) return null;
      if (boxes.length >= 4) return boxes;
    }
    return null;
  }

  // `explicit` = the user asked to fill, so any text box they focused is fair game.
  function targetFor(el, explicit) {
    if (!el || el.tagName !== "INPUT") return null;
    const group = splitGroup(el);
    if (group) return { els: group };
    // An explicit Fill may use any text box the user focused, but never a password box.
    if (isCodeField(el) || (explicit && usable(el) && el.type !== "password")) return { els: [el] };
    return null;
  }

  function findTarget(explicit) {
    const t = targetFor(document.activeElement, explicit);
    if (t) return t;
    const inputs = [...document.querySelectorAll("input")];
    for (const i of inputs) if (isCodeField(i)) return { els: [i] };
    for (const i of inputs) { const g = splitGroup(i); if (g) return { els: g }; }
    return null;
  }

  // Set the value the way frameworks (React etc.) notice.
  function setValue(el, value) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function fillEls(els, code) {
    if (els.length > 1) {
      els.forEach((e, i) => setValue(e, code[i] ?? ""));
      els[Math.min(code.length, els.length) - 1].focus();
    } else {
      const max = els[0].maxLength;
      setValue(els[0], max > 0 ? code.slice(0, max) : code);
      els[0].focus();
    }
  }

  // After a fill, work out whether the code was accepted: the user submits (form submit, Enter, or
  // a click on a button beside the field) and the page then moves on with no code field left.
  // A rejected code leaves the field on the page, so it never counts. A submit is reported to the
  // background script straight away (while the page is still alive), which then watches the tab: if
  // the submit turns into a navigation, it decides once the next page has loaded.
  const WATCH_MS = 2 * 60 * 1000; // stop watching after two minutes
  const SUBMIT_WINDOW_MS = 20 * 1000; // how long after a submit we wait for the page to move on
  let stopWatching = null;

  function watch(id, els) {
    stopWatching?.();
    const send = (msg) => {
      try { globalThis.chrome?.runtime?.sendMessage(msg); } catch { /* extension was reloaded */ }
    };
    const field = els[0];
    const form = field.form;
    const startPath = location.origin + location.pathname;
    const startedAt = Date.now();
    let submittedAt = 0;
    const undo = [];
    const on = (target, type, fn) => {
      target.addEventListener(type, fn, true);
      undo.push(() => target.removeEventListener(type, fn, true));
    };
    const stop = () => { clearInterval(timer); undo.forEach((u) => u()); stopWatching = null; };
    const submitted = () => {
      if (Date.now() - submittedAt > 1000) send({ type: "submitted", id, url: location.href });
      submittedAt = Date.now();
    };

    if (form) on(form, "submit", submitted);
    on(document, "keydown", (e) => { if (e.isTrusted && e.key === "Enter" && els.includes(e.target)) submitted(); });
    on(document, "click", (e) => {
      if (!e.isTrusted) return;
      const button = e.target.closest?.("button, input[type=submit], input[type=button], [role=button]");
      if (button && (form ?? field.parentElement?.parentElement)?.contains(button)) submitted();
    });
    on(window, "pagehide", stop);

    const timer = setInterval(() => {
      if (Date.now() - startedAt > WATCH_MS) return stop();
      if (Date.now() - submittedAt > SUBMIT_WINDOW_MS) return; // not submitted (yet)
      const moved = location.origin + location.pathname !== startPath;
      const gone = !field.isConnected || !visible(field);
      if ((moved || gone) && !findTarget(false)) {
        send({ type: "confirmed", id });
        stop();
      }
    }, 400);
    stopWatching = stop;
  }

  function fill(code, explicit, id) {
    const t = findTarget(explicit);
    if (!t) return false;
    fillEls(t.els, code);
    if (id) watch(id, t.els);
    return true;
  }

  globalThis.__mccFill = { targetFor, findTarget, fillEls, fill, watch, onScreen };
})();
