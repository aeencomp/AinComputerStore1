import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { InStoreProductSpecs, InStoreProductType } from "@shared/inStoreProductTypes";
import { productTypeLabel } from "@shared/inStoreProductTypes";

type Props = {
  productType: InStoreProductType;
  specs: InStoreProductSpecs;
  onSpecsChange: (specs: InStoreProductSpecs) => void;
  language: "ar" | "en";
  readOnly?: boolean;
};

function Field({
  id,
  label,
  value,
  onChange,
  readOnly,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function setSpec(specs: InStoreProductSpecs, key: string, value: unknown): InStoreProductSpecs {
  return { ...specs, [key]: value };
}

export function InStoreTypedProductFields({
  productType,
  specs,
  onSpecsChange,
  language,
  readOnly,
}: Props) {
  if (productType === "generic") return null;

  const ar = language === "ar";
  const s = (key: string) => (typeof specs[key] === "string" ? (specs[key] as string) : "");
  const n = (key: string) =>
    specs[key] == null || specs[key] === "" ? "" : String(specs[key]);

  const compatible = Array.isArray(specs.compatibleLaptops)
    ? (specs.compatibleLaptops as string[])
    : [];
  const newModel = typeof specs.newLaptop === "string" ? specs.newLaptop : "";

  const addCompat = () => {
    const trimmed = newModel.trim();
    if (!trimmed || compatible.includes(trimmed)) return;
    onSpecsChange({ ...specs, compatibleLaptops: [...compatible, trimmed], newLaptop: "" });
  };

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-3 bg-muted/30">
      <p className="text-sm font-medium text-muted-foreground">
        {ar ? "مواصفات" : "Specs"} — {productTypeLabel(productType, language)}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field
          id="spec-serial"
          label={ar ? "الرقم التسلسلي / ADP" : "Serial / SKU"}
          value={s("serialNumber")}
          readOnly={readOnly}
          onChange={(v) => onSpecsChange(setSpec(specs, "serialNumber", v))}
        />
        <Field
          id="spec-brand"
          label={ar ? "الماركة" : "Brand"}
          value={s("brand")}
          readOnly={readOnly}
          onChange={(v) => onSpecsChange(setSpec(specs, "brand", v))}
        />
        {(productType === "adapter" || productType === "battery") && (
          <>
            <Field
              id="spec-barcode"
              label={ar ? "الباركود" : "Barcode"}
              value={s("barcode")}
              readOnly={readOnly}
              onChange={(v) => onSpecsChange(setSpec(specs, "barcode", v))}
            />
            <Field
              id="spec-wattage"
              label={ar ? "الواط (شاحن)" : "Wattage"}
              value={n("wattage")}
              type="number"
              readOnly={readOnly}
              onChange={(v) => onSpecsChange(setSpec(specs, "wattage", v ? parseInt(v, 10) : null))}
            />
          </>
        )}
        {(productType === "laptop" || productType === "desktop") && (
          <>
            <Field
              id="spec-model"
              label={ar ? "الموديل" : "Model"}
              value={s("model")}
              readOnly={readOnly}
              onChange={(v) => onSpecsChange(setSpec(specs, "model", v))}
            />
            <Field
              id="spec-cpu"
              label="CPU"
              value={s("cpu")}
              readOnly={readOnly}
              onChange={(v) => onSpecsChange(setSpec(specs, "cpu", v))}
            />
            <Field
              id="spec-ram"
              label="RAM"
              value={s("ram")}
              readOnly={readOnly}
              onChange={(v) => onSpecsChange(setSpec(specs, "ram", v))}
            />
            <Field
              id="spec-storage"
              label={ar ? "التخزين" : "Storage"}
              value={s("storage")}
              readOnly={readOnly}
              onChange={(v) => onSpecsChange(setSpec(specs, "storage", v))}
            />
          </>
        )}
        {productType === "keyboard" && (
          <>
            <Field
              id="spec-layout"
              label={ar ? "التخطيط" : "Layout"}
              value={s("layout")}
              readOnly={readOnly}
              onChange={(v) => onSpecsChange(setSpec(specs, "layout", v))}
            />
            <Field
              id="spec-kbd-type"
              label={ar ? "النوع" : "Type"}
              value={s("keyboardType")}
              readOnly={readOnly}
              onChange={(v) => onSpecsChange(setSpec(specs, "keyboardType", v))}
            />
          </>
        )}
        {productType === "lcd" && (
          <>
            <Field
              id="spec-size"
              label={ar ? "الحجم (بوصة)" : "Size (inch)"}
              value={n("sizeInch")}
              readOnly={readOnly}
              onChange={(v) => onSpecsChange(setSpec(specs, "sizeInch", v))}
            />
            <Field
              id="spec-resolution"
              label={ar ? "الدقة" : "Resolution"}
              value={s("resolution")}
              readOnly={readOnly}
              onChange={(v) => onSpecsChange(setSpec(specs, "resolution", v))}
            />
          </>
        )}
      </div>

      {(productType === "adapter" || productType === "battery") && !readOnly && (
        <div className="space-y-2">
          <Label>{ar ? "أجهزة متوافقة" : "Compatible models"}</Label>
          <div className="flex gap-2">
            <Input
              value={newModel}
              placeholder={ar ? "موديل لابتوب" : "Laptop model"}
              onChange={(e) => onSpecsChange({ ...specs, newLaptop: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCompat())}
            />
            <Button type="button" variant="secondary" onClick={addCompat}>
              {ar ? "إضافة" : "Add"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {compatible.map((m, i) => (
              <span
                key={`${m}-${i}`}
                className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-xs"
              >
                {m}
                <button
                  type="button"
                  className="hover:text-destructive"
                  onClick={() =>
                    onSpecsChange({
                      ...specs,
                      compatibleLaptops: compatible.filter((_, j) => j !== i),
                    })
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export const PRODUCT_TYPE_OPTIONS: InStoreProductType[] = [
  "generic",
  "adapter",
  "battery",
  "laptop",
  "desktop",
  "keyboard",
  "lcd",
];
