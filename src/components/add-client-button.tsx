"use client";

import { useState } from "react";
import { ClientForm } from "@/components/client-form";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui";

export function AddClientButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Add client
      </Button>
      <Modal
        title="Add client"
        open={open}
        onClose={() => setOpen(false)}
        maxWidthClassName="max-w-3xl"
        panelClassName="p-6"
        bodyClassName="mt-4"
      >
        {open && (
          <ClientForm
            noCard
            title=""
            onCreated={() => setOpen(false)}
          />
        )}
      </Modal>
    </>
  );
}
