"use client";

import { useState } from "react";
import {
  AddOnCreateForm,
  BoothCreateForm,
  SyncXeroProductsButton,
} from "@/components/product-forms";
import { ProductCsvImportButton } from "@/components/product-csv-import";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui";

export function ProductPageActions({ isAdmin }: { isAdmin: boolean }) {
  const [boothOpen, setBoothOpen] = useState(false);
  const [addOnOpen, setAddOnOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => setBoothOpen(true)}>
          Create booth
        </Button>
        <Button variant="secondary" onClick={() => setAddOnOpen(true)}>
          Create add-on
        </Button>
        {isAdmin && (
          <>
            <SyncXeroProductsButton />
            <ProductCsvImportButton />
          </>
        )}
      </div>

      <Modal
        title="Create booth"
        open={boothOpen}
        onClose={() => setBoothOpen(false)}
        maxWidthClassName="max-w-3xl"
      >
        {boothOpen && (
          <BoothCreateForm inModal onCreated={() => setBoothOpen(false)} />
        )}
      </Modal>

      <Modal
        title="Create add-on"
        open={addOnOpen}
        onClose={() => setAddOnOpen(false)}
        maxWidthClassName="max-w-3xl"
      >
        {addOnOpen && (
          <AddOnCreateForm inModal onCreated={() => setAddOnOpen(false)} />
        )}
      </Modal>
    </>
  );
}
