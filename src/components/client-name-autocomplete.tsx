"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isClientVip } from "@/lib/client-hierarchy";

export type ClientNameOption = {
  id: string;
  name: string;
  market: string;
  isVip: boolean;
  parentName: string | null;
  parentIsVip: boolean;
};

const fieldClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

function formatClientLabel(client: ClientNameOption): string {
  const effectiveVip = isClientVip(
    client,
    client.parentIsVip ? { isVip: client.parentIsVip } : null,
  );
  const name = client.parentName ? `${client.name} (${client.parentName})` : client.name;
  const market = client.market ? ` — ${client.market}` : "";
  return `${effectiveVip ? "★ " : ""}${name}${market}`;
}

export function ClientNameAutocomplete({
  clients,
  value,
  clientId,
  onChangeName,
  onSelectClient,
  required,
}: {
  clients: ClientNameOption[];
  value: string;
  clientId: string | null;
  onChangeName: (name: string, clientId: string | null) => void;
  onSelectClient: (clientId: string) => void;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const matches = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return clients.slice(0, 12);
    return clients
      .filter((client) => client.name.toLowerCase().includes(query))
      .slice(0, 12);
  }, [clients, value]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [value, matches.length]);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  const selectClient = (client: ClientNameOption) => {
    onSelectClient(client.id);
    setOpen(false);
  };

  const handleBlur = () => {
    blurTimeoutRef.current = setTimeout(() => setOpen(false), 150);
  };

  const handleFocus = () => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    setOpen(true);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open || matches.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightIndex((index) => (index + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightIndex((index) => (index - 1 + matches.length) % matches.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      selectClient(matches[highlightIndex]!);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-700">Client name</span>
        <input
          type="text"
          value={value}
          required={required}
          autoComplete="off"
          className={fieldClass}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onChange={(e) => {
            const nextName = e.target.value;
            const linked = clientId ? clients.find((c) => c.id === clientId) : undefined;
            const nextClientId =
              linked && linked.name === nextName ? clientId : null;
            onChangeName(nextName, nextClientId);
            setOpen(true);
          }}
        />
      </label>

      {clientId && (
        <p className="mt-1 text-xs text-slate-500">
          Linked to client directory — edits here are a quote snapshot.
        </p>
      )}

      {open && matches.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {matches.map((client, index) => (
            <li key={client.id} role="option" aria-selected={index === highlightIndex}>
              <button
                type="button"
                className={`block w-full px-3 py-2 text-left text-sm ${
                  index === highlightIndex ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-50"
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectClient(client)}
              >
                {formatClientLabel(client)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
