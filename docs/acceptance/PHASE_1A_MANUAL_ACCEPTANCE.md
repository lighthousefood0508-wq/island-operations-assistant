# Phase 1A Manual Acceptance

Estimated time: 5 minutes.

## Start

```powershell
npm run migrate
npm run dev
```

Open Admin at `http://127.0.0.1:3090/admin` and POS at `http://127.0.0.1:3090/pos`.

## Checklist

| Step | Expected result | Pass | Fail | Notes | Screenshot path |
| --- | --- | --- | --- | --- | --- |
| Create category | Active category appears in list with a system-generated code | [ ] | [ ] | | |
| Create product draft | Internal name, display name, POS short name, price, and POS channel save | [ ] | [ ] | | |
| Publish | Success message shows version `v1`; product status is `published` | [ ] | [ ] | | |
| POS display | POS shows product display name, POS short name, price, and category identifier | [ ] | [ ] | | |
| Refresh POS | Published product remains after refresh | [ ] | [ ] | | |
| Negative publish | Missing POS short name, price, or channel shows a validation message | [ ] | [ ] | | |

## Suggested sample

Create category `便當` / sort `10`; the system generates the code. Create product `一曲東坡肉`, POS short name `東坡`, price `180`, and enable `pos`. Save the draft, then select **發布新版本**.

## Issue record

Record the URL, exact action, expected result, actual result, browser, timestamp, and a screenshot path. Do not change data or code while recording an acceptance failure.
