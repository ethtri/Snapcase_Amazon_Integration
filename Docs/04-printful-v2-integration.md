# Printful API v2 integration

## Required Printful setup

### 1) Create a manual order / API store

You should create a “manual order / API store” in Printful:
- Dashboard → Stores → “Connect via API”
- This store is used for API-driven orders and does not automatically publish products publicly.

Reference:
```text
https://help.printful.com/hc/en-us/articles/23581702148764-How-do-I-create-and-use-a-manual-order-API-store
```

### 2) Create a private token

- Create a private token in Printful Developers portal.
- Prefer store-scoped token to reduce risk.
- Store token in secrets manager (never in repo).

### 3) Ensure billing is configured

Printful will charge your Printful wallet / billing method when an order is confirmed.

---

## API v2 base information

- Docs: https://developers.printful.com/docs/v2-beta/
- Base API URL examples show a `/v2` prefix, e.g.:
  - `https://api.printful.com/v2/orders`

---

## Core endpoints you will use (v2)

### A) Files: Add a new file (by URL)

Purpose: register your artwork in Printful’s file library so it can be referenced in order items.

Doc section: **Files v2 → Add a new file**

Key behavior:
- You provide a **URL** for Printful to fetch.
- If an identical URL already exists, Printful returns the existing file object.
- Some tokens require specifying the store via `X-PF-Store-Id`.

Implementation sketch:

```ts
// PSEUDO — consult v2 OpenAPI spec for exact payload shape.
POST https://api.printful.com/v2/files
Headers:
  Authorization: Bearer {PRINTFUL_TOKEN}
  X-PF-Store-Id: {STORE_ID}   // if required
Body:
  {
    "url": "https://{your-presigned-s3-url}",
    "filename": "amazon-{orderId}-{itemId}-back.png"
  }
```

### B) Orders: Create and confirm an order

Doc section: **Orders v2 → post Create a new order**

High-level concept (v2):
- Orders are “built” and can include items and designs.
- You must create the order and then confirm it (depending on flow/status).

Implementation pattern:
1. Create order draft
2. Add item(s) / design(s) referencing file(s)
3. Confirm order for fulfillment

Store in DB:
- Printful order id
- status transitions
- shipment ids

---

## Mapping: Amazon SKU → Printful variant + placements

You must maintain a mapping. Recommended config shape:

```yaml
# config/sku_mapping.yaml
items:
  "SNAPCASE-IP15P-BLACK-MATTE":
    printful:
      catalog_variant_id: 12345
      placements:
        - placement: "default"
          required: true
          print_area_px: { width: 1800, height: 3200 } # example only
    shipping_speed_map:
      STANDARD: "standard"
      EXPEDITED: "express"
```

The rendering module outputs one or more files per placement; Printful order item must reference them correctly.

---

## Webhooks: shipments + order status

Doc section: **Webhook v2**.

You must:
- configure webhook base URL (HTTPS only)
- enable events:
  - shipment sent
  - shipment delivered (optional)
  - order failed / order canceled / hold events (recommended)

Security:
- v2 supports request signing; implement signature verification.
- Reject unsigned webhooks (in prod).

Webhook handler duties:
- verify signature + timestamp
- persist raw webhook event for replay
- enqueue shipment processing job

---

## Shipment → Amazon tracking update

When you receive “shipment sent” webhook:
- fetch the associated Printful order + shipment
- extract:
  - carrier
  - tracking number
  - ship date/time
- call Amazon `updateShipmentStatus` or `confirmShipment`

---

## Failure modes and how to handle them

### Printful rejects file URL
- Possible reasons:
  - URL expired
  - not publicly reachable (needs presigned)
  - blocked by auth
- Mitigation:
  - re-presign URL
  - verify URL with HEAD request from a neutral environment
  - extend expiry

### Printful order goes on hold / fails
- Persist and alert.
- Implement:
  - automatic retry for transient errors
  - manual resolution path for content errors (bad artwork)

### Webhook delivery failures
- Respond 2xx quickly after enqueue; do not block on processing.
- Provide a webhook replay endpoint (admin-only).

---

## Acceptance tests (Printful integration)

- Add file by URL succeeds and returns a file id.
- Create + confirm an order with a phone case item succeeds.
- A shipment webhook can be received and verified.
- Shipment update to Amazon succeeds after webhook.

