import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLaptopBrandOptions } from "@/lib/laptopBrands";

interface BrandSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  testId?: string;
  className?: string;
  disabled?: boolean;
  extras?: string[];
}

export function BrandSelect({
  value,
  onValueChange,
  testId,
  className,
  disabled,
  extras,
}: BrandSelectProps) {
  const { language } = useLanguage();
  const options = getLaptopBrandOptions(value, extras);

  return (
    <Select
      value={value || undefined}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectTrigger data-testid={testId} className={className}>
        <SelectValue
          placeholder={language === "ar" ? "اختر الماركة" : "Select brand"}
        />
      </SelectTrigger>
      <SelectContent>
        {options.map((brand) => (
          <SelectItem key={brand} value={brand}>
            {brand}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
