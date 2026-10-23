// Finds a login-code field on the page and fills it. Injected on demand (popup Fill button)
// or registered as a content script when the user enables on-page suggestions.
(() => {
  if (globalThis.__mccFill) return;

  const TEXTY = /^(text|tel|number|password|)$/i;
  const HINT = /otp|one.?time|verif|2fa|mfa|passcode|security.?code|auth\w*.?code|\btoken\b|\bpin\b|(^|[^a-z])code([^a-z]|$)/i;
  const SKIP = /search|e-?mail|user|phone|zip|postal|coupon|promo|discount|gift|captcha/i;

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  };
  const usable = (el) => el?.tagName === "INPUT" && !el.disabled && !el.readOnly && TEXTY.test(el.type) && visible(el);

  function isCodeField(el) {
    if (!usable(el)) return false;
    if (el.autocomplete === "one-time-code") return true;
    const attrs = [el.name, el.id, el.placeholder, el.getAttribute("aria-label"), el.getAttribute("data-testid")].join(" ");
    return HINT.test(attrs) && !SKIP.test(attrs);
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
    if (isCodeField(el) || (explicit && usable(el))) return { els: [el] };
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

  function fill(code, explicit) {
    const t = findTarget(explicit);
    if (!t) return false;
    fillEls(t.els, code);
    return true;
  }

  globalThis.__mccFill = { targetFor, findTarget, fillEls, fill };
})();
