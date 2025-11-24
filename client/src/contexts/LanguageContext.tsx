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
    'header.searchPlaceholder': 'ابحث عن المنتجات...',
    
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
    'cart.description': 'إدارة منتجات سلة التسوق الخاصة بك',
    'cart.empty': 'سلة التسوق فارغة',
    'cart.continueShopping': 'متابعة التسوق',
    'cart.browsProducts': 'تصفح المنتجات',
    'cart.remove': 'إزالة',
    'cart.subtotal': 'المجموع الفرعي',
    'cart.shipping': 'الشحن',
    'cart.total': 'المجموع الكلي',
    'cart.checkout': 'إتمام الطلب',
    'cart.free': 'مجاني',
    'cart.quantity': 'الكمية',
    'cart.error': 'حدث خطأ أثناء تحميل السلة',
    'cart.retry': 'إعادة المحاولة',
    
    // Checkout
    'checkout.title': 'إتمام الطلب',
    'checkout.customerInfo': 'معلومات العميل',
    'checkout.name': 'الاسم الكامل',
    'checkout.namePlaceholder': 'أدخل الاسم الكامل',
    'checkout.email': 'البريد الإلكتروني',
    'checkout.emailPlaceholder': 'example@email.com',
    'checkout.phone': 'رقم الهاتف',
    'checkout.phonePlaceholder': '+٩٦٤...',
    'checkout.address': 'العنوان',
    'checkout.addressPlaceholder': 'أدخل عنوانك',
    'checkout.city': 'المدينة',
    'checkout.cityPlaceholder': 'بغداد',
    'checkout.postal': 'الرمز البريدي',
    'checkout.postalPlaceholder': '١٠٠٠١',
    'checkout.payment': 'طريقة الدفع',
    'checkout.cashOnDelivery': 'الدفع عند الاستلام',
    'checkout.placeOrder': 'تأكيد الطلب',
    'checkout.processing': 'جاري المعالجة...',
    'checkout.loginRequired': 'يرجى تسجيل الدخول لإتمام الطلب',
    
    // Login
    'login.title': 'تسجيل الدخول',
    'login.description': 'سجل دخولك للمتابعة في الشراء',
    'login.email': 'البريد الإلكتروني',
    'login.password': 'كلمة المرور',
    'login.submit': 'تسجيل الدخول',
    'login.noAccount': 'ليس لديك حساب؟',
    'login.register': 'إنشاء حساب',
    'login.loggingIn': 'جاري تسجيل الدخول...',
    'login.success.title': 'تم تسجيل الدخول بنجاح',
    'login.success.description': 'مرحباً بك مرة أخرى',
    'login.error.title': 'خطأ في تسجيل الدخول',
    'login.error.description': 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
    'login.backToHome': 'العودة للرئيسية',
    
    // Register
    'register.title': 'إنشاء حساب جديد',
    'register.description': 'أنشئ حسابك للبدء في التسوق',
    'register.name': 'الاسم الكامل',
    'register.email': 'البريد الإلكتروني',
    'register.phone': 'رقم الهاتف',
    'register.phonePlaceholder': '٠٧٩٠٠٠٠٠٠٠٠',
    'register.password': 'كلمة المرور',
    'register.passwordHint': 'يجب أن تكون 6 أحرف على الأقل',
    'register.submit': 'إنشاء حساب',
    'register.hasAccount': 'لديك حساب بالفعل؟',
    'register.login': 'تسجيل الدخول',
    'register.registering': 'جاري إنشاء الحساب...',
    'register.success.title': 'تم إنشاء الحساب بنجاح',
    'register.success.description': 'مرحباً بك في العين لتجارة الحاسبات',
    'register.error.title': 'خطأ في إنشاء الحساب',
    'register.error.description': 'حدث خطأ، يرجى المحاولة مرة أخرى',
    'register.backToHome': 'العودة للرئيسية',
    
    // Admin
    'admin.login.title': 'تسجيل دخول المسؤول',
    'admin.login.password': 'كلمة المرور',
    'admin.login.passwordPlaceholder': 'أدخل كلمة المرور',
    'admin.login.submit': 'تسجيل الدخول',
    'admin.dashboard.title': 'لوحة التحكم',
    'admin.dashboard.ordersTitle': 'إدارة الطلبات',
    'admin.dashboard.ordersCount': 'عدد الطلبات',
    'admin.dashboard.noOrders': 'لا توجد طلبات حالياً',
    'admin.dashboard.orders': 'الطلبات',
    'admin.dashboard.orderNumber': 'رقم الطلب',
    'admin.dashboard.customer': 'العميل',
    'admin.dashboard.email': 'البريد الإلكتروني',
    'admin.dashboard.phone': 'رقم الهاتف',
    'admin.dashboard.city': 'المدينة',
    'admin.dashboard.itemsCount': 'عدد العناصر',
    'admin.dashboard.item': 'عنصر',
    'admin.dashboard.total': 'المجموع',
    'admin.dashboard.status': 'الحالة',
    'admin.dashboard.date': 'التاريخ',
    'admin.dashboard.update': 'تحديث',
    'admin.dashboard.updating': 'جاري التحديث...',
    'admin.dashboard.logout': 'تسجيل الخروج',
    'admin.dashboard.pending': 'قيد الانتظار',
    'admin.dashboard.processing': 'قيد المعالجة',
    'admin.dashboard.shipped': 'تم الشحن',
    'admin.dashboard.delivered': 'تم التسليم',
    'admin.dashboard.cancelled': 'ملغاة',
    'admin.dashboard.updateSuccess': 'تم التحديث بنجاح',
    'admin.dashboard.updateSuccessDesc': 'تم تحديث حالة الطلب',
    'admin.dashboard.updateError': 'خطأ',
    'admin.dashboard.updateErrorDesc': 'فشل تحديث الطلب',
    'admin.dashboard.logoutSuccess': 'تسجيل الخروج',
    'admin.dashboard.logoutSuccessDesc': 'تم تسجيل خروجك بنجاح',
    
    // Admin Products
    'admin.products.title': 'إدارة المنتجات',
    'admin.products.addNew': 'إضافة منتج جديد',
    'admin.products.edit': 'تعديل',
    'admin.products.delete': 'حذف',
    'admin.products.confirmDelete': 'هل أنت متأكد من حذف هذا المنتج؟',
    'admin.products.nameAr': 'الاسم بالعربي',
    'admin.products.nameEn': 'الاسم بالإنجليزي',
    'admin.products.descAr': 'الوصف بالعربي',
    'admin.products.descEn': 'الوصف بالإنجليزي',
    'admin.products.price': 'السعر',
    'admin.products.oldPrice': 'السعر القديم',
    'admin.products.category': 'الفئة',
    'admin.products.image': 'رابط الصورة',
    'admin.products.badge': 'الشارة',
    'admin.products.inStock': 'متوفر',
    'admin.products.specs': 'المواصفات (سطر لكل مواصفة)',
    'admin.products.save': 'حفظ',
    'admin.products.cancel': 'إلغاء',
    'admin.products.creating': 'جاري الإنشاء...',
    'admin.products.updating': 'جاري التحديث...',
    'admin.products.deleting': 'جاري الحذف...',
    'admin.products.actions': 'الإجراءات',
    'admin.products.manageProducts': 'إدارة المنتجات',
    'admin.products.imagePlaceholder': 'product_image.png',
    
    // Admin Settings
    'admin.settings.title': 'إعدادات المتجر',
    'admin.settings.storeInfo': 'معلومات المتجر',
    'admin.settings.storeInfoDesc': 'قم بتحديث اسم المتجر ووصفه',
    'admin.settings.contactInfo': 'معلومات الاتصال',
    'admin.settings.contactInfoDesc': 'قم بتحديث البريد الإلكتروني والهاتف والموقع',
    'admin.settings.socialMedia': 'وسائل التواصل الاجتماعي',
    'admin.settings.socialMediaDesc': 'قم بإضافة روابط حساباتك على وسائل التواصل',
    'admin.settings.storeNameAr': 'اسم المتجر بالعربية',
    'admin.settings.storeNameEn': 'اسم المتجر بالإنجليزية',
    'admin.settings.descriptionAr': 'الوصف بالعربية',
    'admin.settings.descriptionEn': 'الوصف بالإنجليزية',
    'admin.settings.email': 'البريد الإلكتروني',
    'admin.settings.phone': 'رقم الهاتف',
    'admin.settings.phoneAr': 'رقم الهاتف بالعربية',
    'admin.settings.addressAr': 'العنوان بالعربية',
    'admin.settings.addressEn': 'العنوان بالإنجليزية',
    'admin.settings.hoursAr': 'ساعات العمل بالعربية',
    'admin.settings.hoursEn': 'ساعات العمل بالإنجليزية',
    'admin.settings.facebookUrl': 'رابط فيسبوك',
    'admin.settings.twitterUrl': 'رابط تويتر',
    'admin.settings.instagramUrl': 'رابط انستجرام',
    'admin.settings.save': 'حفظ الإعدادات',
    'admin.settings.successTitle': 'تم الحفظ',
    'admin.settings.successMessage': 'تم حفظ إعدادات المتجر بنجاح',
    'admin.settings.errorMessage': 'فشل حفظ الإعدادات',
    'admin.settings.manageSettings': 'إعدادات المتجر',
    
    // Categories
    'categories.laptops': 'أجهزة لابتوب',
    'categories.desktops': 'أجهزة مكتبية',
    'categories.monitors': 'شاشات',
    'categories.accessories': 'إكسسوارات',
    
    // Footer
    'footer.newsletterPlaceholder': 'بريدك الإلكتروني',
    
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
    'header.searchPlaceholder': 'Search for products...',
    
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
    'cart.description': 'Manage your shopping cart items',
    'cart.empty': 'Your cart is empty',
    'cart.continueShopping': 'Continue Shopping',
    'cart.browsProducts': 'Browse Products',
    'cart.remove': 'Remove',
    'cart.subtotal': 'Subtotal',
    'cart.shipping': 'Shipping',
    'cart.total': 'Total',
    'cart.checkout': 'Checkout',
    'cart.free': 'Free',
    'cart.quantity': 'Quantity',
    'cart.error': 'An error occurred while loading the cart',
    'cart.retry': 'Retry',
    
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
    'login.description': 'Login to continue shopping',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.submit': 'Login',
    'login.noAccount': "Don't have an account?",
    'login.register': 'Create Account',
    'login.loggingIn': 'Logging in...',
    'login.success.title': 'Login successful',
    'login.success.description': 'Welcome back',
    'login.error.title': 'Login error',
    'login.error.description': 'Invalid email or password',
    'login.backToHome': 'Back to Home',
    
    // Register
    'register.title': 'Create New Account',
    'register.description': 'Create your account to start shopping',
    'register.name': 'Full Name',
    'register.email': 'Email',
    'register.phone': 'Phone Number',
    'register.password': 'Password',
    'register.passwordHint': 'Must be at least 6 characters',
    'register.submit': 'Create Account',
    'register.hasAccount': 'Already have an account?',
    'register.login': 'Login',
    'register.registering': 'Creating account...',
    'register.success.title': 'Account created successfully',
    'register.success.description': 'Welcome to Al-Ain Computer Trading',
    'register.error.title': 'Error creating account',
    'register.error.description': 'An error occurred, please try again',
    'register.backToHome': 'Back to Home',
    
    // Admin
    'admin.login.title': 'Admin Login',
    'admin.login.password': 'Password',
    'admin.login.submit': 'Login',
    'admin.dashboard.title': 'Dashboard',
    'admin.dashboard.ordersTitle': 'Order Management',
    'admin.dashboard.ordersCount': 'Order Count',
    'admin.dashboard.noOrders': 'No orders currently',
    'admin.dashboard.orders': 'Orders',
    'admin.dashboard.orderNumber': 'Order #',
    'admin.dashboard.customer': 'Customer',
    'admin.dashboard.email': 'Email',
    'admin.dashboard.phone': 'Phone',
    'admin.dashboard.city': 'City',
    'admin.dashboard.itemsCount': 'Items Count',
    'admin.dashboard.item': 'item',
    'admin.dashboard.total': 'Total',
    'admin.dashboard.status': 'Status',
    'admin.dashboard.date': 'Date',
    'admin.dashboard.update': 'Update',
    'admin.dashboard.updating': 'Updating...',
    'admin.dashboard.logout': 'Logout',
    'admin.dashboard.pending': 'Pending',
    'admin.dashboard.processing': 'Processing',
    'admin.dashboard.shipped': 'Shipped',
    'admin.dashboard.delivered': 'Delivered',
    'admin.dashboard.cancelled': 'Cancelled',
    'admin.dashboard.updateSuccess': 'Update Successful',
    'admin.dashboard.updateSuccessDesc': 'Order status updated',
    'admin.dashboard.updateError': 'Error',
    'admin.dashboard.updateErrorDesc': 'Failed to update order',
    'admin.dashboard.logoutSuccess': 'Logged Out',
    'admin.dashboard.logoutSuccessDesc': 'You have been logged out successfully',
    
    // Admin Products
    'admin.products.title': 'Manage Products',
    'admin.products.addNew': 'Add New Product',
    'admin.products.edit': 'Edit',
    'admin.products.delete': 'Delete',
    'admin.products.confirmDelete': 'Are you sure you want to delete this product?',
    'admin.products.nameAr': 'Arabic Name',
    'admin.products.nameEn': 'English Name',
    'admin.products.descAr': 'Arabic Description',
    'admin.products.descEn': 'English Description',
    'admin.products.price': 'Price',
    'admin.products.oldPrice': 'Old Price',
    'admin.products.category': 'Category',
    'admin.products.image': 'Image URL',
    'admin.products.badge': 'Badge',
    'admin.products.inStock': 'In Stock',
    'admin.products.specs': 'Specifications (one per line)',
    'admin.products.save': 'Save',
    'admin.products.cancel': 'Cancel',
    'admin.products.creating': 'Creating...',
    'admin.products.updating': 'Updating...',
    'admin.products.deleting': 'Deleting...',
    'admin.products.actions': 'Actions',
    'admin.products.manageProducts': 'Manage Products',
    'admin.products.imagePlaceholder': 'product_image.png',
    
    // Admin Settings
    'admin.settings.title': 'Store Settings',
    'admin.settings.storeInfo': 'Store Information',
    'admin.settings.storeInfoDesc': 'Update your store name and description',
    'admin.settings.contactInfo': 'Contact Information',
    'admin.settings.contactInfoDesc': 'Update email, phone, and location',
    'admin.settings.socialMedia': 'Social Media',
    'admin.settings.socialMediaDesc': 'Add your social media profile links',
    'admin.settings.storeNameAr': 'Store Name (Arabic)',
    'admin.settings.storeNameEn': 'Store Name (English)',
    'admin.settings.descriptionAr': 'Description (Arabic)',
    'admin.settings.descriptionEn': 'Description (English)',
    'admin.settings.email': 'Email Address',
    'admin.settings.phone': 'Phone Number',
    'admin.settings.phoneAr': 'Phone Number (Arabic)',
    'admin.settings.addressAr': 'Address (Arabic)',
    'admin.settings.addressEn': 'Address (English)',
    'admin.settings.hoursAr': 'Working Hours (Arabic)',
    'admin.settings.hoursEn': 'Working Hours (English)',
    'admin.settings.facebookUrl': 'Facebook URL',
    'admin.settings.twitterUrl': 'Twitter URL',
    'admin.settings.instagramUrl': 'Instagram URL',
    'admin.settings.save': 'Save Settings',
    'admin.settings.successTitle': 'Saved',
    'admin.settings.successMessage': 'Store settings saved successfully',
    'admin.settings.errorMessage': 'Failed to save settings',
    'admin.settings.manageSettings': 'Store Settings',
    
    // Categories
    'categories.laptops': 'Laptops',
    'categories.desktops': 'Desktops',
    'categories.monitors': 'Monitors',
    'categories.accessories': 'Accessories',
    
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
