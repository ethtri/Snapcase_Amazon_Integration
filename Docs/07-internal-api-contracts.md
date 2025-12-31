# Internal API contracts (webhooks + admin endpoints)

## General rules

- All endpoints must be idempotent.
- Webhook endpoints must:
  - verify signature
  - store event
  - enqueue job
  - return 2xx quickly

---

## Webhook: Printful

### Endpoint
`POST /webhooks/printful`

### Headers (expected)
- signature headers per Printful v2 webhook signing
- content-type: application/json

### Handler behavior
1. Verify signature + timestamp (reject if invalid).
2. Parse event type.
3. Persist event in `webhook_events` table with unique `(source,event_id)` constraint.
4. Enqueue worker job:
   - shipment events → `shipment_processing`
   - order fail/hold events → `order_attention`

### Event routing (minimum)
- Shipment sent → update Amazon shipment/tracking
- Shipment delivered → optional metrics update
- Shipment returned/canceled → optional alerting

---

## Webhook: Amazon (optional, if using Notifications API)

If you use SP-API Notifications, you may receive events via SNS to an HTTPS endpoint.

### Endpoint
`POST /webhooks/amazon`

### Handler behavior
- Verify SNS signature (AWS)
- Extract Amazon order id + event type
- Enqueue order ingestion for that order id

MVP can skip this and use polling.

---

## Admin endpoints (optional but useful)

### Health
- `GET /healthz`
  - returns 200 if service is alive

### Read order
- `GET /admin/orders/{marketplaceId}/{amazonOrderId}`
  - returns current state, mapping, last errors

### Retry order
- `POST /admin/orders/{marketplaceId}/{amazonOrderId}/retry`
  - parameters:
    - `from_state` (optional)
  - behavior:
    - resets state back to requested checkpoint
    - enqueues job

### Replay webhook
- `POST /admin/webhooks/{id}/replay`
  - re-enqueues processing without altering raw payload

---

## Internal queue job contracts

### order_processing job

```jsonc
{
  "marketplaceId": "ATVPDKIKX0DER",
  "amazonOrderId": "123-1234567-1234567",
  "force": false
}
```

### shipment_processing job

```jsonc
{
  "marketplaceId": "ATVPDKIKX0DER",
  "amazonOrderId": "123-1234567-1234567",
  "printfulOrderId": "PF123456789"
}
```

---

## Error contract (standardize)

All internal modules should throw an error object like:

```ts
type AppError = {
  code: string;             // e.g. AMAZON_RATE_LIMIT, PRINTFUL_BAD_REQUEST
  message: string;
  isRetryable: boolean;
  details?: any;            // never include PII
};
```

Persist:
- `code`
- `message`
- `stack` (optional; sanitize)
- `details` (safe subset)

