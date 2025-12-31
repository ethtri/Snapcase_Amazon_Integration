# Order state machine (idempotent pipeline)

## State philosophy

- States represent **durable checkpoints** stored in DB.
- Each state transition corresponds to a completed, idempotent step.
- Any worker can retry a failed step safely.

---

## Proposed states (AmazonOrder)

```text
NEW
  ↓
FETCHED_ORDER_DETAILS
  ↓
FETCHED_CUSTOMIZATION
  ↓
RENDERED_ARTWORK
  ↓
PRINTFUL_FILES_CREATED
  ↓
PRINTFUL_ORDER_CREATED
  ↓
PRINTFUL_ORDER_CONFIRMED
  ↓
PRINTFUL_SHIPPED
  ↓
AMAZON_SHIPMENT_UPDATED
  ↓
DONE
```

### Terminal states
- `DONE`
- `CANCELED` (if Amazon order canceled pre-fulfillment)
- `FAILED_PERMANENT` (requires manual intervention)

---

## Transitions & side effects

### NEW → FETCHED_ORDER_DETAILS
- Side effects:
  - Call Amazon `getOrder`, `getOrderItems`, and `getOrderAddress` (RDT if needed)
- Idempotency:
  - Upsert order and items in DB
  - Use orderId as natural key

### FETCHED_ORDER_DETAILS → FETCHED_CUSTOMIZATION
- Side effects:
  - Call `getOrderItemsBuyerInfo`
- Idempotency:
  - Store raw customization fragment per orderItemId (encrypted / short retention)

### FETCHED_CUSTOMIZATION → RENDERED_ARTWORK
- Side effects:
  - Download customization artifact(s)
  - Render print-ready file(s)
  - Upload to S3
- Idempotency:
  - Deterministic S3 keys based on hash

### RENDERED_ARTWORK → PRINTFUL_FILES_CREATED
- Side effects:
  - Call Printful “Add a new file” by URL
- Idempotency:
  - Store Printful file id per (orderItemId, placement)
  - If request repeats, reuse stored id

### PRINTFUL_FILES_CREATED → PRINTFUL_ORDER_CREATED
- Side effects:
  - Create Printful order (draft)
- Idempotency:
  - Use deterministic external id: `AMZN-{amazonOrderId}`
  - Unique DB constraint on amazonOrderId for printfulOrder

### PRINTFUL_ORDER_CREATED → PRINTFUL_ORDER_CONFIRMED
- Side effects:
  - Confirm order for fulfillment
- Idempotency:
  - If already confirmed, treat as success

### PRINTFUL_ORDER_CONFIRMED → PRINTFUL_SHIPPED
- Trigger:
  - Printful webhook “shipment sent”
- Side effects:
  - Store carrier + tracking + shipDate

### PRINTFUL_SHIPPED → AMAZON_SHIPMENT_UPDATED
- Side effects:
  - Call Amazon shipment update endpoint
- Idempotency:
  - If already updated with same tracking, skip

---

## Retry policy

### Transient errors (retry)
- Network timeouts
- 429 rate limit
- 5xx from Amazon/Printful
- Webhook processing failures

Retry strategy:
- exponential backoff with jitter
- max attempts per step (e.g., 10)
- then move to DLQ / manual review

### Permanent errors (manual)
- invalid SKU mapping
- customization artifact missing or not downloadable
- render fails due to unsupported format
- Printful rejects design due to content rules

---

## Reconciliation jobs (recommended)

Daily job:
- list Printful orders created in last N days
- match to Amazon orders by external id
- ensure each shipped Printful order has Amazon shipment update

This catches webhook misses and improves robustness.

