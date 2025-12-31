# Testing and QA plan

## Test levels

### 1) Unit tests
- SP-API signature generation (if your code wraps a library)
- RDT request builder
- Customization extraction (from stored sample payloads)
- Rendering:
  - layer compositor
  - size validation
  - deterministic output hashing
- Mapping resolver:
  - sellerSku → Printful variant
  - required placements

### 2) Integration tests (mock external APIs)
- Stub Amazon SP-API responses (getOrder, getOrderItems, buyerInfo)
- Stub Printful API:
  - add file
  - create order
  - confirm order
  - shipment webhook payload

Use a local fake server + recorded fixtures.

### 3) End-to-end tests (real external systems)
- One real Amazon Custom order (test buyer)
- One real Printful order
- Validate:
  - artwork produced matches template
  - Printful accepts file + order
  - shipment webhook arrives
  - Amazon shipment updated successfully

---

## Golden fixtures (required)

Maintain a fixture folder (not in these docs) containing:
- `amazon_buyerinfo_sample_1.json`
- `amazon_buyerinfo_sample_2.json`
- `customization_artifact_sample_1.zip`
- `customization_artifact_sample_1_extracted/...`
- `render_expected_hashes.json`
- `printful_shipment_webhook_sample.json`

All fixtures must be scrubbed of PII.

---

## Manual QA checklist (every release)

Amazon → Printful creation:
- [ ] New order detected
- [ ] Customization retrieved and downloaded
- [ ] Artwork stored and viewable
- [ ] Printful file created from URL
- [ ] Printful order created and confirmed
- [ ] Printful order appears in dashboard correctly

Shipment → Amazon:
- [ ] Shipment webhook received
- [ ] Carrier + tracking extracted
- [ ] Amazon shipment update success
- [ ] Amazon order shows “Shipped” with tracking

Regression:
- [ ] Retry behavior does not create duplicates
- [ ] DLQ items can be replayed safely
- [ ] Logs contain no PII (spot check)

---

## Load / performance testing (later)

Simulate N orders arriving at once:
- verify:
  - queue depth remains bounded
  - rate limit backoff works
  - no double-fulfillment occurs

