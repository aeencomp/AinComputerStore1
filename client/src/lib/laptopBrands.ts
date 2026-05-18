/** Laptop / notebook brands used across inventory and repair forms */
export const LAPTOP_BRANDS = [
  "Apple",
  "Dell",
  "HP",
  "Lenovo",
  "Asus",
  "Acer",
  "Sony",
  "Samsung",
  "Toshiba",
  "MSI",
  "Razer",
  "Huawei",
  "Microsoft",
  "LG",
  "Gigabyte",
  "Fujitsu",
  "Panasonic",
  "Google",
  "Honor",
  "Xiaomi",
  "Chuwi",
  "Clevo",
  "Framework",
  "OEM",
  "Universal",
  "Other",
] as const;

export type LaptopBrand = (typeof LAPTOP_BRANDS)[number];

/** Build select options, keeping saved values that are not in the default list */
export function getLaptopBrandOptions(
  currentValue?: string,
  extras: string[] = [],
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  const add = (b: string) => {
    const t = b.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    ordered.push(t);
  };

  for (const b of LAPTOP_BRANDS) add(b);
  for (const b of extras) add(b);
  if (currentValue) add(currentValue);

  return ordered;
}
