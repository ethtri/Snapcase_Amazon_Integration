# Amazon Custom + SP-API integration spec

## Core idea

Use **SP-API Orders API** to detect orders and retrieve buyer customization information, then use **Tokens API** to get a Restricted Data Token (RDT) for restricted operations when necessary.

> The customization data retrieval is via:
> `GET /orders/v0/orders/{orderId}/orderItems/buyerInfo`  
> Reference: https://developer-docs.amazon.com/sp-api/reference/getorderitemsbuyerinfo

---

## SP-API prerequisites (agent checklist)

### Seller / marketplace
- [ ] Amazon Seller account is **Professional** and enrolled in Amazon Custom.
- [ ] Listings are configured as **merchant fulfilled** (Printful will fulfill; you are the merchant-of-record).
- [ ] You know your target marketplace ids (e.g., US = `ATVPDKIKX0DER`, etc).

### Developer registration
- [ ] Register as SP-API developer.
- [ ] Create an SP-API application (LWA client id/secret).
- [ ] Configure IAM user/role for AWS SigV4 credentials used for SP-API requests.

### Roles & permissions
- [ ] Ensure the app has the correct SP-API roles for:
  - Orders API
  - Tokens API
  - Notifications API (optional)

---

## Authentication (mechanics)

### You must implement BOTH

1. **LWA access token**
   - Obtain using refresh token flow.
   - Result is used as `x-amz-access-token` header.

2. **AWS SigV4 signing**
   - Sign the HTTP request with AWS access key/secret (and session token if used).
   - The signed request includes:
     - `Authorization` header (SigV4)
     - `x-amz-date`
     - `host`
     - `x-amz-security-token` (if temporary creds)

**Implementation note:** use a battle-tested SigV4 signer; do not hand-roll unless forced.

---

## Region endpoints

SP-API endpoints are regional. Maintain a mapping:

```jsonc
{
  "NA": "https://sellingpartnerapi-na.amazon.com",
  "EU": "https://sellingpartnerapi-eu.amazon.com",
  "FE": "https://sellingpartnerapi-fe.amazon.com"
}
```

Use marketplace id → region routing to select base URL.

---

## Order ingestion strategy

### MVP: polling

Use `getOrders` with a moving checkpoint:

- poll every 1–5 minutes
- query createdAfter/lastUpdatedAfter
- fetch only `Unshipped` / `Pending` states you can fulfill

**Stateful checkpoint design**
- store per marketplace:
  - `last_polled_at` (UTC)
  - `last_successful_checkpoint` (UTC)
- when processing, do *not* rely only on checkpoint: always store order ids and be idempotent.

### Upgrade: Notifications

If you later use Notifications API:
- subscribe to order change notifications
- push into the same queue

---

## Order processing: required SP-API calls

### 1) Get order headers

- `getOrder` (order-level summary)
- `getOrderItems` (line items / ASIN / SellerSKU)

### 2) Get buyer customization info (critical)

- `getOrderItemsBuyerInfo`
  - path:
    - `/orders/v0/orders/{orderId}/orderItems/buyerInfo`
  - returns buyer info for each order item, including customization details for Amazon Custom orders.

### 3) Get shipping address (PII)

- `getOrderAddress` likely requires RDT in many cases because it returns PII.
- Use RDT flow below.

---

## Restricted Data Token (RDT) flow

### When to use

If an operation returns PII, it may require a restricted token. You create an RDT via:

`POST /tokens/2021-03-01/restrictedDataToken`  
Reference: https://developer-docs.amazon.com/sp-api/reference/createrestricteddatatoken

Then you call the restricted operation using the RDT as the access token (i.e., `x-amz-access-token = RDT` for that request).

### Generic RDT request builder

Build the request dynamically from an “operation registry” in your code:

```jsonc
{
  "restrictedResources": [
    {
      "method": "GET",
      "path": "/orders/v0/orders/{orderId}/address",
      "dataElements": ["shippingAddress"]
    },
    {
      "method": "GET",
      "path": "/orders/v0/orders/{orderId}/orderItems/buyerInfo",
      "dataElements": ["buyerCustomizedInfo"]
    }
  ]
}
```

**Notes**
- `dataElements` values are governed by Amazon’s “Tokens API Use Case Guide”.
- Implement fallback:
  - attempt call with standard LWA access token
  - if restricted error, obtain RDT and retry

### RDT caching

Cache RDTs short-term keyed by:
- seller
- marketplace
- operation path
- orderId (if path contains it)
- dataElements set

Store `expiresAt` and refresh if near expiry.

---

## Customization retrieval and download

Your code should treat customization retrieval as a multi-step process:

1. Call `getOrderItemsBuyerInfo`.
2. For each item, locate customization details (e.g., a URL, an id).
3. Download the customization artifact.
4. Convert it into a Printful-ready file.

**Important:** the format of the artifact depends on Amazon Custom configuration; keep this layer pluggable. See `03-customization-extraction-and-rendering.md`.

---

## Shipment updates to Amazon

You have two SP-API options in Orders v0:

1) `updateShipmentStatus`
- `POST /orders/v0/orders/{orderId}/shipment`
- Reference: https://developer-docs.amazon.com/sp-api/reference/updateshipmentstatus

2) `confirmShipment`
- `POST /orders/v0/orders/{orderId}/shipmentConfirmation`
- Reference: https://developer-docs.amazon.com/sp-api/reference/confirmshipment

### Strategy

- Implement both as adapters, choose per marketplace/account behavior:
  - Try `updateShipmentStatus` first.
  - If you get an “operation not allowed” for the order type, try `confirmShipment`.
  - If both fail, fall back to Feeds API fulfillment feed (out of scope for MVP, but document it).

### Required input (from Printful)

From Printful shipment webhook you will typically get:
- carrier name or code
- tracking number
- ship date/time
- items shipped (optional)

Map this into Amazon’s shipment update payload.

---

## Important operational constraints

- Rate limits are strict on SP-API. Implement:
  - global rate limiter per operation
  - automatic backoff on 429
  - jitter
- The `getOrderItemsBuyerInfo` default rate is low. Batch and cache.

---

## “Contract” for downstream modules

Define internal DTOs that the rest of your pipeline uses, so you can swap ingestion later:

```ts
type AmazonOrderDTO = {
  amazonOrderId: string;
  marketplaceId: string;
  purchaseDateIso: string;
  shippingAddress?: ShippingAddress; // present after PII stage
  items: AmazonOrderItemDTO[];
};

type AmazonOrderItemDTO = {
  orderItemId: string;
  sellerSku: string;
  asin?: string;
  quantity: number;
  customization?: AmazonCustomizationDTO; // extracted
};

type AmazonCustomizationDTO = {
  raw: unknown;               // full buyerInfo customization fragment (stored for debug)
  customizedUrl?: string;     // if present
  customizationId?: string;   // if present
  kind: "AMAZON_CUSTOM" | "UNKNOWN";
};
```

