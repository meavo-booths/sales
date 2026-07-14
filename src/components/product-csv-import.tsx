"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  applyProductCsvImportAction,
  previewProductCsvImportAction,
  type ProductCsvPreviewResult,
} from "@/app/actions/products";
import { Modal } from "@/components/modal";
import { Badge, Button } from "@/components/ui";
import type { CsvRowPreview } from "@/lib/products/csv-import";

function availabilitySummary(row: CsvRowPreview): string {
  if (!row.plannedChanges) return "—";
  return row.plannedChanges.availability
    .map((entry) => `${entry.market} (${entry.clientType})`)
    .join(", ");
}

export function ProductCsvImportButton() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<ProductCsvPreviewResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPreview(null);
    setMessage(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const upload = (file: File) => {
    setError(null);
    setMessage(null);
    const formData = new FormData();
    formData.set("csv", file);

    startTransition(async () => {
      const result = await previewProductCsvImportAction(formData);
      setPreview(result);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const okCount = result.rows.filter((row) => row.status === "ok").length;
      setMessage(
        result.canImport
          ? `${okCount} product${okCount === 1 ? "" : "s"} ready to import. Review and confirm below.`
          : "Fix the errors below before importing.",
      );
    });
  };

  const apply = () => {
    if (!preview?.ok || !preview.canImport) return;

    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await applyProductCsvImportAction(preview.csvText);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const summary = `${result.updated} product${result.updated === 1 ? "" : "s"} updated`;
      const extra =
        result.errors.length > 0 ? ` (${result.errors.length} issue${result.errors.length === 1 ? "" : "s"})` : "";
      setMessage(`${summary}${extra}.`);
      if (result.errors.length > 0) {
        setError(result.errors.join(" · "));
      }
      router.refresh();
      if (result.updated > 0 && result.errors.length === 0) {
        setTimeout(close, 1200);
      }
    });
  };

  const previewRows = preview?.ok ? preview.rows : [];
  const canImport = preview?.ok ? preview.canImport : false;

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Import from CSV
      </Button>

      <Modal
        title="Import products from CSV"
        open={open}
        onClose={close}
        maxWidthClassName="max-w-5xl"
        bodyClassName="mt-4 space-y-4"
      >
        <p className="text-sm text-slate-600">
          Match existing products by Xero Item Code. Sync from Xero first if codes are missing.
          Required columns: Item Code, Item Name, Zamp Tax Code, Type, Product Family, Currency,
          Market, Client Type.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="text-sm text-slate-700"
            disabled={pending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload(file);
            }}
          />
          {preview && (
            <Button variant="secondary" disabled={pending} onClick={reset}>
              Clear
            </Button>
          )}
        </div>

        {message && <p className="text-sm text-green-700">{message}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {previewRows.length > 0 && (
          <div className="max-h-[24rem] overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Item Code</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Changes</th>
                  <th className="px-3 py-2">Availability</th>
                  <th className="px-3 py-2">Issues</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, index) => (
                  <tr key={`${row.itemCode}-${index}`} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs">{row.itemCode}</td>
                    <td className="px-3 py-2">{row.itemName}</td>
                    <td className="px-3 py-2">
                      {row.status === "ok" ? (
                        <Badge tone="green">OK</Badge>
                      ) : (
                        <Badge tone="red">Error</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {row.plannedChanges ? (
                        <div className="space-y-0.5">
                          <div>
                            {row.plannedChanges.kind === "BOOTH" ? "Booth" : "Add-on"} ·{" "}
                            {row.plannedChanges.family}
                          </div>
                          <div>{row.plannedChanges.currency}</div>
                          {row.plannedChanges.taxCode && (
                            <div>Zamp: {row.plannedChanges.taxCode}</div>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">{availabilitySummary(row)}</td>
                    <td className="px-3 py-2 text-xs text-red-600">
                      {row.errors.length > 0 ? row.errors.join(" · ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={apply} disabled={pending || !canImport}>
            {pending ? "Working…" : "Import"}
          </Button>
          <Button variant="secondary" onClick={close} disabled={pending}>
            Close
          </Button>
        </div>
      </Modal>
    </>
  );
}
