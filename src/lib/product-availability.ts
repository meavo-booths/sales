export type ProductAvailabilityRule = {
  market: string;
  clientType: "DIRECT" | "AGENCY" | "COWORKING";
};

/** No availability rows means the product is sold in all markets / client types. */
export function productMatchesAvailability(
  availability: ProductAvailabilityRule[],
  market: string,
  clientType: string,
): boolean {
  if (!market) return true;
  if (availability.length === 0) return true;
  return availability.some(
    (row) => row.market === market && row.clientType === clientType,
  );
}
