const list = document.getElementById("list");
chrome.storage.local.get(["codes", "status"]).then(({ codes = [], status = "" }) => {
  document.getElementById("status").textContent = status;
  if (!codes.length) list.textContent = "No codes yet.";
  for (const c of codes) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = '<div><div class="code"></div><div class="sub"></div></div><button>Copy</button>';
    row.querySelector(".code").textContent = c.code;
    row.querySelector(".sub").textContent = `${c.from} · ${new Date(c.at).toLocaleTimeString()}`;
    row.querySelector("button").onclick = (e) => {
      navigator.clipboard.writeText(c.code);
      e.target.textContent = "Copied";
    };
    list.append(row);
  }
});
document.getElementById("opts").onclick = () => chrome.runtime.openOptionsPage();
chrome.action.setBadgeText({ text: "" });
