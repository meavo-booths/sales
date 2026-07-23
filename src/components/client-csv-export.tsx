"use client";

import { useState, useTransition } from "react";
import type { DealClientType } from "@prisma/client";
import { exportClientsCsvAction } from "@/app/actions/clients";
import type { ClientSort } from "@/lib/client-filters";
import type { ClientHierarchyView } from "@/lib/client-hierarchy";
import { Button } from "@/components/ui";

export function ClientCsvExportButton({
  search,
  selectedTypes,
  selectedCountries,
  hierarchyView,
  sort,
}: {
  search: string;
  selectedTypes: DealClientType[];
  selectedCountries: string[];
  hierarchyView: ClientHierarchyView;
  sort: ClientSort;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const exportCsv = () => {
    setError(null);
    startTransition(async () => {
      const result = await exportClientsCsvAction({
        search,
        clientTypes: selectedTypes,
        countries: selectedCountries,
        hierarchyView,
        sort,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      const blob = new Blob([result.csvText], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" disabled={pending} onClick={exportCsv}>
        {pending ? "Exporting…" : "Export"}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
