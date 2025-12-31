# Customization extraction and rendering

## Goal

Given an Amazon order item, produce a **Printful-ready print file** (PNG/PDF) for the correct phone case variant.

This module must handle variability in Amazon Custom output.

---

## Inputs / outputs

### Inputs
- `AmazonOrderDTO` (see `02-amazon-custom-and-sp-api.md`)
- Printful product mapping entry for the item SKU (variant id + print area spec)

### Outputs
- One or more print files per order item:
  - stored in your object storage (S3 recommended)
  - accessible via HTTPS URL (presigned URL OK)
- A `RenderResult` describing:
  - file URLs
  - dimensions
  - placement names
  - checksum

---

## Core design: adapter interface

Implement a `CustomizationSource` interface and keep it swappable:

```ts
interface CustomizationSource {
  kind: "AMAZON_CUSTOM" | "UNKNOWN";
  fetchCustomizationArtifact(input: {
    amazonOrderId: string;
    orderItemId: string;
    buyerInfoPayload: unknown; // raw fragment from getOrderItemsBuyerInfo
  }): Promise<CustomizationArtifact>;
}

type CustomizationArtifact =
  | { type: "ZIP"; bytes: Buffer; filename: string }
  | { type: "JSON"; json: any; filename: string }
  | { type: "IMAGE"; bytes: Buffer; mime: string; filename: string }
  | { type: "PDF"; bytes: Buffer; filename: string }
  | { type: "URL"; url: string }; // last-resort passthrough
```

Then implement a `Renderer` interface:

```ts
interface Renderer {
  render(input: {
    artifact: CustomizationArtifact;
    mapping: PrintfulMapping;
  }): Promise<RenderResult>;
}
```

This lets you swap Amazon Custom parsing logic without touching Printful or Amazon shipment modules.

---

## Step 1: Extract customization details from buyerInfo

**Source:** SP-API `getOrderItemsBuyerInfo` response.

Implementation pattern:
1. Identify the order item entry.
2. Locate customization fields (names vary by API model; store full raw object).
3. Extract the most useful pointers:
   - `customizedUrl` / `CustomizedUrl` (common)
   - `customizationId` / similar

Store:
- `rawCustomizationFragment` (JSON) in DB for debug (with short retention; avoid PII).

---

## Step 2: Download the customization artifact

### Preferred approach
- Download the artifact yourself (server-side), then store in S3.
- Reason: you will likely need to:
  - unzip
  - validate size
  - rasterize
  - composite
  - convert color profile
  - ensure correct DPI

### Heuristic downloader

```ts
async function fetchArtifactFromUrl(url: string): Promise<CustomizationArtifact> {
  // HEAD first: determine content-type and length; apply max-size guardrails.
  // GET bytes.
  // Decide type:
  // - application/zip → ZIP
  // - application/json → JSON
  // - image/* → IMAGE
  // - application/pdf → PDF
  // else → bytes + unknown; treat as ZIP first, then JSON sniff, else fail
}
```

**Guardrails**
- max download size (e.g., 200MB)
- timeout
- retries
- checksum

---

## Step 3: Convert artifact into a print-ready file

This is the hardest part and is template-specific.

### Strategy A (ideal): artifact is already print-ready
If the artifact is an image/PDF that matches Printful’s required print area:
- validate dimensions and aspect ratio
- if acceptable, pass through (maybe convert to PNG)

### Strategy B (common): artifact contains layers and you must render
If artifact is JSON + assets:
- parse JSON to find text fields, fonts, placements, and image layers
- download referenced images
- composite layers into a single canvas sized exactly to Printful print area

### Strategy C (fallback): you cannot render reliably
- store artifact
- push order into a “manual review” state
- provide an internal admin UI/tooling to render manually

---

## Print-ready requirements (generic)

Even without exact Printful phone-case template data, enforce:

- Resolution:
  - target 300 DPI equivalent (or Printful template guidance)
- Color space:
  - sRGB unless Printful requires otherwise
- Background:
  - transparent PNG if supported; otherwise solid background per product spec
- Bleed:
  - include bleed area if Printful template includes it

**Important:** Printful phone cases often require full-bleed artwork sized to the template. You must store per-variant print area dimensions in your mapping config.

---

## File storage pattern (S3 recommended)

### Object keys
Use deterministic keys so render is idempotent:

```text
s3://{bucket}/amazon/{marketplaceId}/{amazonOrderId}/{orderItemId}/{placement}/{sha256}.png
```

### Presigned URLs
- Generate presigned GET URLs for Printful file ingestion.
- Keep expiry at least:
  - long enough for Printful to fetch (e.g., 24h)
- Store the S3 object permanently (or for retention window) even if URL expires.

---

## RenderResult contract

```ts
type RenderResult = {
  placementFiles: Array<{
    placement: string; // e.g., "default" / "back"
    url: string;       // presigned URL
    filename: string;  // e.g., "{orderId}-{itemId}-back.png"
    sha256: string;
    widthPx: number;
    heightPx: number;
  }>;
  debug?: {
    artifactStoredUrl?: string; // internal only
  };
};
```

---

## Validation pipeline

Before creating a Printful order:

1. Ensure every required placement has a file.
2. Ensure files meet min dimensions.
3. Ensure file URL is reachable (Printful will fetch it).
4. Optionally generate a mockup for sanity-check (nice to have, not required).

---

## Acceptance tests (for this module)

- Given a real Amazon Custom order item, the module produces a PNG that:
  - matches Printful template aspect ratio for the mapped variant
  - passes a basic “image open” validation
  - is reproducible/idempotent (re-run yields same sha256)

