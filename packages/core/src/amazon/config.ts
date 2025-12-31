export type SpApiRegion = "NA" | "EU" | "FE";

type AmazonEnv = {
  AMAZON_LWA_CLIENT_ID?: string;
  AMAZON_LWA_CLIENT_SECRET?: string;
  AMAZON_LWA_REFRESH_TOKEN?: string;
  AMAZON_SELLER_ID?: string;
  AMAZON_MARKETPLACE_ID?: string;
  AMAZON_AWS_ACCESS_KEY_ID?: string;
  AMAZON_AWS_SECRET_ACCESS_KEY?: string;
  AMAZON_AWS_SESSION_TOKEN?: string;
  AMAZON_SPAPI_REGION?: string;
};

export type AmazonLwaConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

export type AmazonAwsConfig = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

export type AmazonSpApiConfig = {
  sellerId: string;
  marketplaceId: string;
  region: SpApiRegion;
  endpoint: string;
  awsRegion: string;
  lwa: AmazonLwaConfig;
  aws: AmazonAwsConfig;
  retry?: {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
  };
  timeoutMs?: number;
};

const SP_API_ENDPOINTS: Record<SpApiRegion, string> = {
  NA: "https://sellingpartnerapi-na.amazon.com",
  EU: "https://sellingpartnerapi-eu.amazon.com",
  FE: "https://sellingpartnerapi-fe.amazon.com",
};

const SP_API_AWS_REGIONS: Record<SpApiRegion, string> = {
  NA: "us-east-1",
  EU: "eu-west-1",
  FE: "us-west-2",
};

const MARKETPLACE_TO_REGION: Record<string, SpApiRegion> = {
  ATVPDKIKX0DER: "NA",
};

export function loadAmazonSpApiConfigFromEnv(env: AmazonEnv = process.env): AmazonSpApiConfig {
  const sellerId = requireEnv(env.AMAZON_SELLER_ID, "AMAZON_SELLER_ID");
  const marketplaceId = requireEnv(env.AMAZON_MARKETPLACE_ID, "AMAZON_MARKETPLACE_ID");

  const region =
    (env.AMAZON_SPAPI_REGION ? parseRegion(env.AMAZON_SPAPI_REGION) : undefined) ??
    MARKETPLACE_TO_REGION[marketplaceId];
  if (!region) {
    throw new Error("Unknown marketplace id. Set AMAZON_SPAPI_REGION to NA, EU, or FE.");
  }

  return {
    sellerId,
    marketplaceId,
    region,
    endpoint: SP_API_ENDPOINTS[region],
    awsRegion: SP_API_AWS_REGIONS[region],
    lwa: {
      clientId: requireEnv(env.AMAZON_LWA_CLIENT_ID, "AMAZON_LWA_CLIENT_ID"),
      clientSecret: requireEnv(env.AMAZON_LWA_CLIENT_SECRET, "AMAZON_LWA_CLIENT_SECRET"),
      refreshToken: requireEnv(env.AMAZON_LWA_REFRESH_TOKEN, "AMAZON_LWA_REFRESH_TOKEN"),
    },
    aws: {
      accessKeyId: requireEnv(env.AMAZON_AWS_ACCESS_KEY_ID, "AMAZON_AWS_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv(env.AMAZON_AWS_SECRET_ACCESS_KEY, "AMAZON_AWS_SECRET_ACCESS_KEY"),
      sessionToken: env.AMAZON_AWS_SESSION_TOKEN,
    },
    retry: {
      maxAttempts: 3,
      baseDelayMs: 300,
      maxDelayMs: 4000,
    },
    timeoutMs: 15000,
  };
}

function requireEnv(value: string | undefined, key: string): string {
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

function parseRegion(value: string): SpApiRegion {
  if (value === "NA" || value === "EU" || value === "FE") {
    return value;
  }
  throw new Error("Invalid AMAZON_SPAPI_REGION. Use NA, EU, or FE.");
}

export function resolveSpApiEndpoint(region: SpApiRegion): string {
  return SP_API_ENDPOINTS[region];
}

export function resolveSpApiAwsRegion(region: SpApiRegion): string {
  return SP_API_AWS_REGIONS[region];
}
