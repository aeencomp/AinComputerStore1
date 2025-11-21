import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'ar' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  isRTL: boolean;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations: Record<Language, Record<string, string>> = {
  ar: {
    // Header
    'header.title': 'العين لتجارة الحاسبات',
    'header.home': 'الرئيسية',
    'header.categories': 'الفئات',
    'header.cart': 'السلة',
    'header.login': 'تسجيل الدخول',
    'header.profile': 'الملف الشخصي',
    'header.logout': 'تسجيل الخروج',
    
    // Categories
    'category.all': 'جميع المنتجات',
    'category.laptops': 'أجهزة لابتوب',
    'category.desktops': 'أجهزة مكتبية',
    'category.monitors': 'شاشات',
    'category.accessories': 'ملحقات',
    
    // Home page
    'home.hero.title': 'أفضل أجهزة الحاسوب والملحقات',
    'home.hero.subtitle': 'اكتشف أحدث التقنيات بأفضل الأسعار',
    'home.hero.cta': 'تسوق الآن',
    'home.categories.title': 'تصفح حسب الفئة',
    'home.featured.title': 'المنتجات المميزة',
    
    // Product
    'product.specifications': 'المواصفات',
    'product.addToCart': 'أضف إلى السلة',
    'product.inStock': 'متوفر في المخزون',
    'product.outOfStock': 'غير متوفر',
    'product.loading': 'جاري التحميل...',
    'product.notFound': 'المنتج غير موجود',
    
    // Cart
    'cart.title': 'سلة التسوق',
    'cart.empty': 'سلة التسوق فارغة',
    'cart.continueShopping': 'متابعة التسوق',
    'cart.remove': 'إزالة',
    'cart.subtotal': 'المجموع الفرعي',
    'cart.shipping': 'الشحن',
    'cart.total': 'المجموع الكلي',
    'cart.checkout': 'إتمام الطلب',
    'cart.free': 'مجاني',
    'cart.quantity': 'الكمية',
    
    // Checkout
    'checkout.title': 'إتمام الطلب',
    'checkout.customerInfo': 'معلومات العميل',
    'checkout.name': 'الاسم الكامل',
    'checkout.email': 'البريد الإلكتروني',
    'checkout.phone': 'رقم الهاتف',
    'checkout.address': 'العنوان',
    'checkout.city': 'المدينة',
    'checkout.postal': 'الرمز البريدي',
    'checkout.payment': 'طريقة الدفع',
    'checkout.cashOnDelivery': 'الدفع عند الاستلام',
    'checkout.placeOrder': 'تأكيد الطلب',
    'checkout.processing': 'جاري المعالجة...',
    'checkout.loginRequired': 'يرجى تسجيل الدخول لإتمام الطلب',
    
    // Login
    'login.title': 'تسجيل الدخول',
    'login.email': 'البريد الإلكتروني',
    'login.password': 'كلمة المرور',
    'login.submit': 'تسجيل الدخول',
    'login.noAccount': 'ليس لديك حساب؟',
    'login.register': 'إنشاء حساب',
    'login.loggingIn': 'جاري تسجيل الدخول...',
    
    // Register
    'register.title': 'إنشاء حساب جديد',
    'register.name': 'الاسم الكامل',
    'register.email': 'البريد الإلكتروني',
    'register.phone': 'رقم الهاتف',
    'register.password': 'كلمة المرور',
    'register.submit': 'إنشاء حساب',
    'register.hasAccount': 'لديك حساب بالفعل؟',
    'register.login': 'تسجيل الدخول',
    'register.registering': 'جاري إنشاء الحساب...',
    
    // Admin
    'admin.login.title': 'تسجيل دخول المسؤول',
    'admin.login.password': 'كلمة المرور',
    'admin.login.submit': 'تسجيل الدخول',
    'admin.dashboard.title': 'لوحة التحكم',
    'admin.dashboard.orders': 'الطلبات',
    'admin.dashboard.orderNumber': 'رقم الطلب',
    'admin.dashboard.customer': 'العميل',
    'admin.dashboard.total': 'المجموع',
    'admin.dashboard.status': 'الحالة',
    'admin.dashboard.date': 'التاريخ',
    'admin.dashboard.logout': 'تسجيل الخروج',
    'admin.dashboard.pending': 'قيد الانتظار',
    'admin.dashboard.processing': 'قيد المعالجة',
    'admin.dashboard.shipped': 'تم الشحن',
    'admin.dashboard.delivered': 'تم التوصيل',
    
    // Common
    'common.currency': 'د.ع',
    'common.loading': 'جاري التحميل...',
    'common.error': 'حدث خطأ',
    'common.success': 'تم بنجاح',
  },
  en: {
    // Header
    'header.title': 'Al-Ain Computer Trading',
    'header.home': 'Home',
    'header.categories': 'Categories',
    'header.cart': 'Cart',
    'header.login': 'Login',
    'header.profile': 'Profile',
    'header.logout': 'Logout',
    
    // Categories
    'category.all': 'All Products',
    'category.laptops': 'Laptops',
    'category.desktops': 'Desktops',
    'category.monitors': 'Monitors',
    'category.accessories': 'Accessories',
    
    // Home page
    'home.hero.title': 'Best Computers & Accessories',
    'home.hero.subtitle': 'Discover the latest technology at the best prices',
    'home.hero.cta': 'Shop Now',
    'home.categories.title': 'Browse by Category',
    'home.featured.title': 'Featured Products',
    
    // Product
    'product.specifications': 'Specifications',
    'product.addToCart': 'Add to Cart',
    'product.inStock': 'In Stock',
    'product.outOfStock': 'Out of Stock',
    'product.loading': 'Loading...',
    'product.notFound': 'Product not found',
    
    // Cart
    'cart.title': 'Shopping Cart',
    'cart.empty': 'Your cart is empty',
    'cart.continueShopping': 'Continue Shopping',
    'cart.remove': 'Remove',
    'cart.subtotal': 'Subtotal',
    'cart.shipping': 'Shipping',
    'cart.total': 'Total',
    'cart.checkout': 'Checkout',
    'cart.free': 'Free',
    'cart.quantity': 'Quantity',
    
    // Checkout
    'checkout.title': 'Checkout',
    'checkout.customerInfo': 'Customer Information',
    'checkout.name': 'Full Name',
    'checkout.email': 'Email',
    'checkout.phone': 'Phone Number',
    'checkout.address': 'Address',
    'checkout.city': 'City',
    'checkout.postal': 'Postal Code',
    'checkout.payment': 'Payment Method',
    'checkout.cashOnDelivery': 'Cash on Delivery',
    'checkout.placeOrder': 'Place Order',
    'checkout.processing': 'Processing...',
    'checkout.loginRequired': 'Please login to complete your order',
    
    // Login
    'login.title': 'Login',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.submit': 'Login',
    'login.noAccount': "Don't have an account?",
    'login.register': 'Create Account',
    'login.loggingIn': 'Logging in...',
    
    // Register
    'register.title': 'Create New Account',
    'register.name': 'Full Name',
    'register.email': 'Email',
    'register.phone': 'Phone Number',
    'register.password': 'Password',
    'register.submit': 'Create Account',
    'register.hasAccount': 'Already have an account?',
    'register.login': 'Login',
    'register.registering': 'Creating account...',
    
    // Admin
    'admin.login.title': 'Admin Login',
    'admin.login.password': 'Password',
    'admin.login.submit': 'Login',
    'admin.dashboard.title': 'Dashboard',
    'admin.dashboard.orders': 'Orders',
    'admin.dashboard.orderNumber': 'Order #',
    'admin.dashboard.customer': 'Customer',
    'admin.dashboard.total': 'Total',
    'admin.dashboard.status': 'Status',
    'admin.dashboard.date': 'Date',
    'admin.dashboard.logout': 'Logout',
    'admin.dashboard.pending': 'Pending',
    'admin.dashboard.processing': 'Processing',
    'admin.dashboard.shipped': 'Shipped',
    'admin.dashboard.delivered': 'Delivered',
    
    // Common
    'common.currency': 'IQD',
    'common.loading': 'Loading...',
    'common.error': 'An error occurred',
    'common.success': 'Success',
  },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved === 'en' || saved === 'ar') ? saved : 'ar';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  const isRTL = language === 'ar';

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isRTL, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
