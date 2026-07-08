export const LIST_PAGE_SIZE = 25;

export function parseListPage(pageParam: string | undefined, totalPages: number): number {
  const requestedPage = Number(pageParam);
  return Math.min(
    totalPages,
    Number.isInteger(requestedPage) && requestedPage >= 1 ? requestedPage : 1,
  );
}
