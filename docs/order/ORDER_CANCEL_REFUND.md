# Cancellation, Refund, and Accepted Waste Gap

Cancellation, refund, payment void, and quantity restoration are separate actions.

| Situation | Quantity | Payment / order effect | Required audit |
| --- | --- | --- | --- |
| Kiosk timeout before payment | release reserved | `submitted -> cancelled`, payment remains `unpaid` | reason `timeout`, time, system actor. |
| Submitted cancellation before production | release reserved | cancel Order | actor, reason, time. |
| Confirmed cancellation before `preparing` | reverse sold | cancel Order; future paid refund/void is separate | actor, reason, time, payment reference if present. |
| Cancellation at `preparing`, `ready`, or `served` | do not restore sold | cancel Order; refund remains separate policy | `cancelledBy`, `cancelledAt`, mandatory reason, production stage, audit. |
| Partial/full refund after completion | never restore quantity | payment becomes refunded state; Order normally remains completed | authorised actor, amount, reason, payment reference. |

## Accepted known gap

A production-stage cancellation has consumed food but does not create a Sales Contract because the Order is cancelled. Cost will therefore not learn of this consumption in first version. This is an accepted known gap. A future independent Waste Contract/reporting flow will address it; no Waste Contract or Cost change is designed or implemented now.

~~~mermaid
flowchart LR
  Cancel[Cancel before preparing] --> Release[Release reserved or reverse sold]
  Release --> Remaining[remainingQuantity increases]
  Remaining --> Audit[Write cancellation audit]
~~~

~~~mermaid
flowchart LR
  Cancel[Cancel at preparing ready or served] --> Keep[Do not restore soldQuantity]
  Keep --> Required[Require cancelledBy cancelledAt reason and audit]
  Required --> Gap[Future Waste reporting source]
~~~
