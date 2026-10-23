import { getSession } from "./jmap.js";
const $ = (id) => document.getElementById(id);
const say = (text, cls = "") => { $("msg").textContent = text; $("msg").className = cls; };

chrome.storage.local.get("token").then(({ token }) => {
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
  } catch (e) {
    say(`Couldn't connect: ${e.message}`, "err");
  }
};
