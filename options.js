import { getSession } from "./jmap.js";
const $ = (id) => document.getElementById(id);
chrome.storage.local.get("token").then(({ token }) => { if (token) $("token").value = token; });
$("save").onclick = async () => {
  const token = $("token").value.trim();
  $("msg").textContent = "Checking…";
  try {
    await getSession(token);
    await chrome.storage.local.set({ token });
    $("msg").textContent = "Saved ✓";
  } catch (e) {
    $("msg").textContent = `Failed: ${e.message}`;
  }
};
