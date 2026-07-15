"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AddOnProductFamily, BoothProductFamily, DealContactKind, DeliveryType, PaymentTerms } from "@prisma/client";
import { createQuoteAction, updateQuoteAction } from "@/app/actions/quotes";
import { calculateUsTaxAction } from "@/app/actions/zamp";
import { searchClientsAction } from "@/app/actions/clients";
import { getFxRateToEurAction } from "@/app/actions/fx";
import {
  CLIENT_TYPE_LABELS,
  CONTACT_KIND_LABELS,
  FINISH_LABELS,
  MARKET_OPTIONS,
  PAYMENT_TERMS_FORM_OPTIONS,
  PAYMENT_TERMS_LABELS,
  QUOTE_CURRENCIES,
  DELIVERY_TYPE_LABELS,
  DELIVERY_TYPE_OPTIONS,
  SOCKET_TYPE_OPTIONS,
  formatMoney,
  type QuoteCurrency,
} from "@/lib/deal-values";
import { convertBetweenQuoteCurrencies } from "@/lib/exchange-rates";
import {
  lineExtendedTotal,
  lineItemExtendedTotal,
  type LineItemDiscountType,
} from "@/lib/line-item-pricing";
import { currencyForMarket } from "@/lib/market-currency";
import { dealSubtotal, dealTotals, formatTaxLineLabel } from "@/lib/vat";
import { isUsMarket } from "@/lib/zamp/constants";
import { stateFromZip, US_STATES } from "@/lib/us-state";
import { isClientVip, isQuoteSelectableClient } from "@/lib/client-hierarchy";
import { productMatchesAvailability } from "@/lib/product-availability";
import { addOnCompatibleWithBoothFamily } from "@/lib/addon-compatibility";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";
import { ClientNameAutocomplete } from "@/components/client-name-autocomplete";
import { VatNumberField } from "@/components/vat-check";

export type ProductAvailabilityRow = {
  market: string;
  clientType: "DIRECT" | "AGENCY" | "COWORKING";
};

function QuoteTotals({
  subtotal,
  market,
  currency,
  estimatedUsTax,
  onEstimateTax,
  estimatingTax,
  estimateError,
}: {
  subtotal: number;
  market: string;
  currency: string;
  estimatedUsTax?: number | null;
  onEstimateTax?: () => void;
  estimatingTax?: boolean;
  estimateError?: string | null;
}) {
  const isUs = isUsMarket(market);
  const hasUsEstimate = estimatedUsTax !== null && estimatedUsTax !== undefined;
  const salesTaxAmount = isUs && hasUsEstimate ? estimatedUsTax : undefined;
  const totals = dealTotals(subtotal, market, { salesTaxAmount });
  const taxLabel = formatTaxLineLabel(market, totals.vatRate);

  if (!totals.hasTax && !isUs) {
    return (
      <p className="text-right text-base font-semibold text-slate-900">
        Total (excl. VAT): {formatMoney(totals.subtotal, currency)}
      </p>
    );
  }

  return (
    <div className="space-y-2 text-right">
      <p className="text-sm text-slate-600">
        Subtotal (excl. {isUs ? "sales tax" : totals.taxLabel.toLowerCase()}):{" "}
        {formatMoney(totals.subtotal, currency)}
      </p>
      {totals.hasTax && (
        <p className="text-sm text-slate-600">
          {taxLabel}: {formatMoney(totals.vatAmount, currency)}
        </p>
      )}
      {(isUs ? hasUsEstimate : totals.hasTax) && (
        <p className="text-base font-semibold text-slate-900">
          Total (incl. {totals.taxLabel.toLowerCase()}): {formatMoney(totals.totalInclVat, currency)}
        </p>
      )}
      {isUs && onEstimateTax && (
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant={hasUsEstimate ? "ghost" : "secondary"}
            disabled={estimatingTax}
            onClick={onEstimateTax}
          >
            {estimatingTax
              ? hasUsEstimate
                ? "Recalculating…"
                : "Calculating…"
              : hasUsEstimate
                ? "Re-estimate sales tax"
                : "Estimate sales tax"}
          </Button>
        </div>
      )}
      {isUs && (
        <p className="text-xs text-slate-500">
          {hasUsEstimate
            ? "Final US sales tax is recalculated via Zamp when you save the quote."
            : "Final US sales tax is calculated via Zamp when you save the quote."}
        </p>
      )}
      {estimateError && <p className="text-sm text-red-600">{estimateError}</p>}
    </div>
  );
}

export type ProductOption = {
  id: string;
  name: string;
  version: string;
  kind: "BOOTH" | "ADDON";
  listPrice: number;
  currency: QuoteCurrency;
  boothFamily: BoothProductFamily | null;
  addOnFamily: AddOnProductFamily | null;
  restrictedToBoothFamilies: BoothProductFamily[];
  availability: ProductAvailabilityRow[];
};

