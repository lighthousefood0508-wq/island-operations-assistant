# UI Philosophy

ROS is designed for one exhausted food truck operator.

The UI must reduce decision load during service. It must not become an ERP screen, a developer dashboard, or a decorative product showcase.

## High-Frequency Operations Come First

The more often a task happens during service, the faster and simpler the UI must be.

High-frequency:

- POS item selection
- Add to cart
- Customer name and phone tail
- Submit order
- Kitchen status update
- Check active orders

Low-frequency:

- Product maintenance
- Event setup
- Health checks
- Share links
- Statistics
- Closeout review

Low-frequency work belongs in Back Office, not POS.

## Operator Workflow Drives Layout

The operator thinks:

```text
Event
-> Products
-> Inventory
-> Open Event
-> POS
-> Kitchen
-> Close
-> Statistics
```

The operator does not think:

```text
Category
-> Product
-> Publish
-> Inventory
```

Product and category maintenance exists, but it is not the daily service workflow.

## POS Philosophy

POS must be compact.

POS should show only what helps a cashier finish the current order quickly:

- Current event
- Event status
- Remaining main meals
- Active orders
- Reservation count when available
- Operator
- Product grid
- Cart
- Customer name and phone tail
- Payment method placeholder only if already approved for the current phase

POS must not show:

- Revenue
- Cost
- Gross margin
- Cloudflare status
- Health cards
- QR codes
- Product management
- Event setup
- Back-office diagnostics

## Kitchen Philosophy

Kitchen must show production work clearly:

- Waiting orders
- Preparing orders
- Ready or served orders
- Order number
- Items and quantities
- Notes
- Waiting time

Kitchen must not edit:

- Product data
- Price
- Inventory
- Payment
- Event status

## Back Office Philosophy

Back Office is the daily control room.

It should prioritize:

1. Event and inventory setup
2. Product catalog maintenance
3. Statistics and closeout
4. Health and sharing links
5. Device connection information

Back Office may contain operational detail that POS should hide.

## Visual Design Principle

Visual polish is valuable only if it improves operation.

Never sacrifice cashier speed for aesthetics.

Spacing, color, typography, and components should make the daily workflow easier to scan and operate.
