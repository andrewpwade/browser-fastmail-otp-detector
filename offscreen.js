chrome.runtime.onMessage.addListener((msg) => {
  if (msg.target !== "offscreen") return;
  const ta = document.createElement("textarea");
  ta.value = msg.text;
  document.body.append(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
});
