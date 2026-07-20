# Order Lifecycle

Approval: DECISIONS #007. Operations owns the lifecycle. New POS Orders start `pending`; allowed progression is `pending -> cooking -> ready -> completed`. `cancelled` and `no_show` are terminal. The backend rejects every illegal or terminal transition. No transition touches Cost, payment, Kitchen, or Sales Contract.
