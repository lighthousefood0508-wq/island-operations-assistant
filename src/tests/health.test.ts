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
