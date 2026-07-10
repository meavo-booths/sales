import { Nav } from "@/components/nav";
import { requireSalesAccess } from "@/lib/meavo-auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Defense-in-depth: pages check access themselves, but a future page that
  // forgets would otherwise only be behind middleware's session check.
  await requireSalesAccess();

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-8">{children}</main>
    </>
  );
}
