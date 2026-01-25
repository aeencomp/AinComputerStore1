export const categoryNames: Record<string, { ar: string; en: string }> = {
  // Laptops
  'laptops': { ar: 'لابتوبات', en: 'Laptops' },
  'gaming-laptops': { ar: 'لابتوب ألعاب', en: 'Gaming Laptops' },
  'business-laptops': { ar: 'لابتوب أعمال', en: 'Business Laptops' },
  'student-laptops': { ar: 'لابتوب طلاب', en: 'Student Laptops' },
  'ultrabooks': { ar: 'ألترابوك', en: 'Ultrabooks' },
  'workstation-laptops': { ar: 'محطات عمل محمولة', en: 'Workstation Laptops' },
  
  // Desktops
  'desktops': { ar: 'أجهزة مكتبية', en: 'Desktops' },
  'gaming-pcs': { ar: 'أجهزة ألعاب', en: 'Gaming PCs' },
  'office-pcs': { ar: 'أجهزة مكتبية', en: 'Office PCs' },
  'workstations': { ar: 'محطات عمل', en: 'Workstations' },
  'all-in-one': { ar: 'الكل في واحد', en: 'All-in-One PCs' },
  'mini-pcs': { ar: 'أجهزة صغيرة', en: 'Mini PCs' },
  
  // Monitors
  'monitors': { ar: 'شاشات', en: 'Monitors' },
  'gaming-monitors': { ar: 'شاشات ألعاب', en: 'Gaming Monitors' },
  'office-monitors': { ar: 'شاشات مكتبية', en: 'Office Monitors' },
  'curved-monitors': { ar: 'شاشات منحنية', en: 'Curved Monitors' },
  '4k-monitors': { ar: 'شاشات 4K', en: '4K/UHD Monitors' },
  'ultrawide-monitors': { ar: 'شاشات عريضة', en: 'Ultrawide Monitors' },
  
  // Accessories
  'accessories': { ar: 'إكسسوارات', en: 'Accessories' },
  'keyboards': { ar: 'لوحات المفاتيح', en: 'Keyboards' },
  'mice': { ar: 'الماوسات', en: 'Mice' },
  'headphones': { ar: 'سماعات', en: 'Headphones' },
  'webcams': { ar: 'كاميرات ويب', en: 'Webcams' },
  'cables': { ar: 'كابلات وموزعات', en: 'Cables & Hubs' },
  'bags': { ar: 'حقائب لابتوب', en: 'Laptop Bags' },
  'chargers': { ar: 'شواحن ومحولات', en: 'Chargers & Adapters' },
  'miscellaneous': { ar: 'منوعات', en: 'Miscellaneous' },
  
  // Printers
  'printers': { ar: 'الطابعات', en: 'Printers' },
  'laser-printers': { ar: 'طابعات ليزر', en: 'Laser Printers' },
  'inkjet-printers': { ar: 'طابعات حبر', en: 'Inkjet Printers' },
  'printer-accessories': { ar: 'ملحقات الطابعات', en: 'Printer Accessories' },
  
  // PC Components
  'pc-components': { ar: 'قطع الكمبيوتر', en: 'PC Components' },
  'ram': { ar: 'ذاكرة RAM', en: 'RAM Memory' },
  'ssd': { ar: 'أقراص SSD', en: 'SSD Drives' },
  'hdd': { ar: 'أقراص HDD', en: 'HDD Drives' },
  'processors': { ar: 'المعالجات', en: 'Processors' },
  'motherboards': { ar: 'اللوحات الأم', en: 'Motherboards' },
  'gpu': { ar: 'كروت الشاشة', en: 'Graphics Cards' },
  'psu': { ar: 'مزودات الطاقة', en: 'Power Supplies' },
  'cases': { ar: 'صناديق الكمبيوتر', en: 'PC Cases' },
  'cooling': { ar: 'أنظمة التبريد', en: 'Cooling Systems' },
  
  // Software
  'programs': { ar: 'البرامج', en: 'Software' },
  'operating-systems': { ar: 'أنظمة التشغيل', en: 'Operating Systems' },
  'office-software': { ar: 'برامج المكتب', en: 'Office Software' },
  'antivirus': { ar: 'مضادات الفيروسات', en: 'Antivirus' },
  'design-software': { ar: 'برامج التصميم', en: 'Design Software' },
  'gaming-software': { ar: 'برامج الألعاب', en: 'Gaming Software' },
};

export function getCategoryName(slug: string, language: 'ar' | 'en'): string {
  const category = categoryNames[slug];
  if (category) {
    return category[language];
  }
  return slug;
}
