import { prisma } from "@/lib/prisma";
import { QUOTE_NUMBER_PAD, QUOTE_NUMBER_PREFIX } from "@/lib/constants";

/**
 * Next sequential quote number (MQ-00001, MQ-00002, ...). Backed by a
 * Postgres sequence so concurrent quote creation can't collide.
 */
export async function nextQuoteNumber(): Promise<string> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT nextval('"SalesQuoteNumberSeq"') AS n
  `;
  const n = Number(rows[0]?.n ?? 0);
  if (!n) throw new Error("Quote number sequence unavailable");
  return `${QUOTE_NUMBER_PREFIX}${String(n).padStart(QUOTE_NUMBER_PAD, "0")}`;
}
