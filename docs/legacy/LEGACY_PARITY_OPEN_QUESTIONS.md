# Legacy Parity Open Questions

Approval: DECISIONS #020. These are decisions for the Architecture Owner. No item below is approved merely because it existed in Legacy.

| Decision | Why Legacy is insufficient | Options to review | ADR / impact |
| --- | --- | --- | --- |
| Invoice request ownership | Legacy stores invoice fields inside an order but never issues one. | A. limited immutable Order extension for a request snapshot; B. future Invoice domain/service. | Order Entity currently forbids invoice fields; requires explicit approval. |
| No-show edit authority | Legacy allows staff to edit no-show records. | A. no edits after cancellation; B. limited correction action with explicit actor/reason/audit; C. new order instead. | ADR-014 and audit integrity. |
| Amend submitted item quantities | Legacy edits pending items and recomputes remaining locally. | A. forbid; B. explicit staff amendment with atomic delta and audit; C. cancel/recreate before production only. | ADR-015 quantity lifecycle; affects order snapshots. |
| Convert onsite cart/order to preorder | Legacy turns an unsubmitted cart into a reservation. | A. allow only before Order creation; B. cancel/recreate a preorder; C. distinct staff reservation draft. | ADR-014/015; do not mutate submitted source casually. |
| POS cart reservation | Legacy subtracts cart quantity from its local remaining. | A. no central reserve for staff cart, rely on submit transaction; B. central short reservation with expiry. | ADR-015 currently specifies no POS reservation; B would change ADR. |
| Waste ownership | Legacy calls closeout waste and calculates local cost. | A. Operations records operational waste fact, Cost consumes via future contract; B. Cost owns complete waste record after a contract exists. | Constitution and ADR-018 gap; requires design. |
| Cost / margin timing | Legacy displays costs continuously on POS reporting. | A. only after Cost domain/contract; B. clearly labelled estimate later. | Product Contract prohibits Cost fields; no fake P&L. |
| Google Sheets export moment | Legacy exports served orders and closeout from browser. | A. formal completed/Sales Contract export; B. separate operational report export for non-financial snapshots. | ADR-018: Sales Contract only at completed. |
| Customer pending order allocation | Legacy customer submissions reduce local availability before staff acceptance. | A. Kiosk uses 10-minute central reserve; B. preorder directly sells; C. staff review queue without allocation. | ADR-015 determines A/B; source must be explicit. |
| LINE Pay v1 meaning | Legacy only sets a display/payment label. | A. record manual Payment with `paid`; B. record payment method while still unpaid; C. integrate a provider later. | ADR-014; no UI may imply paid without state change. |
| Preorder deadline and quota | Legacy relies on query-string cutoff and shared local stock. | A. Event field with server timezone validation plus per-product quota; B. no quota, share sellable quantity only. | Existing open questions; ADR-015. |
| Customer data retention | Legacy retains names/phone tails locally/JSON with no policy. | Define minimum fields, access, retention and deletion policy before Kiosk/Preorder. | Privacy and audit design. |

## Required UI rules already decided

1. POS home: remaining main meals, pending production, preorder production only.
2. Financial data: Statistics and Closeout only.
3. Debug overlay: hidden unless `debug=1`.
4. UI may present a simple workflow, but must not merge the Order, Payment and Production state machines.
