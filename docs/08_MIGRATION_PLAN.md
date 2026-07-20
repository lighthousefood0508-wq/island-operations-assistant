# Migration Plan

| Phase | Goal | Legacy impact | Acceptance and rollback |
| --- | --- | --- | --- |
| 0.5 | Constitution-aligned foundation and guards | none | contracts/guards pass; delete only new project if abandoned |
| 1 | Small Catalog Admin and Product Contract publication | none | create/read/publish test catalog; disable new route to roll back |
| 2 | Event allocation and Customer preorder | parallel only | verify idempotent orders; route traffic back to legacy |
| 3 | POS and Kitchen pilot from the same REST/SSE source | controlled pilot | compare orders; switch device back to legacy |
| 4 | Cost ledger and daily Sales Contract import | reporting only first | retain source record and replay the daily import |
| 5 | LINE/receipt review through controlled adapters | no direct write initially | disable adapter and retain review queue |
| 6 | VPS, backups, monitoring, production auth | new deployment only | restore tested backup or return to local pilot |

No one-step legacy migration is allowed. Exported data must be profiled, mapped, dry-run, reconciled, and approved before import. A future physical split to Operations/Cost databases preserves Product and Sales Contracts rather than adding a new interface.
