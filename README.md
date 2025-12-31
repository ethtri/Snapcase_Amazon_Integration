# Snapcase Amazon Custom → Printful Fulfillment Bridge

## Objective

Build a **fully automated** pipeline where:

1. A buyer customizes a phone case using **Amazon Custom** on an Amazon listing.
2. Amazon creates an order (MFN / merchant-fulfilled).
3. Your integration:
   - detects the new order
   - fetches the **customization payload** for each order item
   - produces a **print‑ready file** for the matching Printful phone case variant
   - creates a Printful order via API
4. When Printful ships, your integration:
   - captures carrier + tracking
   - updates Amazon with shipment/tracking (so the Amazon order is marked shipped)

This repo is **spec-only**: it is a set of `.md` files intended for AI coding agents to implement the system.

---

## Non-goals / constraints (hard)

- No off-Amazon “customize on Snapcase.ai then come back to Amazon” redirect flow.
- No manual fulfillment steps (except an optional admin retry/review UI).
- Do not persist or log unnecessary PII. Use Amazon Restricted Data Token (RDT) when required.
- Assume **multiple marketplaces** may be used later (NA/EU/FE); design for it.

---

## Architecture at a glance

```text
Amazon (Buyer) → Amazon Custom listing → Amazon Order (MFN)
                                       |
                                       v
                             SP-API Orders (poll or notifications)
                                       |
                                       v
                           Integration Orchestrator (your service)
                           - fetch order + customization
                           - render artwork
                           - store artwork (S3) + create Printful File
                           - create Printful Order
                                       |
                                       v
                           Printful Production + Shipping
                                       |
                                       v
                              Printful Webhooks (shipment)
                                       |
                                       v
                           Integration → Amazon shipment update
```

---

## Minimal milestone definition (MVP)

MVP is complete when the system can process **one** Amazon Custom order end-to-end:

- detect new order
- fetch customization for order item(s)
- generate a print-ready PNG for Printful phone case
- create Printful order
- receive Printful shipment webhook
- push tracking back to Amazon

---

## What you must decide early (agent TODO)

1. **Order ingestion strategy**
   - Polling `getOrders` on a schedule (simple, reliable)
   - SP-API Notifications API (more real-time, more setup)

2. **How to turn Amazon Customization → Printful print file**
   - Best case: Amazon provides a downloadable **production file** that is already print-ready.
   - Worst case: Amazon provides a structured customization payload and you must render using your own compositor.

3. **Printful API version**
   - Use Printful **API v2 (beta)** unless you have a strong reason to stay on v1.
   - v2 adds a file library endpoint and modern webhook security.

---

## File index

- `Docs/00-context-and-assumptions.md` — what is known vs unknown; required validations
- `Docs/01-system-architecture.md` — components, queues, state machine, observability
- `Docs/02-amazon-custom-and-sp-api.md` — SP-API auth, endpoints, RDT, order ingestion
- `Docs/03-customization-extraction-and-rendering.md` — how to fetch + turn customization into artwork
- `Docs/04-printful-v2-integration.md` — file upload, order creation, webhooks, status mapping
- `Docs/05-order-state-machine.md` — statuses, retries, idempotency rules
- `Docs/06-data-model.md` — DB schema + constraints
- `Docs/07-internal-api-contracts.md` — internal REST endpoints + webhook handlers
- `Docs/08-deployment.md` — deploy options + infra checklist
- `Docs/09-testing-and-qa.md` — test plan + fixtures + sandbox strategy
- `Docs/10-security-and-compliance.md` — PII, secrets, auditability
- `Docs/11-agent-execution-plan.md` — step-by-step build plan (agent-friendly)

---

## Canonical external documentation (for the implementing agent)

Put these into your agent’s context and treat them as the “source of truth”.

```text
Amazon SP-API (Developer Docs)
- https://developer-docs.amazon.com/sp-api/

SP-API endpoints used (reference pages)
- getOrderItemsBuyerInfo: https://developer-docs.amazon.com/sp-api/reference/getorderitemsbuyerinfo
- createRestrictedDataToken: https://developer-docs.amazon.com/sp-api/reference/createrestricteddatatoken
- updateShipmentStatus: https://developer-docs.amazon.com/sp-api/reference/updateshipmentstatus
- confirmShipment: https://developer-docs.amazon.com/sp-api/reference/confirmshipment

Printful API v2 (beta) docs
- https://developers.printful.com/docs/v2-beta/

Printful "manual order / API store"
- https://help.printful.com/hc/en-us/articles/23581702148764-How-do-I-create-and-use-a-manual-order-API-store
```

---

## Implementation deliverable (what “done” means)

The final implementation (built by the agent) must include:

- A worker that ingests orders, fetches customization, and creates Printful orders
- A webhook handler for Printful shipment events that updates Amazon
- Persistent storage for order state + idempotency keys
- A retry + DLQ strategy for transient failures
- Redacted logging + metrics dashboards

