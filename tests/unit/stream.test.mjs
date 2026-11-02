import assert from "node:assert/strict";
import { test } from "node:test";
import { eventStream } from "../../jmap.js";

test("eventStream parses server-sent events split across chunks", async () => {
  const enc = new TextEncoder();
  const chunks = ["event: ping\r\ndata: {\"interval\":20}\r\n\r\nevent: sta", "te\r\ndata: {\"changed\":{\"a\":{\"Email\":\"s2\"}}}\r\n\r\n"];
  globalThis.fetch = async () => ({ ok: true, body: new ReadableStream({ start(c) { chunks.forEach((x) => c.enqueue(enc.encode(x))); c.close(); } }) });
  const out = [];
  for await (const e of eventStream("t", { eventSourceUrl: "x" })) out.push(e);
  assert.deepEqual(out.map((e) => e.event), ["ping", "state"]);
  assert.equal(JSON.parse(out[1].data).changed.a.Email, "s2");
});
