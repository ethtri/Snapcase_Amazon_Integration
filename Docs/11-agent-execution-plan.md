# AI agent execution plan (step-by-step)

This plan assumes you are implementing a production-grade MVP in ~incremental commits. Each step has a clear “done” definition.

---

## Phase 0 — Repo skeleton + tooling

### Task 0.1: Create repo skeleton
- `apps/api` (webhooks/admin)
- `apps/worker` (order & shipment workers)
- `packages/core` (DTOs, state machine, shared utils)
- `infra/` (IaC; optional for MVP)

**Done when**
- Lint + unit test runner works
- CI runs

---

## Phase 1 — Amazon SP-API foundation

### Task 1.1: Implement SP-API auth module
- LWA refresh → access token caching
- SigV4 signing wrapper
- HTTP client with retry/backoff

**Done when**
- you can call a non-restricted SP-API endpoint successfully in a dev environment

### Task 1.2: Implement RDT module
- `createRestrictedDataToken` request builder
- caching + expiry
- wrapper: call operation; on restricted error, retry with RDT

**Done when**
- you can fetch order address (if restricted) using RDT without manual steps

---

## Phase 2 — Order ingestion

### Task 2.1: Poller (getOrders)
- persistent checkpoint per marketplace
- idempotent upsert into DB
- enqueue new orders

**Done when**
- new orders show up in DB as `NEW` and are queued exactly once

### Task 2.2: Order details fetch worker
- fetch:
  - order header
  - order items
  - address (RDT if needed)
- persist normalized DTOs
- transition state

**Done when**
- order reaches `FETCHED_ORDER_DETAILS` with items + shipping address stored (redacted logs)

---

## Phase 3 — Customization retrieval

### Task 3.1: Fetch buyerInfo customization
- call `getOrderItemsBuyerInfo` (RDT if needed)
- persist customization fragment per item
- transition state

**Done when**
- order reaches `FETCHED_CUSTOMIZATION` and customization_url/id fields are present for custom orders

### Task 3.2: Download artifact
- downloader with size/time guards
- store raw artifact in S3 (optional; short retention)
- identify artifact type (zip/json/image/pdf)

**Done when**
- artifact stored and retrievable for at least one order

---

## Phase 4 — Rendering

### Task 4.1: Mapping module
- implement SKU → Printful variant + print spec mapping
- load from YAML config first

**Done when**
- unknown SKUs fail fast with explicit error

### Task 4.2: Renderer v1
- implement Strategy A (pass-through if artifact is already print-ready)
- implement Strategy B placeholder (JSON + assets) with TODO
- deterministic output keys + hashing
- upload output to S3

**Done when**
- order reaches `RENDERED_ARTWORK` and has at least one placement file URL

---

## Phase 5 — Printful integration

### Task 5.1: Printful client
- auth header
- store id header support
- retry/backoff

**Done when**
- you can call a trivial Printful endpoint successfully (e.g., list stores or health endpoint, if available)

### Task 5.2: Create Printful files
- call “Add a new file” by URL for each placement
- persist printful_file_id

**Done when**
- order reaches `PRINTFUL_FILES_CREATED`

### Task 5.3: Create + confirm Printful order
- build order payload with recipient + items referencing file ids
- create order
- confirm order
- persist printful order id + status

**Done when**
- Printful dashboard shows the order correctly and status is confirmed

---

## Phase 6 — Shipments back to Amazon

### Task 6.1: Printful webhook handler
- endpoint + signature verification
- event persistence + dedupe
- enqueue shipment update job

**Done when**
- a simulated webhook is accepted and enqueued

### Task 6.2: Shipment update worker
- load mapping: amazonOrderId ↔ printfulOrderId
- call Amazon `updateShipmentStatus` or `confirmShipment`
- mark `AMAZON_SHIPMENT_UPDATED`

**Done when**
- Amazon order shows tracking and “shipped”

---

## Phase 7 — Reliability + operations

### Task 7.1: DLQ + replay tooling
- DLQ queue
- admin endpoint to replay job
- safe “reset state” logic

### Task 7.2: Reconciliation job
- daily reconcile:
  - shipped Printful orders without Amazon shipment update
  - stuck states older than threshold

**Done when**
- pipeline recovers from webhook miss or transient errors without manual database edits

---

## Phase 8 — Production hardening

- PII redaction audit
- alerting on failure states
- load test at expected volume
- expand SKU coverage

