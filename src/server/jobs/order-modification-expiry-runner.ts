import type {
  OrderModificationExpirySweepResult,
  OrderModificationService
} from "../../domains/operations/application/order-modification-service.js";

export const ORDER_MODIFICATION_EXPIRY_INTERVAL_MS = 60_000;

export type OrderModificationExpiryRunnerOptions = Readonly<{
  intervalMs?: number;
  onSweep?: (result: OrderModificationExpirySweepResult) => void;
  onFailure?: () => void;
}>;

export class OrderModificationExpiryRunner {
  private timer: ReturnType<typeof setInterval> | undefined;
  private sweeping = false;

  constructor(
    private readonly service: OrderModificationService,
    private readonly options: OrderModificationExpiryRunnerOptions = {}
  ) {
    const interval = options.intervalMs ?? ORDER_MODIFICATION_EXPIRY_INTERVAL_MS;
    if (!Number.isSafeInteger(interval) || interval < 10 || interval > 5 * 60_000) {
      throw new Error("Order modification expiry interval is outside the bounded runtime range.");
    }
  }

  start(): void {
    if (this.timer) return;
    this.sweep();
    this.timer = setInterval(() => this.sweep(), this.intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  get running(): boolean {
    return this.timer !== undefined;
  }

  private get intervalMs(): number {
    return this.options.intervalMs ?? ORDER_MODIFICATION_EXPIRY_INTERVAL_MS;
  }

  private sweep(): void {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      const result = this.service.sweepExpiredPrepared();
      this.options.onSweep?.(result);
      if (result.failures > 0) this.options.onFailure?.();
    } catch {
      this.options.onFailure?.();
    } finally {
      this.sweeping = false;
    }
  }
}
