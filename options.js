import { getSession, listMailboxes } from "./jmap.js";
const $ = (id) => document.getElementById(id);
const say = (text, cls = "") => { $("msg").textContent = text; $("msg").className = cls; };

let token = null;
let inboxId = null;

function go(n) {
  for (let i = 1; i <= 4; i++) $(`s${i}`).hidden = i !== n;
  [...$("steps").children].forEach((d, i) => d.classList.toggle("on", i < n));
  if (n === 3) loadFolders();
}
document.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => go(+b.dataset.go)));

$("show").onclick = () => {
  const hidden = $("token").type === "password";
  $("token").type = hidden ? "text" : "password";
  $("show").textContent = hidden ? "Hide" : "Show";
};

$("connect").onclick = async () => {
  const t = $("token").value.trim();
  if (!t) return say("Please paste your token first.", "err");
  say("Checking…");
  try {
    await getSession(t);
    await chrome.storage.local.set({ token: t });
    token = t;
    say("✓ Connected", "ok");
    setTimeout(() => go(3), 500);
  } catch (e) {
    say(`Couldn't connect: ${e.message}. Check the token and try again.`, "err");
  }
};

async function loadFolders() {
  const wrap = $("boxes");
  wrap.textContent = "Loading…";
  try {
    const session = await getSession(token);
    const boxes = await listMailboxes(token, session);
    const { mailboxIds } = await chrome.storage.local.get("mailboxIds");
    inboxId = boxes.find((b) => b.role === "inbox")?.id;
    const selected = new Set(mailboxIds?.length ? mailboxIds : [inboxId]);
    const kids = (p) => boxes.filter((b) => (b.parentId ?? null) === p)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    wrap.replaceChildren();
    const add = (parent, depth) => kids(parent).forEach((b) => {
      const l = document.createElement("label");
      l.className = "box";
      l.style.paddingLeft = `${depth * 18}px`;
      const cb = document.createElement("input");
      Object.assign(cb, { type: "checkbox", checked: selected.has(b.id) });
      cb.dataset.id = b.id;
      l.append(cb, b.name);
      wrap.append(l);
      add(b.id, depth + 1);
    });
    add(null, 0);
  } catch (e) {
    wrap.textContent = `Couldn't load folders: ${e.message}`;
  }
}

$("savefolders").onclick = async () => {
  let ids = [...$("boxes").querySelectorAll("input:checked")].map((x) => x.dataset.id);
  if (!ids.length && inboxId) ids = [inboxId];
  await chrome.storage.local.set({ mailboxIds: ids });
  go(4);
};

$("done").onclick = () => window.close();

$("disconnect").onclick = async (e) => {
  e.preventDefault();
  if (!confirm("Remove your token and all saved codes from this browser?")) return;
  await chrome.storage.local.clear();
  token = null;
  $("token").value = "";
  say("");
  go(1);
};

chrome.storage.local.get("token").then((s) => {
  token = s.token ?? null;
  go(token ? 3 : 1); // returning users land on the folder step
});
