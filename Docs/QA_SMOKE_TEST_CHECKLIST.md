# QA Smoke Test Checklist

Order flow
- [ ] Test Amazon Custom order is detected and stored.
- [ ] Order items and shipping address are fetched (RDT if required).
- [ ] Customization payload is fetched and persisted.
- [ ] Print-ready file is produced and uploaded.
- [ ] Printful order is created and confirmed.
- [ ] Printful shipment webhook is received and verified.
- [ ] Amazon shipment status is updated with tracking.

Safety
- [ ] Logs are redacted for PII.
- [ ] Idempotency prevents duplicate Printful orders.
- [ ] Retry behavior does not violate Amazon rate limits.
