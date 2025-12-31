# Printful Notes

Credentials
- API token: TBD (store in secrets manager).
- Store ID: TBD (Printful API store).

Key endpoints (v2 beta)
- File library: add file by URL.
- Orders: create and confirm order.
- Webhooks: shipment events.

Operational notes
- Keep file uploads idempotent by URL hash.
- Map SKUs to Printful variant IDs in config.
- Use short-lived URLs for artwork storage.
