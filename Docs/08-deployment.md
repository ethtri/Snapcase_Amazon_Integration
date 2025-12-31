# Deployment and infrastructure

## Deployment targets (choose one)

### Option A: AWS serverless (recommended for low ops)
- API Gateway + Lambda (webhooks/admin)
- SQS (order/shipment queues)
- Lambda workers (order processor, shipment processor)
- DynamoDB or Aurora Serverless (state storage)
- S3 (artwork storage)
- Secrets Manager (tokens)

Pros: scales automatically, low ops  
Cons: local dev complexity, cold starts for rendering

### Option B: Containerized (fastest to iterate)
- One service (API + workers) on:
  - ECS Fargate or Kubernetes
- Postgres (RDS)
- Redis (optional)
- S3
- Secrets Manager

Pros: simpler runtime, easier image processing  
Cons: more ops

---

## Required environment variables

### Amazon SP-API
- `AMZN_LWA_CLIENT_ID`
- `AMZN_LWA_CLIENT_SECRET`
- `AMZN_LWA_REFRESH_TOKEN`
- `AMZN_AWS_ACCESS_KEY_ID`
- `AMZN_AWS_SECRET_ACCESS_KEY`
- `AMZN_AWS_SESSION_TOKEN` (optional)
- `AMZN_ROLE_ARN` (if assuming role)
- `AMZN_REGION` (AWS region for SigV4 signing; usually `us-east-1` for SP-API)

### Printful
- `PRINTFUL_TOKEN`
- `PRINTFUL_STORE_ID` (if token is account-level / multi-store)

### Storage
- `S3_BUCKET_ARTWORK`
- `S3_PRESIGN_EXPIRY_SECONDS` (e.g., 86400)

### Database
- `DATABASE_URL`

### Webhooks
- `PRINTFUL_WEBHOOK_SECRET` (or key material for signature verification)
- `WEBHOOK_BASE_URL` (public HTTPS)

---

## Infrastructure checklist

- [ ] S3 bucket created with:
  - server-side encryption enabled
  - lifecycle policy for debug artifacts
- [ ] IAM policy allows:
  - read/write to bucket
  - generate presigned URLs
- [ ] Secrets Manager stores all tokens/secrets
- [ ] Webhook endpoint has:
  - TLS certificate
  - WAF/rate limiting (recommended)
- [ ] Queue + DLQ configured

---

## Local development notes

- Use ngrok / cloudflared for Printful webhook testing.
- Use a dedicated “dev” Printful store and token.
- For Amazon, SP-API sandbox can help for auth plumbing, but Amazon Custom payload validation requires real or test orders.

---

## Rollout strategy

1. Enable pipeline for a single Amazon listing / SKU only.
2. Place internal test orders; verify output.
3. Expand to more phone models.
4. Enable automated shipment updates only after Printful shipping is stable.
5. Add monitoring + alerts before scaling.

