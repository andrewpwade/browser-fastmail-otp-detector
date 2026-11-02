// Fills a code into a tab: injects fill.js into every frame, asks each what it offers, and fills
// only the frame chosen by pickFrame (see frames.js), and only if that frame is on the code's site
// (see sites.js) unless `anySite` is set. Used by the popup's Fill button; a module of its own so
// the browser tests can run it against a real tab.
// Returns {status: "filled" | "nofield"} or {status: "mismatch", pageSite}.
import { pickFrame } from "./frames.js";
import { sameSite, siteOfUrl } from "./sites.js";

export async function fillTab(tabId, { code, id, site }, { anySite = false } = {}) {
  const all = { tabId, allFrames: true };
  await chrome.scripting.executeScript({ target: all, files: ["fill.js"] });
  const probes = await chrome.scripting.executeScript({ target: all, func: () => globalThis.__mccFill?.probe() ?? null });
  const pick = pickFrame(probes);
  if (!pick) return { status: "nofield" };
  const pageSite = siteOfUrl(probes.find((p) => p.frameId === pick.frameId).result.origin);
  if (!anySite && !sameSite(site, pageSite)) return { status: "mismatch", pageSite };
  const [res] = await chrome.scripting.executeScript({
    target: { tabId, frameIds: [pick.frameId] },
    func: (c, i, explicit) => globalThis.__mccFill?.fill(c, explicit, i) ?? false, args: [code, id, pick.explicit],
  });
  return { status: res?.result ? "filled" : "nofield" };
}
