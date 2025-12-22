import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface BarcodeProps {
  value: string;
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  format?: string;
  background?: string;
  lineColor?: string;
}

export default function Barcode({
  value,
  width = 1.5,
  height = 40,
  displayValue = true,
  fontSize = 12,
  format = "CODE128",
  background = "#ffffff",
  lineColor = "#000000",
}: BarcodeProps) {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (barcodeRef.current && value) {
      try {
        JsBarcode(barcodeRef.current, value, {
          format,
          width,
          height,
          displayValue,
          fontSize,
          background,
          lineColor,
          margin: 5,
          textMargin: 2,
        });
      } catch (error) {
        console.error("Barcode generation error:", error);
      }
    }
  }, [value, width, height, displayValue, fontSize, format, background, lineColor]);

  if (!value) return null;

  return <svg ref={barcodeRef} data-testid={`barcode-${value}`} />;
}
