// Chooses which frame of the active tab the popup's Fill button may fill, from each frame's
// probe() result ({frameId, result: {origin, focused, focusInChild, hasField}}).
// Returns {frameId, explicit} or null.
//
// A code must not go to a frame the user isn't using: an ad or widget iframe on a login page could
// otherwise receive it just by having a text box. So:
//   1. The frame the user's cursor is in, if the focus chain leads there: the top frame itself,
//      or a child frame while the top frame's focus is on a frame element.
//   2. Otherwise a recognisable code field in the top frame,
//   3. or in a child frame from the top frame's own origin.
// Cross-origin frames are only filled when the user has focused a box in them (rule 1).
export function pickFrame(results) {
  const frames = results.filter((r) => r?.result);
  const top = frames.find((r) => r.frameId === 0)?.result;
  if (!top) return null;
  if (top.focused) return { frameId: 0, explicit: true };
  if (top.focusInChild) {
    // A frame keeps its active element after focus leaves it, so several may claim focus. Only an
    // unambiguous one counts: the single focused frame, else the single same-origin focused frame.
    const focused = frames.filter((r) => r.frameId !== 0 && r.result.focused);
    const sameOrigin = focused.filter((r) => r.result.origin === top.origin);
    const pick = focused.length === 1 ? focused[0] : sameOrigin.length === 1 ? sameOrigin[0] : null;
    if (pick) return { frameId: pick.frameId, explicit: true };
  }
  if (top.hasField) return { frameId: 0, explicit: false };
  const same = frames.find((r) => r.frameId !== 0 && r.result.hasField && r.result.origin === top.origin && top.origin !== "null");
  return same ? { frameId: same.frameId, explicit: false } : null;
}
