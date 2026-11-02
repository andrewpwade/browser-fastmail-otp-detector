// Fills a code into a tab: injects fill.js into every frame, asks each what it offers, and fills
// only the frame chosen by pickFrame (see frames.js). Used by the popup's Fill button; a module of
// its own so the browser tests can run it against a real tab.
import { pickFrame } from "./frames.js";

export async function fillTab(tabId, code, id) {
  const all = { tabId, allFrames: true };
  await chrome.scripting.executeScript({ target: all, files: ["fill.js"] });
  const probes = await chrome.scripting.executeScript({ target: all, func: () => globalThis.__mccFill?.probe() ?? null });
  const pick = pickFrame(probes);
  if (!pick) return false;
  const [res] = await chrome.scripting.executeScript({
    target: { tabId, frameIds: [pick.frameId] },
    func: (c, i, explicit) => globalThis.__mccFill?.fill(c, explicit, i) ?? false, args: [code, id, pick.explicit],
  });
  return !!res?.result;
}
