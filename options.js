import { getSession, listMailboxes } from "./jmap.js";
const $ = (id) => document.getElementById(id);
const say = (text, cls = "") => { $("msg").textContent = text; $("msg").className = cls; };

async function showFolders(token) {
  try {
    const session = await getSession(token);
    const boxes = await listMailboxes(token, session);
    const { mailboxIds } = await chrome.storage.local.get("mailboxIds");
    const inbox = boxes.find((b) => b.role === "inbox")?.id;
    const selected = new Set(mailboxIds?.length ? mailboxIds : [inbox]);
    const kids = (p) => boxes.filter((b) => (b.parentId ?? null) === p)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const wrap = $("boxes");
    wrap.replaceChildren();
    const add = (parent, depth) => kids(parent).forEach((b) => {
      const l = document.createElement("label");
      l.className = "box";
      l.style.paddingLeft = `${depth * 18}px`;
      const cb = document.createElement("input");
      Object.assign(cb, { type: "checkbox", checked: selected.has(b.id) });
      cb.style.flex = "none";
      cb.dataset.id = b.id;
      cb.onchange = () => {
        let ids = [...wrap.querySelectorAll("input:checked")].map((x) => x.dataset.id);
        if (!ids.length) { ids = [inbox]; wrap.querySelector(`[data-id="${inbox}"]`).checked = true; }
        chrome.storage.local.set({ mailboxIds: ids });
      };
      l.append(cb, b.name);
      wrap.append(l);
      add(b.id, depth + 1);
    });
    add(null, 0);
    $("folders").hidden = false;
  } catch { $("folders").hidden = true; }
}

chrome.storage.local.get("token").then(({ token }) => {
  if (token) showFolders(token);
  if (token) { $("token").value = token; say("✓ Connected", "ok"); $("save").textContent = "Update"; }
});
$("show").onclick = () => {
  const hidden = $("token").type === "password";
  $("token").type = hidden ? "text" : "password";
  $("show").textContent = hidden ? "Hide" : "Show";
};
$("save").onclick = async () => {
  const token = $("token").value.trim();
  if (!token) return say("Please paste your token first.", "err");
  say("Checking…");
  try {
    await getSession(token);
    await chrome.storage.local.set({ token });
    say("✓ Connected! New codes will pop up automatically.", "ok");
    $("save").textContent = "Update";
    showFolders(token);
  } catch (e) {
    say(`Couldn't connect: ${e.message}`, "err");
  }
};
