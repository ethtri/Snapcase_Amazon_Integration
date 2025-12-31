# MVP Scope

Goal: process one Amazon Custom order end-to-end through Printful and update Amazon with shipment.

In scope (MVP)
- Detect a new Amazon MFN order (US marketplace).
- Fetch order items and customization payload.
- Produce a print-ready file for the Printful phone case variant.
- Create and confirm a Printful order via API.
- Handle Printful shipment webhook and update Amazon shipment status.
- Persist order state, idempotency keys, and minimal PII.

Out of scope (MVP)
- Multi-marketplace support beyond US.
- Non-phone-case products.
- Manual fulfillment workflows (except optional retry/review UI).
- Optimization for high volume beyond MVP throughput.

Definition of Done (MVP)
- One real or sandbox Amazon Custom order completes the full pipeline.
- Printful order is created and confirmed with correct artwork.
- Shipment update is pushed to Amazon and visible in the order.
- QA smoke checklist passes.
