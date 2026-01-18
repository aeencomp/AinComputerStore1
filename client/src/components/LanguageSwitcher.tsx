import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface LanguageSwitcherProps {
  variant?: "ghost" | "outline" | "default";
  size?: "icon" | "sm" | "default";
  showLabel?: boolean;
  className?: string;
}

export function LanguageSwitcher({ 
  variant = "ghost", 
  size = "icon",
  showLabel = false,
  className = ""
}: LanguageSwitcherProps) {
  const { language, setLanguage } = useLanguage();
  
  const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  if (showLabel) {
    return (
      <Button
        variant={variant}
        size="sm"
        onClick={toggleLanguage}
        className={`gap-2 ${className}`}
        data-testid="button-language-switch"
      >
        <Languages className="h-4 w-4" />
        <span>{language === 'ar' ? 'English' : 'عربي'}</span>
      </Button>
    );
  }

  return (
    <Button
      size={size}
      variant={variant}
      onClick={toggleLanguage}
      className={className}
      data-testid="button-language-switch"
    >
      <Languages className="h-5 w-5" />
    </Button>
  );
}
