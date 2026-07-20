# Project Vision

ROS v1 is the future operational core for Desert Island: one authoritative server for catalog, events, orders, inventory, costs, and operational reporting. It replaces duplicated browser-local state gradually, not by modifying the legacy system in place.

Success means a product is authored once, deliberately published to permitted sales channels, and every order is processed against the same server-side state. Google Sheets remains useful for reporting and review; it is not the real-time transaction database.

Non-goals for this foundation: copying legacy code, importing legacy data, deploying a VPS, live payments, printer support, receipt OCR, LINE webhook handling, or production authentication.
