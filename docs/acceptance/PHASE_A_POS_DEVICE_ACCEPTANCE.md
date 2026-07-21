# Phase A POS Device Acceptance

This five-minute check uses ROS as the central ordering system. Do not use it to replace Legacy until the Architecture Owner explicitly approves that change.

1. On the Windows ROS host, open `/admin`, create or confirm a product, then publish it.
2. Open `/admin/events`, create today's Event, enter sellable quantities, and open the Event.
3. On the Samsung A9+ in landscape, open `/pos`. Confirm the three top cards show remaining meals, pending production, and preorder not enabled.
4. On the Samsung A8, open `/kitchen`. Keep both devices connected to the same ROS server.
5. On the A9+, add a product, enter a test customer name and optional notes, then select `建立中央訂單`.
6. Without refreshing the A8, confirm the new order appears in Kitchen. On the A9+, open `待出餐` and confirm the order number, customer name, items, total, and three status values are visible.
7. On the A8, move the order through preparing, ready, and served. Confirm the A9+ queue updates after each step without refresh.
8. Open `/pos/statistics` on another device and confirm it reflects the same central Event data.
9. Temporarily disconnect the A8 network, reconnect it, and confirm it fetches the latest central order state without creating another order.
10. If ROS behaves unexpectedly, stop using ROS for that order, continue with Legacy, and record the time, device, order number, and screenshot. Do not edit code on site.
