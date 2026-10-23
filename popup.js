import { maskCode } from "./otp.js";
const $ = (id) => document.getElementById(id);
const FRESH_MS = 10 * 60 * 1000;
const KEEP_MS = 60 * 60 * 1000;

function ago(t) {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString();
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

async function copy(code, btn) {
  await navigator.clipboard.writeText(code);
  btn.textContent = "Copied ✓";
  btn.classList.add("done");
  setTimeout(() => { btn.textContent = "Copy"; btn.classList.remove("done"); }, 1500);
}

async function fillActiveTab(code) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return false;
    const target = { tabId: tab.id, allFrames: true };
    await chrome.scripting.executeScript({ target, files: ["fill.js"] });
    const res = await chrome.scripting.executeScript({
      target, func: (c) => globalThis.__mccFill?.fill(c, true) ?? false, args: [code],
    });
    return res.some((r) => r.result);
  } catch {
    return false; // restricted page (chrome://, store, PDF viewer…)
  }
}

function empty(big, title, sub, action) {
  const d = el("div", "empty");
  d.append(el("div", "big", big), el("b", null, title), el("span", null, sub));
  if (action) { d.append(el("br"), el("br"), action); }
  return d;
}

async function render() {
  const { token, codes = [], status = "" } = await chrome.storage.local.get(["token", "codes", "status"]);
  const list = $("list");
  list.replaceChildren();
  const isErr = status.startsWith("Error");
  $("dot").classList.toggle("err", isErr || !token);
  $("banner").replaceChildren();
  if (isErr) $("banner").append(el("div", "banner", status.replace(/^Error: /, "Can't reach Fastmail: ")));
  $("foot").textContent = token && !isErr ? "Watching your inbox live" : "";

  if (!token) {
    const b = el("button", "btn", "Connect Fastmail");
    b.onclick = () => chrome.runtime.openOptionsPage();
    list.append(empty("🔑", "Let's get you set up", "Add a Fastmail token so codes can show up here.", b));
    return;
  }
  if (!codes.length) {
    list.append(empty("📬", "Waiting for a code…", "When a login code lands in your inbox, it'll appear here and pop up as a notification."));
    return;
  }
  const recent = codes.filter((c) => Date.now() - c.at < KEEP_MS);
  if (!recent.length) {
    list.append(empty("📬", "Waiting for a code…", "When a login code lands in your inbox, it'll appear here and pop up as a notification."));
    return;
  }
  for (const c of recent) {
    const card = el("div", "card" + (Date.now() - c.at < FRESH_MS ? " fresh" : ""));
    const info = el("div", "info");
    const codeEl = el("div", "code", maskCode(c.code));
    const eye = el("button", "eye", "👁");
    eye.title = "Show / hide code";
    eye.onclick = (e) => {
      e.stopPropagation();
      const hidden = codeEl.textContent !== c.code;
      codeEl.textContent = hidden ? c.code : maskCode(c.code);
    };
    info.append(
      codeEl,
      el("div", "subj", c.subject || "(no subject)"),
      el("div", "meta", `${c.from} · ${ago(c.at)}`),
    );
    const btn = el("button", "copy", "Copy");
    const fill = el("button", "fill", "Fill");
    fill.title = "Fill the code field on the current page";
    fill.onclick = async (e) => {
      e.stopPropagation();
      if (await fillActiveTab(c.code)) {
        fill.textContent = "Filled ✓";
      } else {
        await copy(c.code, btn); // nothing to fill here, so copy instead
        fill.textContent = "No field";
      }
      setTimeout(() => { fill.textContent = "Fill"; }, 1500);
    };
    card.append(info, eye, fill, btn);
    card.onclick = () => copy(c.code, btn);
    list.append(card);
  }
}

$("opts").onclick = () => chrome.runtime.openOptionsPage();
$("refresh").onclick = async (e) => {
  e.target.textContent = "…";
  await chrome.runtime.sendMessage({ type: "poll" });
  e.target.textContent = "↻";
};
chrome.storage.onChanged.addListener(render);
chrome.action.setBadgeText({ text: "" });
render();
