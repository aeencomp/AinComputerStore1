import { QRCodeSVG } from "qrcode.react";

interface QRCodeProps {
  value: string;
  size?: number;
  bgColor?: string;
  fgColor?: string;
  level?: "L" | "M" | "Q" | "H";
}

export default function QRCode({
  value,
  size = 80,
  bgColor = "#ffffff",
  fgColor = "#000000",
  level = "M",
}: QRCodeProps) {
  if (!value) return null;

  return (
    <QRCodeSVG
      value={value}
      size={size}
      bgColor={bgColor}
      fgColor={fgColor}
      level={level}
      data-testid={`qrcode-${value}`}
    />
  );
}
