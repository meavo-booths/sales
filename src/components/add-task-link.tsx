import { buildAddTaskUrl } from "@/lib/tasks-link";

const actionClassName =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50";

export function AddTaskLink({
  entityId,
  title,
}: {
  entityId: string;
  title: string;
}) {
  const href = buildAddTaskUrl({
    linkedApp: "SALES",
    entityId,
    title,
  });

  return (
    <a href={href} target="_blank" rel="noreferrer" className={actionClassName}>
      Add task ↗
    </a>
  );
}
