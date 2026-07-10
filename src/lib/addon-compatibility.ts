/**
 * Add-on ↔ booth family compatibility. An add-on with no restriction rows is
 * compatible with every booth; otherwise the booth's family must be listed.
 * Shared by the quote form (option filtering) and the quote actions (server
 * enforcement) so the rule cannot drift between the two.
 */
export function addOnCompatibleWithBoothFamily(
  restrictedToBoothFamilies: readonly string[],
  boothFamily: string | null | undefined,
): boolean {
  if (restrictedToBoothFamilies.length === 0) return true;
  return boothFamily != null && restrictedToBoothFamilies.includes(boothFamily);
}
