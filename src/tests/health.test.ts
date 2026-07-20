import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { createRosServer } from "../server/index.js";

test("health endpoint reports an initialized ROS foundation", async () => {
  const server = createRosServer({ host: "127.0.0.1", port: 0, databasePath: "./data/test-ros.sqlite" });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const response = await fetch(`http://127.0.0.1:${address.port}/health`);
  const body = await response.json() as { status: string; service: string };
  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.service, "desert-island-ros");
  server.close();
  await once(server, "close");
});
