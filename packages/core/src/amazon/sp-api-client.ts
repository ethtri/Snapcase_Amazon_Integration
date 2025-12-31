import { HttpRequest } from "@aws-sdk/protocol-http";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { Sha256 } from "@aws-sdk/hash-node";
import type { AwsCredentialIdentity } from "@aws-sdk/types";
import type { AmazonSpApiConfig } from "./config.js";
import { createLwaTokenProvider } from "./lwa.js";
import { SpApiError } from "./sp-api-error.js";

type RetryConfig = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

export type SpApiRequest = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  accessToken?: string;
};

export type SpApiResponse<T> = {
  status: number;
  headers: Record<string, string>;
  data: T;
  raw: string;
};

export type SpApiClient = {
  request: <T = unknown>(options: SpApiRequest) => Promise<SpApiResponse<T>>;
};

type SpApiClientOptions = {
  fetcher?: typeof fetch;
  retry?: Partial<RetryConfig>;
  timeoutMs?: number;
};

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export function createSpApiClient(config: AmazonSpApiConfig, options: SpApiClientOptions = {}): SpApiClient {
  const fetcher = options.fetcher ?? fetch;
  const retry = buildRetryConfig(config.retry, options.retry);
  const timeoutMs = options.timeoutMs ?? config.timeoutMs ?? 15000;

  const signer = new SignatureV4({
    credentials: config.aws as AwsCredentialIdentity,
    service: "execute-api",
    region: config.awsRegion,
    sha256: Sha256,
  });

  const lwaProvider = createLwaTokenProvider(config.lwa, { fetcher });

  async function request<T>(options: SpApiRequest): Promise<SpApiResponse<T>> {
    const accessToken = options.accessToken ?? (await lwaProvider.getAccessToken());

    const url = buildUrl(config.endpoint, options.path, options.query);
    const body = options.body === undefined ? undefined : JSON.stringify(options.body);

    const headers: Record<string, string> = {
      host: url.hostname,
      "x-amz-access-token": accessToken,
      ...options.headers,
    };

    if (body) {
      headers["content-type"] = headers["content-type"] ?? "application/json";
    }

    return requestWithRetry<T>({
      fetcher,
      signer,
      url,
      method: options.method,
      headers,
      body,
      timeoutMs,
      retry,
    });
  }

  return { request };
}

type RequestWithRetryInput = {
  fetcher: typeof fetch;
  signer: SignatureV4;
  url: URL;
  method: SpApiRequest["method"];
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
  retry: RetryConfig;
};

async function requestWithRetry<T>(input: RequestWithRetryInput): Promise<SpApiResponse<T>> {
  for (let attempt = 1; attempt <= input.retry.maxAttempts; attempt += 1) {
    try {
      return await signedFetch(input);
    } catch (error) {
      const resolvedError = error instanceof Error ? error : new Error("Unknown SP-API error");
      if (resolvedError instanceof SpApiError && !RETRYABLE_STATUS.has(resolvedError.status)) {
        throw resolvedError;
      }
      if (attempt >= input.retry.maxAttempts) {
        throw resolvedError;
      }
      const responseDelay = getRetryDelayMs(attempt, input.retry);
      await sleep(responseDelay);
    }
  }

  throw new Error("SP-API request failed after retries.");
}

async function signedFetch<T>(input: RequestWithRetryInput): Promise<SpApiResponse<T>> {
  const request = new HttpRequest({
    protocol: input.url.protocol,
    hostname: input.url.hostname,
    method: input.method,
    path: `${input.url.pathname}${input.url.search}`,
    headers: input.headers,
    body: input.body,
  });

  const signed = await input.signer.sign(request);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await input.fetcher(input.url.toString(), {
      method: input.method,
      headers: signed.headers,
      body: input.body,
      signal: controller.signal,
    });

    const raw = await response.text();
    const headers = normalizeHeaders(response.headers);

    if (!response.ok) {
      throw new SpApiError(
        `SP-API request failed (${response.status})`,
        response.status,
        raw,
        headers["x-amzn-requestid"]
      );
    }

    const data = parseResponseBody<T>(raw, headers["content-type"]);

    return {
      status: response.status,
      headers,
      data,
      raw,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildUrl(
  endpoint: string,
  path: string,
  query?: Record<string, string | number | boolean | undefined>
): URL {
  const url = new URL(path, endpoint);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

function normalizeHeaders(headers: Headers): Record<string, string> {
  const normalized: Record<string, string> = {};
  headers.forEach((value, key) => {
    normalized[key.toLowerCase()] = value;
  });
  return normalized;
}

function parseResponseBody<T>(raw: string, contentType?: string): T {
  if (!raw) {
    return undefined as T;
  }
  if (contentType && contentType.includes("application/json")) {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as T;
    }
  }
  return raw as T;
}

function buildRetryConfig(base?: AmazonSpApiConfig["retry"], override?: Partial<RetryConfig>): RetryConfig {
  const resolved = {
    maxAttempts: base?.maxAttempts ?? 3,
    baseDelayMs: base?.baseDelayMs ?? 300,
    maxDelayMs: base?.maxDelayMs ?? 4000,
  };

  return {
    maxAttempts: override?.maxAttempts ?? resolved.maxAttempts,
    baseDelayMs: override?.baseDelayMs ?? resolved.baseDelayMs,
    maxDelayMs: override?.maxDelayMs ?? resolved.maxDelayMs,
  };
}

function getRetryDelayMs(attempt: number, retry: RetryConfig): number {
  const delay = Math.min(retry.maxDelayMs, retry.baseDelayMs * 2 ** (attempt - 1));
  const jitter = Math.floor(Math.random() * 100);
  return Math.min(retry.maxDelayMs, delay + jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