type ContactDraft = {
  kind: DealContactKind;
  name: string;
  email: string;
  phone: string;
  role: string;
};

export type ClientOption = {
  id: string;
  name: string;
  registeredAddress: string;
  vatNumber: string;
  clientType: "DIRECT" | "AGENCY" | "COWORKING";
  market: string;
  website: string;
  isVip: boolean;
  parentClientId: string | null;
  parentName: string | null;
  parentIsVip: boolean;
  subsidiaryCount: number;
  contacts: ContactDraft[];
};

type DiscountDraft = {
  discountType: LineItemDiscountType;
  discountValue: number;
};

const EMPTY_DISCOUNT: DiscountDraft = { discountType: "NONE", discountValue: 0 };

type CustomLineDraft = DiscountDraft & {
  name: string;
  quantity: number;
  unitPrice: number;
  description: string;
};

type AddOnDraft = DiscountDraft & {
  productId: string;
  quantity: number;
  unitPrice: number;
  description: string;
};

type LineItemDraft = DiscountDraft & {
  productId: string;
  quantity: number;
  unitPrice: number;
  finish: "CUSTOM" | "WHITE_STOCK" | "BLACK_STOCK" | "LDF_COLOUR";
  finishDetails: string;
  description: string;
  addOns: AddOnDraft[];
};

export type QuoteFormValues = {
  clientId: string | null;
  dealDate: string;
  salesRep: string;
  market: string;
  usState: string;
  shipToLine1: string;
  shipToLine2: string;
  shipToCity: string;
  shipToZip: string;
  clientName: string;
  registeredAddress: string;
  website: string;
  assemblyAddress: string;
  clientPo: string;
  actualClient: string;
  socketType: string;
  targetDeliveryDate: string;
  deliveryType: DeliveryType | "";
  vatNumber: string;
  clientType: "DIRECT" | "AGENCY" | "COWORKING";
  currency: QuoteCurrency;
  isVip: boolean;
  paymentTerms: PaymentTerms;
  notes: string;
  contacts: ContactDraft[];
  lineItems: LineItemDraft[];
  standaloneAddOns: AddOnDraft[];
  customLines: CustomLineDraft[];
};

