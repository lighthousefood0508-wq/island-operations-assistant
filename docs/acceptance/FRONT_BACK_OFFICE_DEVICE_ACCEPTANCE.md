# Front / Back Office Device Acceptance

Approval Record: DECISIONS #035

Use the current ROS Base URL from Back Office. Do not use a hard-coded tunnel, LAN IP, or localhost URL when testing mobile devices.

## Device Roles

- Desktop: Back Office
- A9+: POS
- A8: Kitchen
- Optional iPad: Statistics or Back Office

## Checklist

1. Open Back Office: `/admin`.
2. Confirm the top navigation shows POS, Kitchen, and Back Office.
3. Open Product Management from Back Office.
4. Open Event + Sellable Inventory: `/admin/events`.
5. Confirm Event Admin can show stock fields: planned, reserved, sold, remaining.
6. Open Back Office Health: `/admin/health`.
7. Copy the POS link from the sharing panel.
8. Open POS on A9+.
9. Confirm POS shows only four tabs: 現場點餐, 待出餐, 預約單, 客人訂單.
10. Confirm POS does not show revenue, cost, gross profit, waste, or cash difference.
11. Add one product to the POS cart.
12. Tap Kitchen in the top navigation.
13. Confirm the browser asks before leaving because the cart is not submitted.
14. Choose to stay and confirm POS remains open.
15. Clear the cart, then open Kitchen.
16. On Kitchen, confirm top navigation can go to POS and Back Office.
17. From Back Office, open Statistics: `/admin/statistics`.
18. Confirm Statistics shows the correct Event name, not `undefined`.
19. Place a test order from POS.
20. Confirm Kitchen receives the order without refresh.
21. Change Kitchen production status and confirm POS updates without refresh.
22. Confirm Statistics updates from central data.

## Failure Notes

Record the time, device, URL, order number, and screenshot for any issue. Legacy remains the primary system for service.
