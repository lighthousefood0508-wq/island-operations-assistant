import type { ServerResponse } from "node:http";

export type RosEventType = "order.created" | "order.production_changed" | "order.completed" | "inventory.changed" | "event.closed" | "closeout.updated";

export class SseHub {
  private readonly clients = new Set<ServerResponse>();

  connect(response: ServerResponse): void {
    response.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", "x-accel-buffering": "no", connection: "keep-alive" });
    this.clients.add(response);
    response.write("retry: 3000\n\n");
    response.write('event: connected\ndata: {"service":"desert-island-ros"}\n\n');
  }

  disconnect(response: ServerResponse): void { this.clients.delete(response); }

  publish(type: RosEventType, eventId: string): void {
    const message = `event: ${type}\ndata: ${JSON.stringify({ eventId, at: new Date().toISOString() })}\n\n`;
    for (const client of this.clients) {
      try { client.write(message); } catch { this.clients.delete(client); }
    }
  }

  heartbeat(): void {
    const message = `event: heartbeat\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`;
    for (const client of this.clients) {
      try { client.write(message); } catch { this.clients.delete(client); }
    }
  }
}
