/**
 * Shared locale-aware formatting utilities for the application
 */

type Language = 'ar' | 'en';

/**
 * Formats a price according to the specified language locale
 * @param price - The price to format (number or string)
 * @param language - The language locale ('ar' for Arabic, 'en' for English)
 * @returns Formatted price string with Western numerals (always English numbers)
 */
export function formatPrice(price: string | number, language: Language): string {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  
  // Always use Western numerals (English) for prices, regardless of language
  return numPrice.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Formats a number (e.g., quantity) according to the specified language locale
 * @param num - The number to format
 * @param language - The language locale ('ar' for Arabic, 'en' for English)
 * @returns Formatted number string with proper numeral system
 */
export function formatNumber(num: number, language: Language): string {
  const locale = language === 'ar' ? 'ar-IQ' : 'en-IQ';
  return num.toLocaleString(locale);
}

/**
 * Gets the currency symbol based on language
 * @param language - The language locale ('ar' for Arabic, 'en' for English)
 * @returns Currency symbol string
 */
export function getCurrencySymbol(language: Language): string {
  return language === 'ar' ? 'د.ع' : 'IQD';
}
