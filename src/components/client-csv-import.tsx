"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  applyClientCsvImportAction,
  previewClientCsvImportAction,
  type ClientCsvPreviewResult,
} from "@/app/actions/clients";
import type { ClientCsvMode } from "@/lib/clients/csv-import";
import { Modal } from "@/components/modal";
import { Badge, Button } from "@/components/ui";

function modeHint(mode: ClientCsvMode): string {
  if (mode === "parent") {
    return "Required columns: Parent Company Name, Market, Client Type. Creates group / parent accounts.";
  }
  return "Required columns: Company Name, Client Type, Market. Optional: Company URL, Parent Company (must already exist — upload parents first).";
}

export function ClientCsvImportButton() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ClientCsvMode>("parent");
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<ClientCsvPreviewResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetFile = () => {
    setPreview(null);
    setMessage(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const close = () => {
    setOpen(false);
    resetFile();
    setMode("parent");
  };

  const changeMode = (next: ClientCsvMode) => {
    setMode(next);
    resetFile();
  };

  const upload = (file: File) => {
    setError(null);
    setMessage(null);
    const formData = new FormData();
    formData.set("csv", file);
    formData.set("mode", mode);

    startTransition(async () => {
      const result = await previewClientCsvImportAction(formData);
      setPreview(result);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const parts = [
        `${result.okCount} ready`,
        `${result.skippedCount} skipped`,
        `${result.errorCount} error${result.errorCount === 1 ? "" : "s"}`,
      ];
      setMessage(
        result.canImport
          ? `${parts.join(" · ")}. Review and confirm below.`
          : `${parts.join(" · ")}. No rows are ready to import.`,
      );
    });
  };

  const apply = () => {
    if (!preview?.ok || !preview.canImport) return;

    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await applyClientCsvImportAction({
        mode: preview.mode,
        csvText: preview.csvText,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const summary = `${result.created} client${result.created === 1 ? "" : "s"} created`;
      const skipPart =
        result.skipped > 0
          ? ` · ${result.skipped} skipped`
          : "";
      setMessage(`${summary}${skipPart}.`);
      if (result.errors.length > 0) {
        setError(result.errors.join(" · "));
      }
      router.refresh();
      if (result.created > 0 && result.errors.length === 0) {
        setTimeout(close, 1200);
      }
    });
  };

  const previewRows = preview?.ok ? preview.rows : [];
  const canImport = preview?.ok ? preview.canImport : false;

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Bulk upload
      </Button>

      <Modal
        title="Bulk upload clients"
        open={open}
        onClose={close}
        maxWidthClassName="max-w-4xl"
        bodyClassName="mt-4 space-y-4"
      >
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
          <button
            type="button"
            onClick={() => changeMode("parent")}
            aria-pressed={mode === "parent"}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              mode === "parent"
                ? "bg-brand-50 text-brand-800"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Parent companies
          </button>
          <button
            type="button"
            onClick={() => changeMode("normal")}
            aria-pressed={mode === "normal"}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              mode === "normal"
                ? "bg-brand-50 text-brand-800"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Normal companies
          </button>
        </div>

        <p className="text-sm text-slate-600">{modeHint(mode)}</p>

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
            <Button variant="secondary" disabled={pending} onClick={resetFile}>
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
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Message</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={row.rowNumber} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">
                      {row.rowNumber}
                    </td>
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2">
                      {row.status === "ok" ? (
                        <Badge tone="green">OK</Badge>
                      ) : row.status === "skipped" ? (
                        <Badge tone="amber">Skipped</Badge>
                      ) : (
                        <Badge tone="red">Error</Badge>
                      )}
                    </td>
                    <td
                      className={`px-3 py-2 text-xs ${
                        row.status === "error" ? "text-red-600" : "text-slate-600"
                      }`}
                    >
                      {row.message || "—"}
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