const EMPTY_CONTACT: ContactDraft = { kind: "MAIN", name: "", email: "", phone: "", role: "" };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function QuoteForm({
  products,
  quoteId,
  initialValues,
  initialUsTaxAmount,
  defaultSalesRep,
}: {
  products: ProductOption[];
  quoteId?: string;
  initialValues?: QuoteFormValues;
  /** Persisted Zamp tax from a saved US quote (edit mode). */
  initialUsTaxAmount?: number;
  defaultSalesRep?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [estimatedUsTax, setEstimatedUsTax] = useState<number | null>(
    initialUsTaxAmount != null && initialUsTaxAmount > 0 ? initialUsTaxAmount : null,
  );
  const [estimatingTax, setEstimatingTax] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);

  const boothProducts = useMemo(() => products.filter((p) => p.kind === "BOOTH"), [products]);
  const addOnProducts = useMemo(() => products.filter((p) => p.kind === "ADDON"), [products]);

  // Client picker options come from a debounced server search (top 20 by
  // name) instead of shipping the whole directory to the browser.
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);

  const selectableClients = useMemo(
    () => clientOptions.filter((c) => isQuoteSelectableClient(c.subsidiaryCount)),
    [clientOptions],
  );

  const [values, setValues] = useState<QuoteFormValues>(
    initialValues ?? {
      clientId: null,
      dealDate: today(),
      salesRep: defaultSalesRep ?? "",
      market: "",
      usState: "",
      shipToLine1: "",
      shipToLine2: "",
      shipToCity: "",
      shipToZip: "",
      clientName: "",
      registeredAddress: "",
      website: "",
      assemblyAddress: "",
      clientPo: "",
      actualClient: "",
      socketType: "",
      targetDeliveryDate: "",
      deliveryType: "",
      vatNumber: "",
      clientType: "DIRECT",
      currency: "EUR",
      isVip: false,
      paymentTerms: "UPFRONT_100",
      notes: "",
      contacts: [{ ...EMPTY_CONTACT }],
      lineItems: [],
      standaloneAddOns: [],
      customLines: [],
    },
  );

  const clientSearchSeq = useRef(0);
  useEffect(() => {
    const seq = ++clientSearchSeq.current;
    const timer = setTimeout(async () => {
      try {
        const results = await searchClientsAction(values.clientName);
        // Drop out-of-order responses so fast typing can't show stale matches.
        if (clientSearchSeq.current === seq) setClientOptions(results);
      } catch {
        // Keep the previous options; the rep can still type a new client name.
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [values.clientName]);

  const [fxRatesToEur, setFxRatesToEur] = useState<Partial<Record<QuoteCurrency, number>>>({
    EUR: 1,
  });

  const productCurrencies = useMemo(
    () => [...new Set(products.map((product) => product.currency))],
    [products],
  );

  useEffect(() => {
    const needed = new Set<QuoteCurrency>([values.currency, ...productCurrencies]);
    let cancelled = false;

    void (async () => {
      const rates: Partial<Record<QuoteCurrency, number>> = { EUR: 1 };
      for (const currency of needed) {
        if (currency === "EUR") continue;
        const result = await getFxRateToEurAction(currency);
        if (result.ok) rates[currency] = result.rate;
      }
      if (!cancelled) setFxRatesToEur(rates);
    })();

    return () => {
      cancelled = true;
    };
  }, [values.currency, productCurrencies]);

  const fetchFxRates = async (
    currencies: Iterable<QuoteCurrency>,
  ): Promise<Partial<Record<QuoteCurrency, number>>> => {
    const rates: Partial<Record<QuoteCurrency, number>> = { EUR: 1, ...fxRatesToEur };
    for (const currency of currencies) {
      if (currency === "EUR" || rates[currency]) continue;
      const result = await getFxRateToEurAction(currency);
      if (result.ok) rates[currency] = result.rate;
    }
    setFxRatesToEur(rates);
    return rates;
  };

  /**
   * Catalog list price converted into the quote currency. 0 when the FX rate
   * is not loaded yet — an obviously-wrong prefill the rep must correct,
   * rather than a silently unconverted amount.
   */
  const catalogUnitPrice = (
    product: ProductOption,
    quoteCurrency: QuoteCurrency = values.currency,
    rates: Partial<Record<QuoteCurrency, number>> = fxRatesToEur,
  ) =>
    convertBetweenQuoteCurrencies(product.listPrice, product.currency, quoteCurrency, rates) ??
    0;

  const selectedProductIds = useMemo(() => {
    const ids = new Set<string>();
    for (const line of values.lineItems) {
      ids.add(line.productId);
      for (const addOn of line.addOns) ids.add(addOn.productId);
    }
    for (const addOn of values.standaloneAddOns) ids.add(addOn.productId);
    return ids;
  }, [values.lineItems, values.standaloneAddOns]);

  const availableBoothProducts = useMemo(
    () =>
      boothProducts.filter(
        (product) =>
          selectedProductIds.has(product.id) ||
          productMatchesAvailability(product.availability, values.market, values.clientType),
      ),
    [boothProducts, selectedProductIds, values.market, values.clientType],
  );

  const availableAddOnProducts = useMemo(
    () =>
      addOnProducts.filter(
        (product) =>
          selectedProductIds.has(product.id) ||
          productMatchesAvailability(product.availability, values.market, values.clientType),
      ),
    [addOnProducts, selectedProductIds, values.market, values.clientType],
  );

  const clientNameOptions = useMemo(
    () =>
      selectableClients.map((client) => ({
        id: client.id,
        name: client.name,
        market: client.market,
        isVip: client.isVip,
        parentName: client.parentName,
        parentIsVip: client.parentIsVip,
      })),
    [selectableClients],
  );

  const set = <K extends keyof QuoteFormValues>(key: K, value: QuoteFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (
      key === "clientName" ||
      key === "shipToLine1" ||
      key === "shipToLine2" ||
      key === "shipToCity" ||
      key === "shipToZip" ||
      key === "usState" ||
      key === "market" ||
      key === "lineItems" ||
      key === "standaloneAddOns" ||
      key === "customLines"
    ) {
      setEstimateError(null);
    }
  };

  const changeCurrency = async (currency: QuoteCurrency) => {
    const productIds = new Set<string>();
    for (const line of values.lineItems) {
      productIds.add(line.productId);
      for (const addOn of line.addOns) productIds.add(addOn.productId);
    }
    for (const addOn of values.standaloneAddOns) productIds.add(addOn.productId);

    const currencies = new Set<QuoteCurrency>([currency]);
    for (const productId of productIds) {
      const product = products.find((p) => p.id === productId);
      if (product) currencies.add(product.currency);
    }

    const rates = await fetchFxRates(currencies);
    setError(null);
    setValues((prev) => {
      const priceForProduct = (productId: string, fallback: number) => {
        const product = products.find((p) => p.id === productId);
        if (!product) return fallback;
        return catalogUnitPrice(product, currency, rates);
      };
      return {
        ...prev,
        currency,
        lineItems: prev.lineItems.map((line) => ({
          ...line,
          unitPrice: priceForProduct(line.productId, line.unitPrice),
          addOns: line.addOns.map((addOn) => ({
            ...addOn,
            unitPrice: priceForProduct(addOn.productId, addOn.unitPrice),
          })),
        })),
        standaloneAddOns: prev.standaloneAddOns.map((addOn) => ({
          ...addOn,
          unitPrice: priceForProduct(addOn.productId, addOn.unitPrice),
        })),
      };
    });
  };

  const pickClient = (clientId: string) => {
    const client = clientOptions.find((c) => c.id === clientId);
    if (!client || !isQuoteSelectableClient(client.subsidiaryCount)) return;
    const effectiveVip = isClientVip(
      client,
      client.parentIsVip ? { isVip: client.parentIsVip } : null,
    );
    setValues((prev) => ({
      ...prev,
      clientId: client.id,
      clientName: client.name,
      registeredAddress: client.registeredAddress,
      website: client.website,
      vatNumber: client.vatNumber,
      clientType: client.clientType,
      market: client.market,
      isVip: effectiveVip,
      contacts:
        client.contacts.length > 0
          ? client.contacts.map((c) => ({ ...c }))
          : [{ ...EMPTY_CONTACT }],
    }));
    void changeCurrency(currencyForMarket(client.market));
  };

  const setContact = (index: number, patch: Partial<ContactDraft>) =>
    setValues((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));

  const setLineItem = (index: number, patch: Partial<LineItemDraft>) =>
    setValues((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((li, i) => (i === index ? { ...li, ...patch } : li)),
    }));

  const addLineItem = () => {
    const first = availableBoothProducts[0];
    if (!first) return;
    setValues((prev) => ({
      ...prev,
      lineItems: [
        ...prev.lineItems,
        {
          productId: first.id,
          quantity: 1,
          unitPrice: catalogUnitPrice(first),
          finish: "WHITE_STOCK",
          finishDetails: "",
          description: "",
          addOns: [],
          ...EMPTY_DISCOUNT,
        },
      ],
    }));
  };

  /**
   * Add-ons offered for a given booth product: unrestricted ones plus those
   * explicitly compatible with the booth. The currently selected add-on is
   * always kept so existing quotes still render and save.
   */
  const addOnsForBooth = (boothProductId: string, currentAddOnId?: string) => {
    const boothProduct = products.find((p) => p.id === boothProductId);
    const boothFamily = boothProduct?.boothFamily;
    return availableAddOnProducts.filter(
      (p) =>
        addOnCompatibleWithBoothFamily(p.restrictedToBoothFamilies, boothFamily) ||
        p.id === currentAddOnId,
    );
  };

  const newAddOnDraft = (options: ProductOption[] = availableAddOnProducts): AddOnDraft | null => {
    const first = options[0];
    if (!first) return null;
    return {
      productId: first.id,
      quantity: 1,
      unitPrice: catalogUnitPrice(first),
      description: "",
      ...EMPTY_DISCOUNT,
    };
  };

  const setAttachedAddOn = (lineIndex: number, addOnIndex: number, patch: Partial<AddOnDraft>) =>
    setValues((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((li, i) =>
        i === lineIndex
          ? {
              ...li,
              addOns: li.addOns.map((a, j) => (j === addOnIndex ? { ...a, ...patch } : a)),
            }
          : li,
      ),
    }));

  const setStandaloneAddOn = (index: number, patch: Partial<AddOnDraft>) =>
    setValues((prev) => ({
      ...prev,
      standaloneAddOns: prev.standaloneAddOns.map((a, i) =>
        i === index ? { ...a, ...patch } : a,
      ),
    }));

  const setCustomLine = (index: number, patch: Partial<CustomLineDraft>) =>
    setValues((prev) => ({
      ...prev,
      customLines: prev.customLines.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));

  // Flatten the nested drafts so the preview uses the same subtotal
  // implementation as the saved quote (deal-sections, PDF, client history).
  const total = dealSubtotal({
    lineItems: [
      ...values.lineItems,
      ...values.lineItems.flatMap((li) => li.addOns),
      ...values.standaloneAddOns,
      ...values.customLines,
    ],
  });

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = quoteId
        ? await updateQuoteAction(quoteId, values)
        : await createQuoteAction(values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/quotes/${result.id}`);
      router.refresh();
    });
  };

  const estimateUsTax = () => {
    setEstimateError(null);
    setEstimatingTax(true);
    void calculateUsTaxAction(values)
      .then((result) => {
        setEstimatingTax(false);
        if (!result.ok) {
          setEstimateError(result.error);
          return;
        }
        setEstimatedUsTax(result.taxDue);
      })
      .catch(() => {
        setEstimatingTax(false);
        setEstimateError("Sales tax estimate failed — try again");
      });
  };

  const discountControls = (
    draft: DiscountDraft,
    update: (patch: Partial<DiscountDraft>) => void,
    unitPrice: number,
  ) => (
    <div className="grid gap-2 sm:grid-cols-2">
      <Select
        label="Discount"
        value={draft.discountType}
        onChange={(e) => {
          const discountType = e.target.value as LineItemDiscountType;
          update({
            discountType,
            discountValue: discountType === "NONE" ? 0 : draft.discountValue,
          });
        }}
      >
        <option value="NONE">None</option>
        <option value="FIXED">Fixed amount</option>
        <option value="PERCENT">Percentage</option>
      </Select>
      {draft.discountType !== "NONE" ? (
        <Input
          label={
            draft.discountType === "PERCENT"
              ? "Discount %"
              : `Discount (${values.currency})`
          }
          type="number"
          step="0.01"
          min={0}
          max={draft.discountType === "PERCENT" ? 100 : unitPrice}
          value={draft.discountValue}
          onChange={(e) => update({ discountValue: Number(e.target.value) || 0 })}
        />
      ) : (
        <div />
      )}
    </div>
  );

  const addOnFields = (
    addOn: AddOnDraft,
    update: (patch: Partial<AddOnDraft>) => void,
    remove: () => void,
    options: ProductOption[] = availableAddOnProducts,
  ) => (
    <>
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1.5fr_auto]">
      <Select
        label="Add-on"
        value={addOn.productId}
        onChange={(e) => {
          const product = options.find((p) => p.id === e.target.value);
          update({
            productId: e.target.value,
            unitPrice: product ? catalogUnitPrice(product) : addOn.unitPrice,
          });
        }}
      >
        {options.map((product) => (
          <option key={product.id} value={product.id}>
            {product.version ? `${product.name} (${product.version})` : product.name}
          </option>
        ))}
      </Select>
      <Input
        label="Qty"
        type="number"
        min={1}
        value={addOn.quantity}
        onChange={(e) => update({ quantity: Math.max(1, Number(e.target.value) || 1) })}
      />
      <Input
        label="Unit price"
        type="number"
        step="0.01"
        min={0}
        value={addOn.unitPrice}
        onChange={(e) => update({ unitPrice: Number(e.target.value) || 0 })}
      />
      <Input
        label="Description"
        value={addOn.description}
        onChange={(e) => update({ description: e.target.value })}
        placeholder="Optional"
      />
      <div className="flex items-end">
        <Button variant="ghost" onClick={remove}>
          Remove
        </Button>
      </div>
      </div>
      <div className="mt-2">{discountControls(addOn, update, addOn.unitPrice)}</div>
      <p className="mt-2 text-right text-sm font-medium text-slate-700">
        Line total:{" "}
        {formatMoney(
          lineExtendedTotal(
            addOn.quantity,
            addOn.unitPrice,
            addOn.discountType,
            addOn.discountValue,
          ),
          values.currency,
        )}
      </p>
    </>
  );

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending) submit();
      }}
    >
      <Card>
        <h2 className="mb-4 text-base font-semibold text-slate-900">Deal details</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Deal date"
            type="date"
            value={values.dealDate}
            onChange={(e) => set("dealDate", e.target.value)}
            required
          />
          <Input
            label="Sales rep"
            value={values.salesRep}
            onChange={(e) => set("salesRep", e.target.value)}
          />
          <Select
            label="Market"
            value={values.market}
            onChange={(e) => {
              const market = e.target.value;
              setValues((prev) => ({ ...prev, market }));
              setEstimatedUsTax(null);
              setEstimateError(null);
              if (market) void changeCurrency(currencyForMarket(market));
            }}
          >
            <option value="">Select market…</option>
            {/* Legacy markets outside the fixed list stay selectable. */}
            {values.market && !MARKET_OPTIONS.includes(values.market as never) && (
              <option value={values.market}>{values.market}</option>
            )}
            {MARKET_OPTIONS.map((market) => (
              <option key={market} value={market}>
                {market}
              </option>
            ))}
          </Select>
          <Select
            label="Socket type"
            value={values.socketType}
            onChange={(e) => set("socketType", e.target.value)}
          >
            <option value="">Select socket type…</option>
            {values.socketType &&
              !SOCKET_TYPE_OPTIONS.includes(values.socketType as (typeof SOCKET_TYPE_OPTIONS)[number]) && (
                <option value={values.socketType}>{values.socketType}</option>
              )}
            {SOCKET_TYPE_OPTIONS.map((socket) => (
              <option key={socket} value={socket}>
                {socket}
              </option>
            ))}
          </Select>
          <Select
            label="Client type"
            value={values.clientType}
            onChange={(e) => set("clientType", e.target.value as QuoteFormValues["clientType"])}
          >
            {Object.entries(CLIENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            label="Payment terms"
            value={values.paymentTerms}
            onChange={(e) => set("paymentTerms", e.target.value as QuoteFormValues["paymentTerms"])}
          >
            {PAYMENT_TERMS_FORM_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {PAYMENT_TERMS_LABELS[value]}
              </option>
            ))}
          </Select>
          <Input
            label="Target delivery"
            type="date"
            value={values.targetDeliveryDate}
            onChange={(e) => set("targetDeliveryDate", e.target.value)}
          />
          <Select
            label="Delivery type"
            value={values.deliveryType}
            onChange={(e) =>
              set("deliveryType", e.target.value as QuoteFormValues["deliveryType"])
            }
            required
          >
            <option value="" disabled>
              Select delivery type…
            </option>
            {values.deliveryType &&
              !DELIVERY_TYPE_OPTIONS.includes(
                values.deliveryType as (typeof DELIVERY_TYPE_OPTIONS)[number],
              ) && <option value={values.deliveryType}>{values.deliveryType}</option>}
            {DELIVERY_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {DELIVERY_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
          <div className="sm:col-span-2">
            <Textarea
              label="Deal Notes"
              rows={4}
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Internal notes, delivery expectations, special requests…"
            />
          </div>
          <Textarea
            label="Assembly address"
            rows={4}
            value={values.assemblyAddress}
            onChange={(e) => set("assemblyAddress", e.target.value)}
            placeholder="Where the booths get installed"
          />
          <div className="space-y-3">
            <Input
              label="Client PO"
              value={values.clientPo}
              onChange={(e) => set("clientPo", e.target.value)}
              placeholder="Customer purchase order"
            />
            <Input
              label="Actual Client"
              value={values.actualClient}
              onChange={(e) => set("actualClient", e.target.value)}
              placeholder="End customer if billed via agency"
            />
          </div>
          {isUsMarket(values.market) && (
            <div className="sm:col-span-2 lg:col-span-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">US ship-to address</p>
              <p className="text-xs text-slate-600">
                Required for Zamp sales tax calculation (rooftop-accurate rates).
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Address line 1"
                  value={values.shipToLine1}
                  onChange={(e) => {
                    set("shipToLine1", e.target.value);
                    setEstimatedUsTax(null);
                  }}
                  required
                />
                <Input
                  label="Address line 2"
                  value={values.shipToLine2}
                  onChange={(e) => set("shipToLine2", e.target.value)}
                  placeholder="Optional"
                />
                <Input
                  label="City"
                  value={values.shipToCity}
                  onChange={(e) => {
                    set("shipToCity", e.target.value);
                    setEstimatedUsTax(null);
                  }}
                  required
                />
                <Input
                  label="ZIP code"
                  value={values.shipToZip}
                  onChange={(e) => {
                    const zip = e.target.value;
                    set("shipToZip", zip);
                    setEstimatedUsTax(null);
                    const inferred = stateFromZip(zip);
                    if (inferred) set("usState", inferred);
                  }}
                  required
                />
                <Select
                  label="State"
                  value={values.usState}
                  onChange={(e) => {
                    set("usState", e.target.value);
                    setEstimatedUsTax(null);
                  }}
                  required
                >
                  <option value="">Select state…</option>
                  {values.usState &&
                    !US_STATES.some((state) => state.code === values.usState) && (
                      <option value={values.usState}>{values.usState}</option>
                    )}
                  {US_STATES.map((state) => (
                    <option key={state.code} value={state.code}>
                      {state.code} — {state.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-base font-semibold text-slate-900">Client</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-1">
            <ClientNameAutocomplete
              clients={clientNameOptions}
              value={values.clientName}
              clientId={values.clientId}
              required
              onChangeName={(clientName, clientId) =>
                setValues((prev) => ({ ...prev, clientName, clientId }))
              }
              onSelectClient={pickClient}
            />
          </div>
          <VatNumberField
            value={values.vatNumber}
            onChange={(value) => set("vatNumber", value)}
          />
          <div className="flex items-end pb-1">
            <button
              type="button"
              onClick={() => set("isVip", !values.isVip)}
              aria-pressed={values.isVip}
              title={values.isVip ? "Click to remove the VIP label" : "Click to mark as VIP"}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                values.isVip
                  ? "bg-gradient-to-r from-amber-200 via-yellow-100 to-emerald-200 text-emerald-900 ring-1 ring-amber-400/60 shadow-sm"
                  : "border border-slate-300 bg-white text-slate-500 hover:border-amber-300 hover:text-amber-700"
              }`}
            >
              ★ VIP client
            </button>
          </div>
          <Input
            label="URL"
            type="url"
            value={values.website}
            onChange={(e) => set("website", e.target.value)}
            placeholder="https://example.com"
          />
          <div className="sm:col-span-2 lg:col-span-3">
            <Textarea
              label="Registered address (invoicing)"
              rows={2}
              value={values.registeredAddress}
              onChange={(e) => set("registeredAddress", e.target.value)}
            />
          </div>
        </div>

        <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-900">Contacts</h3>
        <div className="space-y-3">
          {values.contacts.map((contact, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[repeat(5,1fr)_auto]"
            >
              <Select
                aria-label="Contact type"
                value={contact.kind}
                onChange={(e) => setContact(index, { kind: e.target.value as ContactDraft["kind"] })}
              >
                {Object.entries(CONTACT_KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <Input
                placeholder="Name"
                value={contact.name}
                onChange={(e) => setContact(index, { name: e.target.value })}
              />
              <Input
                placeholder="Email"
                type="email"
                value={contact.email}
                onChange={(e) => setContact(index, { email: e.target.value })}
              />
              <Input
                placeholder="Phone"
                value={contact.phone}
                onChange={(e) => setContact(index, { phone: e.target.value })}
              />
              <Input
                placeholder="Role"
                value={contact.role}
                onChange={(e) => setContact(index, { role: e.target.value })}
              />
              <Button
                variant="ghost"
                onClick={() =>
                  setValues((prev) => ({
                    ...prev,
                    contacts: prev.contacts.filter((_, i) => i !== index),
                  }))
                }
                disabled={values.contacts.length === 1}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Button
            variant="secondary"
            onClick={() =>
              setValues((prev) => ({ ...prev, contacts: [...prev.contacts, { ...EMPTY_CONTACT }] }))
            }
          >
            Add contact
          </Button>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold text-slate-900">Line items</h2>
            <div className="flex flex-wrap gap-1.5">
              {QUOTE_CURRENCIES.map((currency) => (
                <button
                  key={currency}
                  type="button"
                  onClick={() => void changeCurrency(currency)}
                  aria-pressed={values.currency === currency}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                    values.currency === currency
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {currency}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={addLineItem}
              disabled={availableBoothProducts.length === 0}
            >
              Products
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                const draft = newAddOnDraft();
                if (!draft) return;
                setValues((prev) => ({
                  ...prev,
                  standaloneAddOns: [...prev.standaloneAddOns, draft],
                }));
              }}
              disabled={availableAddOnProducts.length === 0}
            >
              Add-ons
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                setValues((prev) => ({
                  ...prev,
                  customLines: [
                    ...prev.customLines,
                    { name: "", quantity: 1, unitPrice: 0, description: "", ...EMPTY_DISCOUNT },
                  ],
                }))
              }
            >
              Free text
            </Button>
          </div>
        </div>

        {availableBoothProducts.length === 0 && boothProducts.length > 0 && values.market && (
          <p className="text-sm text-amber-700">
            No products match this market and client type. Change deal details or update product
            availability.
          </p>
        )}

        {boothProducts.length === 0 && (
          <p className="text-sm text-amber-700">
            No active products in the catalog. Add products first.
          </p>
        )}

        {values.lineItems.length === 0 &&
        values.standaloneAddOns.length === 0 &&
        values.customLines.length === 0 ? (
          <p className="text-sm text-slate-500">No line items yet.</p>
        ) : (
          <div className="space-y-3">
            {values.lineItems.map((item, index) => (
              <div key={index} className="rounded-lg border border-slate-200 p-3">
                <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1.5fr_auto]">
                  <Select
                    label="Product"
                    value={item.productId}
                    onChange={(e) => {
                      const product = availableBoothProducts.find((p) => p.id === e.target.value);
                      setLineItem(index, {
                        productId: e.target.value,
                        unitPrice: product ? catalogUnitPrice(product) : item.unitPrice,
                      });
                    }}
                  >
                    {availableBoothProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.version ? `${product.name} (${product.version})` : product.name}
                      </option>
                    ))}
                  </Select>
                  <Input
                    label="Qty"
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) =>
                      setLineItem(index, { quantity: Math.max(1, Number(e.target.value) || 1) })
                    }
                  />
                  <Input
                    label="Unit price"
                    type="number"
                    step="0.01"
                    min={0}
                    value={item.unitPrice}
                    onChange={(e) => setLineItem(index, { unitPrice: Number(e.target.value) || 0 })}
                  />
                  <Select
                    label="Finish"
                    value={item.finish}
                    onChange={(e) =>
                      setLineItem(index, { finish: e.target.value as LineItemDraft["finish"] })
                    }
                  >
                    {Object.entries(FINISH_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                  <div className="flex items-end">
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setValues((prev) => ({
                          ...prev,
                          lineItems: prev.lineItems.filter((_, i) => i !== index),
                        }))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Input
                    label="Finish details"
                    value={item.finishDetails}
                    onChange={(e) => setLineItem(index, { finishDetails: e.target.value })}
                    placeholder="e.g. RAL 7016"
                  />
                  <Input
                    label="Description override"
                    value={item.description}
                    onChange={(e) => setLineItem(index, { description: e.target.value })}
                    placeholder="Optional — shown on the quote PDF"
                  />
                </div>
                <div className="mt-2">{discountControls(item, (patch) => setLineItem(index, patch), item.unitPrice)}</div>

                {item.addOns.length > 0 && (
                  <div className="mt-3 space-y-2 border-l-2 border-brand-100 pl-3">
                    {item.addOns.map((addOn, addOnIndex) => (
                      <div key={addOnIndex} className="rounded-lg bg-slate-50 p-3">
                        {addOnFields(
                          addOn,
                          (patch) => setAttachedAddOn(index, addOnIndex, patch),
                          () =>
                            setValues((prev) => ({
                              ...prev,
                              lineItems: prev.lineItems.map((li, i) =>
                                i === index
                                  ? { ...li, addOns: li.addOns.filter((_, j) => j !== addOnIndex) }
                                  : li,
                              ),
                            })),
                          addOnsForBooth(item.productId, addOn.productId),
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const draft = newAddOnDraft(addOnsForBooth(item.productId));
                      if (!draft) return;
                      setLineItem(index, { addOns: [...item.addOns, draft] });
                    }}
                    disabled={addOnsForBooth(item.productId).length === 0}
                  >
                    + Attach add-on
                  </Button>
                  <p className="text-right text-sm font-medium text-slate-700">
                    {formatMoney(
                      lineItemExtendedTotal(item) +
                        item.addOns.reduce((sum, addOn) => sum + lineItemExtendedTotal(addOn), 0),
                      values.currency,
                    )}
                  </p>
                </div>
              </div>
            ))}

            {values.standaloneAddOns.map((addOn, index) => (
              <div key={`standalone-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Standalone add-on
                </p>
                {addOnFields(
                  addOn,
                  (patch) => setStandaloneAddOn(index, patch),
                  () =>
                    setValues((prev) => ({
                      ...prev,
                      standaloneAddOns: prev.standaloneAddOns.filter((_, i) => i !== index),
                    })),
                )}
              </div>
            ))}

            {values.customLines.map((custom, index) => (
              <div
                key={`custom-${index}`}
                className="rounded-lg border border-dashed border-slate-300 p-3"
              >
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Custom line
                </p>
                <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1.5fr_auto]">
                  <Input
                    label="Item"
                    value={custom.name}
                    onChange={(e) => setCustomLine(index, { name: e.target.value })}
                    placeholder="e.g. Crane hire, extra shipping…"
                    required
                  />
                  <Input
                    label="Qty"
                    type="number"
                    min={1}
                    value={custom.quantity}
                    onChange={(e) =>
                      setCustomLine(index, { quantity: Math.max(1, Number(e.target.value) || 1) })
                    }
                  />
                  <Input
                    label="Unit price"
                    type="number"
                    step="0.01"
                    min={0}
                    value={custom.unitPrice}
                    onChange={(e) => setCustomLine(index, { unitPrice: Number(e.target.value) || 0 })}
                  />
                  <Input
                    label="Description"
                    value={custom.description}
                    onChange={(e) => setCustomLine(index, { description: e.target.value })}
                    placeholder="Optional — shown on the quote PDF"
                  />
                  <div className="flex items-end">
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setValues((prev) => ({
                          ...prev,
                          customLines: prev.customLines.filter((_, i) => i !== index),
                        }))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
                <div className="mt-2">
                  {discountControls(custom, (patch) => setCustomLine(index, patch), custom.unitPrice)}
                </div>
                <p className="mt-2 text-right text-sm font-medium text-slate-700">
                  Line total: {formatMoney(lineItemExtendedTotal(custom), values.currency)}
                </p>
              </div>
            ))}

            <QuoteTotals
              subtotal={total}
              market={values.market}
              currency={values.currency}
              estimatedUsTax={estimatedUsTax}
              onEstimateTax={isUsMarket(values.market) ? estimateUsTax : undefined}
              estimatingTax={estimatingTax}
              estimateError={estimateError}
            />
          </div>
        )}

        {availableAddOnProducts.length === 0 && addOnProducts.length > 0 && values.market && (
          <p className="mt-3 text-xs text-amber-700">
            No add-ons match this market and client type.
          </p>
        )}

        {addOnProducts.length === 0 && (
          <p className="mt-3 text-xs text-slate-500">
            No add-on products yet — create products with the “Add-on” kind to attach extras like
            warranties or chairs.
          </p>
        )}
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : quoteId ? "Save changes" : "Create quote"}
        </Button>
        <Button variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
