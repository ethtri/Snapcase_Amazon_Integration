# Data model (database schema)

## Storage requirements

You need to persist:

- Amazon order headers + items
- Customization pointer(s) and/or raw fragments (short retention)
- Rendered artwork metadata + S3 keys
- Printful file ids created from those artworks
- Printful order + shipment ids, carrier + tracking
- Webhook event logs for replay + debugging
- Idempotency keys / unique constraints

---

## Suggested Postgres schema (MVP)

> This is a starting point. The implementing agent can adapt to DynamoDB, but must preserve uniqueness semantics.

### amazon_orders

```sql
create table amazon_orders (
  id bigserial primary key,
  amazon_order_id text not null,
  marketplace_id text not null,
  region text not null,
  purchase_date timestamptz,
  order_status text,
  fulfillment_channel text,
  last_update_date timestamptz,

  state text not null default 'NEW',
  state_updated_at timestamptz not null default now(),

  shipping_address_json jsonb, -- encrypted at rest or stored minimally
  buyer_email text,           -- avoid if not required

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (amazon_order_id, marketplace_id)
);
```

### amazon_order_items

```sql
create table amazon_order_items (
  id bigserial primary key,
  amazon_order_id text not null,
  marketplace_id text not null,

  order_item_id text not null,
  seller_sku text not null,
  asin text,
  quantity integer not null,

  customization_json jsonb, -- short retention, may contain PII
  customization_url text,

  state text not null default 'NEW',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (marketplace_id, order_item_id)
);
```

### rendered_files

```sql
create table rendered_files (
  id bigserial primary key,
  marketplace_id text not null,
  order_item_id text not null,

  placement text not null,
  s3_bucket text not null,
  s3_key text not null,
  sha256 text not null,
  width_px integer not null,
  height_px integer not null,

  created_at timestamptz not null default now(),

  unique (marketplace_id, order_item_id, placement, sha256)
);
```

### printful_files

```sql
create table printful_files (
  id bigserial primary key,
  marketplace_id text not null,
  order_item_id text not null,
  placement text not null,

  printful_file_id text not null,
  source_url text not null, -- presigned URL used at creation time

  created_at timestamptz not null default now(),

  unique (marketplace_id, order_item_id, placement)
);
```

### printful_orders

```sql
create table printful_orders (
  id bigserial primary key,
  marketplace_id text not null,
  amazon_order_id text not null,

  printful_order_id text not null,
  external_id text not null,

  status text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (marketplace_id, amazon_order_id),
  unique (printful_order_id)
);
```

### printful_shipments

```sql
create table printful_shipments (
  id bigserial primary key,
  marketplace_id text not null,
  amazon_order_id text not null,
  printful_order_id text not null,

  shipment_id text,
  carrier text,
  tracking_number text,
  shipped_at timestamptz,

  created_at timestamptz not null default now(),

  unique (marketplace_id, amazon_order_id)
);
```

### webhook_events

```sql
create table webhook_events (
  id bigserial primary key,
  source text not null,          -- 'printful'
  event_type text not null,      -- shipment_sent, etc.
  event_id text,                 -- if provided by source
  payload jsonb not null,
  received_at timestamptz not null default now(),

  processed_at timestamptz,
  processing_error text,

  unique (source, event_id)
);
```

---

## Retention / GDPR-ish concerns

- `customization_json` should have:
  - minimal retention window (e.g., 7–30 days)
  - or store only non-PII subset
- raw webhook payloads might also need retention policy.

---

## Mapping store: sku_mapping (can be config-file-driven)

You can keep mapping in:
- YAML file committed to repo (simple) OR
- DB table with an admin UI

DB table shape:

```sql
create table sku_mappings (
  id bigserial primary key,
  marketplace_id text not null,
  seller_sku text not null,

  printful_catalog_variant_id integer not null,
  placements jsonb not null, -- list with placement names and print-area dims

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (marketplace_id, seller_sku)
);
```

