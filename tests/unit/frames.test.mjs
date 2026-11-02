// Which frame the popup's Fill button may fill.
import assert from "node:assert/strict";
import { test } from "node:test";
import { pickFrame } from "../../frames.js";

const SITE = "https://login.example.com", AD = "https://ads.example.net";
const f = (frameId, origin, flags = {}) => ({
  frameId, result: { origin, focused: false, focusInChild: false, hasField: false, ...flags },
});

test("a focused box in the top frame", () => {
  assert.deepEqual(pickFrame([f(0, SITE, { focused: true, hasField: true })]), { frameId: 0, explicit: true });
});
test("the top frame's code field beats an iframe's", () => {
  assert.deepEqual(pickFrame([f(0, SITE, { hasField: true }), f(3, AD, { hasField: true })]), { frameId: 0, explicit: false });
});
test("a cross-origin iframe's field is never filled unfocused", () => {
  assert.equal(pickFrame([f(0, SITE), f(3, AD, { hasField: true })]), null);
});
test("nor when it claims focus but the top frame's focus isn't on a frame", () => {
  assert.equal(pickFrame([f(0, SITE), f(3, AD, { focused: true })]), null);
});
test("a cross-origin frame the user is typing in (e.g. a 3-D Secure check)", () => {
  assert.deepEqual(pickFrame([f(0, SITE, { focusInChild: true }), f(3, AD, { focused: true })]), { frameId: 3, explicit: true });
});
test("a same-origin iframe's code field", () => {
  assert.deepEqual(pickFrame([f(0, SITE), f(2, SITE, { hasField: true })]), { frameId: 2, explicit: false });
});
test("several frames claim focus: the single same-origin one", () => {
  const frames = [f(0, SITE, { focusInChild: true }), f(2, SITE, { focused: true }), f(3, AD, { focused: true })];
  assert.deepEqual(pickFrame(frames), { frameId: 2, explicit: true });
});
test("ambiguous focus across origins: fill nothing", () => {
  const frames = [f(0, SITE, { focusInChild: true }), f(2, AD, { focused: true }), f(3, "https://other.test", { focused: true })];
  assert.equal(pickFrame(frames), null);
});
test("opaque origins don't count as the same origin", () => {
  assert.equal(pickFrame([f(0, "null"), f(2, "null", { hasField: true })]), null);
});
test("no answer from the top frame (restricted page): fill nothing", () => {
  assert.equal(pickFrame([f(3, SITE, { focused: true }), { frameId: 0, result: null }]), null);
  assert.equal(pickFrame([]), null);
});
