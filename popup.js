const $ = (id) => document.getElementById(id);
const FRESH_MS = 10 * 60 * 1000;

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
  $("foot").textContent = token && !isErr ? "Checking your inbox every 30 seconds" : "";

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
  for (const c of codes) {
    const card = el("div", "card" + (Date.now() - c.at < FRESH_MS ? " fresh" : ""));
    const info = el("div", "info");
    info.append(
      el("div", "code", c.code),
      el("div", "subj", c.subject || "(no subject)"),
      el("div", "meta", `${c.from} · ${ago(c.at)}`),
    );
    const btn = el("button", "copy", "Copy");
    card.append(info, btn);
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
