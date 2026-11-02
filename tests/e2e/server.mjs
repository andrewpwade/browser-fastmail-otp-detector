// HTTP server for the browser tests: the fake JMAP server (tests/fake-jmap.mjs) with a push
// stream, plus the test pages in ./pages. Pages are reachable at http://localhost:PORT (the "site")
// and http://127.0.0.1:PORT (a different origin, standing in for a third-party iframe).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { jmap } from "../fake-jmap.mjs";

const PAGES = join(import.meta.dirname, "pages");
export const TOKEN = "e2e-token";

export async function startServer() {
  const streams = new Set();
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const authed = req.headers.authorization === `Bearer ${TOKEN}`;
    const json = (body, status = 200) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };

    if (url.pathname === "/jmap/session") return authed ? json(jmap.session(base)) : json({}, 401);
    if (url.pathname === "/jmap" && req.method === "POST") {
      if (!authed) return json({}, 401);
      let body = "";
      for await (const chunk of req) body += chunk;
      return json(jmap.handle(JSON.parse(body)));
    }
    if (url.pathname === "/events") {
      if (!authed) return json({}, 401);
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
      res.write(": connected\n\n");
      streams.add(res);
      req.on("close", () => streams.delete(res));
      return;
    }
    try {
      const page = await readFile(join(PAGES, url.pathname.replace(/^\/+/, "") || "index.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(page);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r)); // loopback only; Chrome reaches it as localhost too
  const port = server.address().port;
  const base = `http://localhost:${port}`;

  return {
    base,
    jmap,
    get streams() { return streams.size; },
    // Tell connected clients the mail changed, as Fastmail's push does.
    pushState() {
      const data = JSON.stringify({ "@type": "StateChange", changed: { acc: { Email: jmap.state } } });
      for (const s of streams) s.write(`event: state\ndata: ${data}\n\n`);
    },
    close() {
      for (const s of streams) s.destroy();
      server.closeAllConnections();
      server.close();
    },
  };
}
