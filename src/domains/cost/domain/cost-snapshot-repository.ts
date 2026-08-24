import type { CostSnapshot } from "./cost-snapshot.js";
export interface CostSnapshotRepository { saveNew(snapshot: CostSnapshot): void; }
