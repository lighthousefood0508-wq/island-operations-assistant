import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { once } from "node:events";
import path from "node:path";
import { createRosServer } from "../server/index.js";

test("health endpoint reports an initialized ROS foundation", async () => {
  const server = createRosServer({ host: "127.0.0.1", port: 0, databasePath: path.resolve("data", `health-test-${randomUUID()}.sqlite`) });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    const body = await response.json() as { ok: boolean; data: { status: string; service: string } };
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.data.status, "ok");
    assert.equal(body.data.service, "desert-island-ros");
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("device debug API lists active SSE devices without persisting them", async () => {
  const server = createRosServer({ host: "127.0.0.1", port: 0, databasePath: path.resolve("data", `device-debug-${randomUUID()}.sqlite`) });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const controller = new AbortController();
  try {
    const stream = await fetch(`${baseUrl}/events?device=POS-A&page=POS`, { signal: controller.signal });
    assert.equal(stream.status, 200);
    const listed = await fetch(`${baseUrl}/api/debug/devices`);
    const body = await listed.json() as { ok: boolean; data: Array<{ deviceId: string; page: string; connectedAt: string; lastActivityAt: string }> };
    assert.equal(body.ok, true);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0]?.deviceId, "POS-A");
    assert.equal(body.data[0]?.page, "POS");
    assert.ok(body.data[0]?.connectedAt);
    assert.ok(body.data[0]?.lastActivityAt);
  } finally {
    controller.abort();
    await new Promise(resolve => setTimeout(resolve, 0));
    server.close();
    await once(server, "close");
  }
});
