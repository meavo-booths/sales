import { requireSalesAccess } from "@/lib/meavo-auth";
import { EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NumbersPage() {
  await requireSalesAccess();

  return (
    <>
      <PageHeader
        title="Numbers"
        description="Reporting dashboard for quotes, deals, and revenue."
      />
      <EmptyState>Charts and metrics will land here.</EmptyState>
    </>
  );
}
