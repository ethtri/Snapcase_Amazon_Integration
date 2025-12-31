# Context, assumptions, and required validations

## What we know (confirmed from official docs)

### Amazon SP-API endpoints you will use

- Buyer customization info for order items:
  - `GET /orders/v0/orders/{orderId}/orderItems/buyerInfo`
  - Reference: `getOrderItemsBuyerInfo`
  - See: https://developer-docs.amazon.com/sp-api/reference/getorderitemsbuyerinfo

- Restricted Data Token (RDT) creation:
  - `POST /tokens/2021-03-01/restrictedDataToken`
  - Reference: `createRestrictedDataToken`
  - See: https://developer-docs.amazon.com/sp-api/reference/createrestricteddatatoken

- Shipment updates:
  - `POST /orders/v0/orders/{orderId}/shipment` (`updateShipmentStatus`)
  - `POST /orders/v0/orders/{orderId}/shipmentConfirmation` (`confirmShipment`)
  - See:
    - https://developer-docs.amazon.com/sp-api/reference/updateshipmentstatus
    - https://developer-docs.amazon.com/sp-api/reference/confirmshipment

### Printful API v2 (beta) key properties

- Base URL uses a `/v2` prefix (examples in docs):
  - `https://api.printful.com/v2/...`
  - Docs: https://developers.printful.com/docs/v2-beta/

- File library endpoint exists in v2:
  - “Add a new file” takes a **URL** and creates or reuses a file entry in the library.
  - It supports an `X-PF-Store-Id` header when using account-level tokens.
  - Docs section: “Files v2 → Add a new file”

- Webhooks in v2 include:
  - HTTPS enforcement
  - request signing
  - more event types
  - Docs: https://developers.printful.com/docs/v2-beta/

- You should use a **manual order / API store** in Printful for custom integrations:
  - Docs: https://help.printful.com/hc/en-us/articles/23581702148764-How-do-I-create-and-use-a-manual-order-API-store

---

## What is NOT fully known (must validate with live data)

These items depend on Seller Central configuration and the exact Amazon Custom template output.

### 1) Amazon Custom “customization payload” format

SP-API’s `getOrderItemsBuyerInfo` exposes buyer/item-level info and includes a “buyerCustomizedInfo” structure.

**Critical unknowns:**
- Does Amazon provide:
  - a “production-ready” print file (ideal) OR
  - a structured payload + asset URLs requiring you to render (common) OR
  - both (preview + production files)?

**Action:** capture 3–5 real orders (or create test orders) and inspect:
- The response payload for `getOrderItemsBuyerInfo`
- The URL(s) included (often called `CustomizedUrl` / similar)
- The downloaded artifact type (zip? json? image? PDF?)

### 2) Which operations require an RDT and which dataElements are needed

Amazon’s RDT request includes:
- restricted resource `method`
- restricted resource `path`
- `dataElements` list (PII categories)

**Action:** implement RDT creation generically and store a config map:
- operation path → required dataElements
- fallback: attempt without RDT; if you get restricted error, retry with RDT.

### 3) Printful phone-case print specs & placement definitions

For correct output you must match:
- Printful catalog variant (phone model + material)
- placement(s) required by that product (e.g., “default”, “back”, etc.)
- image size / DPI / bleed requirements

**Action:** for each Printful phone-case type you will sell on Amazon:
- record the Printful catalog variant id
- record placement name(s)
- record required print area dimensions (template)

---

## System-level assumptions (build around these)

1. You will fulfill as **merchant-fulfilled** on Amazon (not FBA).
2. Each Amazon order maps 1:1 to a Printful order (simplify first).
3. You will store print files in an object store you control (e.g., S3) and give Printful a presigned URL.
4. You will implement a pipeline/state machine with retries and idempotency.

---

## Validations checklist (do these before “full build”)

### Amazon
- [ ] Confirm you can list phone cases as Amazon Custom products.
- [ ] Confirm `getOrders` returns your custom orders.
- [ ] Confirm `getOrderItemsBuyerInfo` returns customization details for a custom order.
- [ ] Confirm you can download customization artifact from the returned URL(s).
- [ ] Confirm `updateShipmentStatus` or `confirmShipment` works for your account/marketplace.

### Printful
- [ ] Create a manual order/API store.
- [ ] Confirm you can add a file via v2 “Add a new file” by URL.
- [ ] Confirm you can create and confirm a v2 order containing a phone case item using that file.
- [ ] Confirm shipment webhooks are delivered to your webhook endpoint.

### Rendering
- [ ] Generate a print file that matches Printful phone-case requirements.
- [ ] Place a sample order and confirm the delivered physical output is correct.

