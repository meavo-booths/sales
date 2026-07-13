export const TASKS_URL = process.env.TASKS_URL ?? "https://tasks.meavo.app";

export function buildAddTaskUrl(params: {
  linkedApp: "SALES" | "ASSEMBLY";
  entityId: string;
  title?: string;
}): string {
  const url = new URL("/create", TASKS_URL);
  url.searchParams.set("linkedApp", params.linkedApp);
  url.searchParams.set("entityId", params.entityId);
  if (params.title) {
    url.searchParams.set("title", params.title);
  }
  return url.toString();
}
