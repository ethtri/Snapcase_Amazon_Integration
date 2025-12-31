import type { AmazonLwaConfig } from "./config.js";

type LwaToken = {
  accessToken: string;
  expiresAt: number;
};

export type LwaTokenProvider = {
  getAccessToken: () => Promise<string>;
};

type LwaTokenProviderOptions = {
  clockSkewMs?: number;
  fetcher?: typeof fetch;
};

const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";
const DEFAULT_SKEW_MS = 2 * 60 * 1000;

export function createLwaTokenProvider(
  config: AmazonLwaConfig,
  options: LwaTokenProviderOptions = {}
): LwaTokenProvider {
  const fetcher = options.fetcher ?? fetch;
  const clockSkewMs = options.clockSkewMs ?? DEFAULT_SKEW_MS;
  let cached: LwaToken | null = null;
  let inFlight: Promise<LwaToken> | null = null;

  async function refreshToken(): Promise<LwaToken> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: config.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });

    const response = await fetcher(LWA_TOKEN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`LWA token request failed (${response.status}): ${raw}`);
    }

    const data = JSON.parse(raw) as {
      access_token: string;
      expires_in: number;
    };

    const expiresInMs = Math.max(0, data.expires_in) * 1000;
    const expiresAt = Date.now() + expiresInMs - clockSkewMs;

    return {
      accessToken: data.access_token,
      expiresAt,
    };
  }

  async function getToken(): Promise<LwaToken> {
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }

    if (!inFlight) {
      inFlight = refreshToken().finally(() => {
        inFlight = null;
      });
    }

    cached = await inFlight;
    return cached;
  }

  return {
    async getAccessToken() {
      const token = await getToken();
      return token.accessToken;
    },
  };
}
