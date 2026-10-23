import { eventStream } from "../jmap.js";
const enc = new TextEncoder();
const chunks = ["event: ping\r\ndata: {\"interval\":20}\r\n\r\nevent: sta", "te\r\ndata: {\"changed\":{\"a\":{\"Email\":\"s2\"}}}\r\n\r\n"];
globalThis.fetch = async () => ({ ok: true, body: new ReadableStream({ start(c) { chunks.forEach((x) => c.enqueue(enc.encode(x))); c.close(); } }) });
const out = [];
for await (const e of eventStream("t", { eventSourceUrl: "x" })) out.push(e);
const ok = out.length === 2 && out[0].event === "ping" && out[1].event === "state" && JSON.parse(out[1].data).changed.a.Email === "s2";
console.log(ok ? "stream: pass" : "stream: FAIL " + JSON.stringify(out));
process.exit(ok ? 0 : 1);
