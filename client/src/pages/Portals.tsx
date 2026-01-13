import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  ShieldCheck, 
  Users, 
  Battery, 
  Store,
  ArrowLeft,
  LogIn,
  Laptop,
  Settings,
  Package,
  BarChart3,
  ShoppingCart,
  Warehouse
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function Portals() {
  const { language, t } = useLanguage();

  const portals = [
    {
      id: "admin",
      nameAr: "بوابة الإدارة",
      nameEn: "Admin Portal",
      descriptionAr: "إدارة المنتجات والطلبات والإعدادات",
      descriptionEn: "Manage products, orders, and settings",
      icon: ShieldCheck,
      loginPath: "/admin/login",
      color: "bg-blue-500",
      features: [
        { nameAr: "إدارة المنتجات", nameEn: "Product Management", icon: Package },
        { nameAr: "إدارة الطلبات", nameEn: "Order Management", icon: ShoppingCart },
        { nameAr: "نقطة البيع", nameEn: "Point of Sale", icon: Store },
        { nameAr: "المخزون", nameEn: "Inventory", icon: Warehouse },
        { nameAr: "الإعدادات", nameEn: "Settings", icon: Settings },
        { nameAr: "التقارير", nameEn: "Reports", icon: BarChart3 },
      ]
    },
    {
      id: "sales",
      nameAr: "بوابة المبيعات",
      nameEn: "Sales Portal",
      descriptionAr: "نقطة البيع والمخزون للموظفين",
      descriptionEn: "POS and inventory for sales staff",
      icon: Users,
      loginPath: "/sales/login",
      color: "bg-green-500",
      features: [
        { nameAr: "نقطة البيع", nameEn: "Point of Sale", icon: Store },
        { nameAr: "عرض المخزون", nameEn: "View Inventory", icon: Warehouse },
        { nameAr: "التقارير", nameEn: "Reports", icon: BarChart3 },
      ]
    },
    {
      id: "battery",
      nameAr: "بوابة البطاريات",
      nameEn: "Battery Portal",
      descriptionAr: "إدارة البطاريات والشواحن",
      descriptionEn: "Manage batteries and adapters",
      icon: Battery,
      loginPath: "/battery/login",
      color: "bg-amber-500",
      features: [
        { nameAr: "إدارة البطاريات", nameEn: "Battery Management", icon: Battery },
        { nameAr: "إدارة الشواحن", nameEn: "Adapter Management", icon: Laptop },
        { nameAr: "نقطة البيع", nameEn: "Point of Sale", icon: Store },
        { nameAr: "التقارير", nameEn: "Reports", icon: BarChart3 },
      ]
    },
  ];

  return (
    <div className="min-h-screen flex flex-col" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <Header cartItemsCount={0} onCartClick={() => {}} onSearch={() => {}} />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">
                {language === 'ar' ? 'بوابات الموظفين' : 'Employee Portals'}
              </h1>
              <p className="text-muted-foreground">
                {language === 'ar' ? 'اختر البوابة المناسبة للوصول إلى النظام' : 'Select the appropriate portal to access the system'}
              </p>
            </div>
          </div>

          <Tabs defaultValue="admin" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              {portals.map((portal) => (
                <TabsTrigger 
                  key={portal.id} 
                  value={portal.id}
                  className="gap-2"
                  data-testid={`tab-${portal.id}`}
                >
                  <portal.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {language === 'ar' ? portal.nameAr : portal.nameEn}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

            {portals.map((portal) => (
              <TabsContent key={portal.id} value={portal.id}>
                <Card>
                  <CardHeader className="text-center pb-2">
                    <div className={`mx-auto w-16 h-16 ${portal.color} rounded-full flex items-center justify-center mb-4`}>
                      <portal.icon className="h-8 w-8 text-white" />
                    </div>
                    <CardTitle className="text-2xl">
                      {language === 'ar' ? portal.nameAr : portal.nameEn}
                    </CardTitle>
                    <CardDescription className="text-base">
                      {language === 'ar' ? portal.descriptionAr : portal.descriptionEn}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h3 className="font-semibold mb-3 text-center">
                        {language === 'ar' ? 'الميزات المتاحة' : 'Available Features'}
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {portal.features.map((feature, idx) => (
                          <div 
                            key={idx}
                            className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg"
                          >
                            <feature.icon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {language === 'ar' ? feature.nameAr : feature.nameEn}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t">
                      <Link href={portal.loginPath}>
                        <Button 
                          className="w-full gap-2" 
                          size="lg"
                          data-testid={`button-login-${portal.id}`}
                        >
                          <LogIn className="h-5 w-5" />
                          {language === 'ar' ? 'تسجيل الدخول' : 'Login'}
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {portals.map((portal) => (
              <Link key={portal.id} href={portal.loginPath}>
                <Card className="hover-elevate cursor-pointer h-full" data-testid={`card-${portal.id}`}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`w-10 h-10 ${portal.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <portal.icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">
                        {language === 'ar' ? portal.nameAr : portal.nameEn}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {language === 'ar' ? 'انقر للدخول' : 'Click to enter'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
