# Security and compliance requirements

## Data classification

### Sensitive
- Amazon buyer PII:
  - shipping address
  - buyer name, phone, email (if accessible)
- Amazon Customization payload may contain:
  - names entered by buyer
  - custom text
  - photos uploaded

### Credentials
- Amazon LWA refresh token + client secret
- AWS access keys / role session
- Printful private token
- Webhook signing secret

---

## PII handling rules (hard)

- Do not log raw PII fields.
- Store only what is required to fulfill shipment.
- Encrypt at rest:
  - DB column encryption for shipping address JSON (recommended)
- Limit retention:
  - raw customization payload: short retention window
  - raw downloaded artifacts: optional; prefer short retention

---

## Amazon RDT usage

- Use RDT only for the specific restricted operations you need.
- Cache RDTs only until expiry.
- Do not share RDT across sellers or marketplaces.

---

## Secrets management

- Use AWS Secrets Manager / GCP Secret Manager / Vault.
- Never commit secrets to repo.
- Rotate:
  - Printful token periodically
  - Amazon LWA credentials and refresh token per policy

---

## Webhook security

### Printful
- Verify signature on every webhook.
- Enforce HTTPS-only.
- Reject stale timestamps (replay defense).
- Maintain an allowlist of Printful source IPs only if documented (optional).

### Amazon Notifications (if used)
- Verify SNS signature.
- Validate message topics and subscription ARNs.

---

## Principle of least privilege

AWS IAM policies:
- SP-API request signing keys should not have broad AWS permissions.
- Separate roles:
  - “api-service” (webhooks/admin)
  - “worker-service” (S3 write, DB write)
- S3:
  - write only to relevant prefixes
  - deny public access; use presigned URLs instead

---

## Auditability

Record:
- each external call (Amazon/Printful) with:
  - timestamp
  - operation name
  - status code
  - correlation ids
  - redacted error body
- store in logs + optional audit table

---

## Threat model (minimum)

- Token leak → attacker can read PII or create orders
- Webhook spoofing → attacker can mark Amazon orders shipped
- Replay attacks → duplicate shipments/updates

Mitigations:
- secret manager
- webhook signature verification
- idempotency constraints
- strict logging redaction

