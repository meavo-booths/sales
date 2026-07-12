/**
 * Minimal Zamp API client for US sales tax calculations and transaction sync.
 *
 * Auth is a static Bearer token issued during Zamp onboarding. All calls are
 * server-side only — never expose ZAMP_API_KEY to the browser.
 */

import type { ZampCalcResult, ZampTransaction } from "@/lib/zamp/types";

const DEFAULT_API_BASE = "https://api.zamp.com";

export class ZampError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ZampError";
  }
}

export function isZampConfigured(): boolean {
  return Boolean(process.env.ZAMP_API_KEY?.trim());
}

function apiBase(): string {
  return (process.env.ZAMP_API_BASE_URL?.trim() || DEFAULT_API_BASE).replace(/\/$/, "");
}

export async function zampFetch<T>(
  path: string,
  init?: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown },
): Promise<T> {
  const apiKey = process.env.ZAMP_API_KEY?.trim();
  if (!apiKey) {
    throw new ZampError("Zamp is not configured (ZAMP_API_KEY missing)");
  }

  const response = await fetch(`${apiBase()}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as { message?: string; error?: string };
      detail = body.message || body.error || "";
    } catch {
      detail = await response.text().catch(() => "");
    }
    throw new ZampError(
      `Zamp API ${init?.method ?? "GET"} ${path} failed (${response.status})${detail ? `: ${detail.slice(0, 500)}` : ""}`,
      response.status,
    );
  }

  return (await response.json()) as T;
}

/** Estimate tax at quote time — always recalculates. */
export async function zampCalculate(transaction: ZampTransaction): Promise<ZampCalcResult> {
  return zampFetch<ZampCalcResult>("/calculations", {
    method: "POST",
    body: transaction,
  });
}

/** Commit a won deal transaction for filing and nexus monitoring. */
export async function zampCreateTransaction(transaction: ZampTransaction): Promise<ZampCalcResult> {
  return zampFetch<ZampCalcResult>("/transactions", {
    method: "POST",
    body: { ...transaction, recalculate: true },
  });
}
