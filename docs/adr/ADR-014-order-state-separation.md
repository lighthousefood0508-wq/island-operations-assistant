# ADR-014: Order State Separation

Status: Proposed. Awaiting Architecture Owner Review.

Order lifecycle, payment collection, and production progression use independent state fields. Payment or Kitchen completion never implicitly completes an Order.
