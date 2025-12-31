# Backlog

P0 (MVP critical)
- [x] P0.1 Choose implementation stack and baseline tooling.
- [ ] P0.2 Create repo skeleton (apps/api, apps/worker, packages/core) and CI.
- [x] P0.3 Implement SP-API auth, SigV4 signing, and retry/backoff.
- [ ] P0.4 Implement Restricted Data Token (RDT) flow.
- [ ] P0.5 Order ingestion poller (getOrders) with checkpointing.
- [ ] P0.6 Order details worker (items, address, normalization).
- [ ] P0.7 Fetch customization via getOrderItemsBuyerInfo.
- [ ] P0.8 Download customization artifact and store securely.
- [ ] P0.9 SKU to Printful variant mapping and renderer v1.
- [ ] P0.10 Printful client, file creation, order create/confirm.
- [ ] P0.11 Printful webhook handler and Amazon shipment update.
- [ ] P0.12 Idempotency, state machine transitions, and retries.
- [ ] P0.13 QA smoke tests pass for a full end-to-end order.

P1
- [ ] Notifications API ingestion.
- [ ] Multi-marketplace support (EU/FE).
- [ ] Rendering strategy B (JSON and asset compositor).
- [ ] Reconciliation job and DLQ replay tooling.

P2
- [ ] Admin UI and dashboards.
- [ ] Load testing and performance tuning.
