# Migration Plan

| Phase | Goal | Legacy impact | Acceptance and rollback |
| --- | --- | --- | --- |
| 0 | Foundation and architecture | none | tests pass; delete only new project if abandoned |
| 1 | Catalog Admin and publication APIs | none | create/read/publish test catalog; disable new route to roll back |
| 2 | Event allocation and Customer preorder | parallel only | verify idempotent orders; route traffic back to legacy |
| 3 | POS/Kitchen served from ROS | controlled pilot | compare orders; switch device back to legacy |
| 4 | Cost/inventory ledger and reporting sync | reporting only first | retain source DB and replay sync job |
| 5 | LINE/receipt integrations through pending review | no direct write initially | disable webhook worker and retain review queue |
| 6 | VPS, backups, monitoring, production auth | new deployment only | restore tested backup or return to local pilot |

No one-step legacy migration is allowed. Exported data must be profiled, mapped, dry-run, reconciled, and approved before import.
