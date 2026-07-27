import type { ServerResponse } from "node:http";

export type RosEventType = "order.created" | "order.production_changed" | "order.completed" | "payment.confirmed" | "inventory.changed" | "event.opened" | "event.paused" | "event.resumed" | "event.closed" | "closeout.updated";

export type ConnectedDevice = Readonly<{
  deviceId: string;
  page: string;
  connectedAt: string;
  lastActivityAt: string;
}>;

export class SseHub {
  private readonly clients = new Map<ServerResponse, ConnectedDevice>();
  private readonly heartbeatTimer: NodeJS.Timeout;

  constructor() {
    this.heartbeatTimer = setInterval(() => this.heartbeat(), 15_000);
    this.heartbeatTimer.unref();
  }

  connect(response: ServerResponse, device: Pick<ConnectedDevice, "deviceId" | "page">): void {
    response.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", "x-accel-buffering": "no", connection: "keep-alive" });
    const now = new Date().toISOString();
    this.clients.set(response, { ...device, connectedAt: now, lastActivityAt: now });
    response.write("retry: 3000\n\n");
    response.write('event: connected\ndata: {"service":"desert-island-ros"}\n\n');
  }

  disconnect(response: ServerResponse): void { this.clients.delete(response); }

  listDevices(): readonly ConnectedDevice[] {
    return [...this.clients.values()].sort((left, right) => left.connectedAt.localeCompare(right.connectedAt));
  }

  publish(type: RosEventType, eventId: string): void {
    const message = `event: ${type}\ndata: ${JSON.stringify({ eventId, at: new Date().toISOString() })}\n\n`;
    this.broadcast(message);
  }

  private broadcast(message: string): void {
    const now = new Date().toISOString();
    for (const [client, device] of this.clients) {
      try {
        client.write(message);
        this.clients.set(client, { ...device, lastActivityAt: now });
      } catch { this.clients.delete(client); }
    }
  }

  heartbeat(): void {
    const message = `event: heartbeat\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`;
    this.broadcast(message);
  }
}
