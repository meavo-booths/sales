/**
 * Smoke test: call Zamp /calculations with a sample US transaction.
 *
 *   npx tsx --env-file=.env scripts/zamp-calc-check.ts
 *
 * Requires ZAMP_API_KEY. Does not write to the database.
 */
import { zampCalculate } from "../src/lib/zamp/client";
import { DEFAULT_ZAMP_TAX_CODE } from "../src/lib/zamp/constants";
import { prepareZampTransaction } from "../src/lib/zamp/payload";
import type { ZampTransaction } from "../src/lib/zamp/types";

async function main() {
  if (!process.env.ZAMP_API_KEY?.trim()) {
    console.error("ZAMP_API_KEY is not set — add it to .env and retry.");
    process.exit(1);
  }

  const transaction: ZampTransaction = {
    id: "smoke-test-1",
    name: "Zamp smoke test",
    transactedAt: new Date().toISOString(),
    currency: "USD",
    subtotal: 5000,
    taxCollected: 0,
    total: 5000,
    shipToAddress: {
      line1: "120 SW 10TH AVE",
      line2: null,
      city: "TOPEKA",
      state: "KS",
      zip: "66612",
    },
    lineItems: [
      {
        id: "LI-1",
        amount: 5000,
        quantity: 1,
        productName: "MEAVO Haven One booth",
        productTaxCode: DEFAULT_ZAMP_TAX_CODE,
      },
    ],
    metadata: { source: "meavo-sales-smoke" },
  };

  console.log("Calling Zamp /calculations…");
  const prepared = prepareZampTransaction(transaction);
  if (typeof prepared === "string") {
    console.error(prepared);
    process.exit(1);
  }
  const result = await zampCalculate(prepared);
  console.log("taxDue:", result.taxDue);
  console.log("jurisdictions:", result.taxes.length);
  if (result.taxes[0]) {
    console.log("sample tax row:", JSON.stringify(result.taxes[0], null, 2));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
