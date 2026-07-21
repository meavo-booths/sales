// Bare specifier (not "node:async_hooks") so the client webpack build can map
// it to an empty module via the fallback in next.config.ts. This module is
// server-only in practice and is tree-shaken from client runtime bundles.
import { AsyncLocalStorage } from "async_hooks";

type RequestContext = {
  /** Acting user's User.id, or null for non-request writes (scripts, cron). */
  userId: string | null;
};

const requestContext = new AsyncLocalStorage<RequestContext>();

/**
 * Seed the acting user for the current async execution. Called from
 * requireSalesAccess() at the top of every authenticated page/action, so the
 * Prisma audit extension can attribute Deal writes without threading the user
 * through every call site.
 */
export function setActorUserId(userId: string | null): void {
  requestContext.enterWith({ userId });
}

/** Current acting user's id, or null if none is set for this execution. */
export function getActorUserId(): string | null {
  return requestContext.getStore()?.userId ?? null;
}
