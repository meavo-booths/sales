"use client";

import Link from "next/link";
import { ASSEMBLY_URL } from "@/lib/constants";
import { AddTaskLink } from "@/components/add-task-link";
import {
  CreateXeroFinalInvoiceButton,
  CreateXeroInvoiceButton,
  ReadyToAssembleToggle,
} from "@/components/deal-editors";

const ASSEMBLY_EVENT_LABELS: Record<string, string> = {
  ASSEMBLY: "Assembly",
  REPAIR: "Repair",
  MOVING_SERVICE: "Moving service",
  AFTERCARE: "Aftercare",
  INFO: "Info",
};

type AssemblyLink = {
  dealId: string;
  eventType: string;
};

export function DealPageActions({
  dealDbId,
  dealBusinessId,
  clientName,
  readyToAssemble,
  assemblies,
  showAddTask,
  showCreateInvoice,
  createInvoiceLabel,
  showCreateFinalInvoice,
}: {
  dealDbId: string;
  dealBusinessId: string;
  clientName: string;
  readyToAssemble: boolean;
  assemblies: AssemblyLink[];
  showAddTask: boolean;
  showCreateInvoice: boolean;
  createInvoiceLabel: string;
  showCreateFinalInvoice: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Link
        href={`/deals/${dealDbId}/edit`}
        className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        Edit
      </Link>
      <a
        href={`/api/quotes/${dealDbId}/pdf`}
        className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        Quote PDF
      </a>
      {showCreateInvoice && (
        <CreateXeroInvoiceButton dealId={dealDbId} label={createInvoiceLabel} />
      )}
      {showCreateFinalInvoice && <CreateXeroFinalInvoiceButton dealId={dealDbId} />}
      <ReadyToAssembleToggle dealId={dealDbId} ready={readyToAssemble} />
      {assemblies.map((assembly) => (
        <a
          key={assembly.dealId}
          href={`${ASSEMBLY_URL}/assemblies/${encodeURIComponent(assembly.dealId)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          {ASSEMBLY_EVENT_LABELS[assembly.eventType] ?? assembly.eventType}: {assembly.dealId} ↗
        </a>
      ))}
      {showAddTask && (
        <AddTaskLink
          entityId={dealDbId}
          title={`Follow up: ${dealBusinessId} — ${clientName}`}
        />
      )}
    </div>
  );
}
