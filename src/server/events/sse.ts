import type { ServerResponse } from "node:http";

export function openSseStream(response: ServerResponse): void {
  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive"
  });
  response.write('event: connected\ndata: {"service":"desert-island-ros"}\n\n');
  writeHeartbeat(response);
}

export function writeHeartbeat(response: ServerResponse): void {
  response.write(`event: heartbeat\ndata: {"at":"${new Date().toISOString()}"}\n\n`);
}
