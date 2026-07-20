# ADR-004: Web Admin in the same ROS deployment

## Decision

The initial Admin is a web application served alongside ROS and using the same authenticated API.

## Rationale

It is accessible from phone/tablet/desktop, has one deployment surface, and avoids desktop-program distribution costs.

## Consequence

Admin authorization must be enforced server-side; route separation is not security on its own.
