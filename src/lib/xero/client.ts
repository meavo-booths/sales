/**
 * Minimal Xero API client for a Custom Connection (OAuth2 client credentials).
 *
 * Custom Connections are bound to a single Xero organisation, so no
 * xero-tenant-id header is needed. Access tokens live 30 minutes and are
 * cached in-memory per server instance.
 */

const TOKEN_URL = "https://identity.xero.com/connect/token";
const API_BASE = "https://api.xero.com/api.xro/2.0";

export class XeroError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "XeroError";
  }
}

export function isXeroConfigured(): boolean {
  return Boolean(process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET);
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new XeroError("Xero is not configured (XERO_CLIENT_ID / XERO_CLIENT_SECRET missing)");
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new XeroError(
      `Xero token request failed (${response.status}): ${body.slice(0, 300)}`,
      response.status,
    );
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

export async function xeroFetch<T>(
  path: string,
  init?: { method?: "GET" | "POST" | "PUT"; body?: unknown; headers?: Record<string, string> },
): Promise<T> {
  const token = await getAccessToken();

  const response = await fetch(`${API_BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as {
        Detail?: string;
        Message?: string;
        Elements?: { ValidationErrors?: { Message: string }[] }[];
      };
      detail =
        body.Elements?.flatMap((e) => e.ValidationErrors ?? [])
          .map((v) => v.Message)
          .join("; ") ||
        body.Detail ||
        body.Message ||
        "";
    } catch {
      detail = await response.text().catch(() => "");
    }
    throw new XeroError(
      `Xero API ${init?.method ?? "GET"} ${path} failed (${response.status})${detail ? `: ${detail.slice(0, 500)}` : ""}`,
      response.status,
    );
  }

  return (await response.json()) as T;
}
