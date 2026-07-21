// Bare specifier (not "node:async_hooks") so the client webpack build can map
// it to an empty module via the fallback in next.config.ts. This module is
// server-only in practice; client bundles must not evaluate it at runtime.
import { AsyncLocalStorage } from "async_hooks";

type RequestContext = {
  /** Acting user's User.id, or null for non-request writes (scripts, cron). */
  userId: string | null;
};

/**
 * AsyncLocalStorage is unavailable in the browser. If this module is ever
 * pulled into a client bundle, fall back to a no-op store so the page does
 * not crash with "AsyncLocalStorage is not a constructor".
 */
const requestContext =
  typeof AsyncLocalStorage === "function"
    ? new AsyncLocalStorage<RequestContext>()
    : null;

/**
 * Seed the acting user for the current async execution. Called from
 * requireSalesAccess() at the top of every authenticated page/action, so the
 * Prisma audit extension can attribute Deal writes without threading the user
 * through every call site.
 */
export function setActorUserId(userId: string | null): void {
  requestContext?.enterWith({ userId });
}

/** Current acting user's id, or null if none is set for this execution. */
export function getActorUserId(): string | null {
  return requestContext?.getStore()?.userId ?? null;
}
