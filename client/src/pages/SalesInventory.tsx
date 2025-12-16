import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Package, 
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type { Product } from "@shared/schema";

interface SalesUser {
  id: string;
  permissions: {
    canInventory: number;
  };
}

interface SalesInventoryProps {
  user: SalesUser;
}

export default function SalesInventory({ user }: SalesInventoryProps) {
  const { language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  if (!user.permissions.canInventory) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">
          {language === 'ar' ? 'ليس لديك صلاحية الوصول للمخزون' : 'You do not have access to Inventory'}
        </p>
      </div>
    );
  }

  const filteredProducts = products.filter(p => {
    const name = language === 'ar' ? p.nameAr : (p.nameEn || p.nameAr);
    const sku = p.sku || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           sku.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const lowStockProducts = products.filter(p => 
    (p.stockQuantity || 0) <= (p.lowStockThreshold || 5)
  );

  const totalStock = products.reduce((sum, p) => sum + (p.stockQuantity || 0), 0);
  const outOfStock = products.filter(p => (p.stockQuantity || 0) === 0).length;

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ar-IQ').format(num);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'إجمالي المنتجات' : 'Total Products'}
                </p>
                <p className="text-2xl font-bold">{formatNumber(products.length)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Package className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'إجمالي المخزون' : 'Total Stock'}
                </p>
                <p className="text-2xl font-bold">{formatNumber(totalStock)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'مخزون منخفض' : 'Low Stock'}
                </p>
                <p className="text-2xl font-bold">{formatNumber(lowStockProducts.length)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <Package className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'نفد المخزون' : 'Out of Stock'}
                </p>
                <p className="text-2xl font-bold">{formatNumber(outOfStock)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {lowStockProducts.length > 0 && (
        <Card className="border-yellow-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-5 w-5" />
              {language === 'ar' ? 'تنبيه: منتجات بمخزون منخفض' : 'Alert: Low Stock Products'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lowStockProducts.slice(0, 10).map(p => (
                <Badge key={p.id} variant="outline" className="bg-yellow-50">
                  {language === 'ar' ? p.nameAr : (p.nameEn || p.nameAr)}
                  <span className="ms-2 text-yellow-600">({p.stockQuantity || 0})</span>
                </Badge>
              ))}
              {lowStockProducts.length > 10 && (
                <Badge variant="secondary">
                  +{lowStockProducts.length - 10} {language === 'ar' ? 'المزيد' : 'more'}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle>
              {language === 'ar' ? 'قائمة المنتجات' : 'Product List'}
            </CardTitle>
            <div className="relative w-full max-w-sm">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={language === 'ar' ? 'البحث...' : 'Search...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
                data-testid="input-inventory-search"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-start p-3">{language === 'ar' ? 'المنتج' : 'Product'}</th>
                    <th className="text-start p-3">{language === 'ar' ? 'SKU' : 'SKU'}</th>
                    <th className="text-start p-3">{language === 'ar' ? 'الفئة' : 'Category'}</th>
                    <th className="text-center p-3">{language === 'ar' ? 'المخزون' : 'Stock'}</th>
                    <th className="text-center p-3">{language === 'ar' ? 'الحد الأدنى' : 'Min'}</th>
                    <th className="text-start p-3">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(product => {
                    const stock = product.stockQuantity || 0;
                    const threshold = product.lowStockThreshold || 5;
                    let status: 'ok' | 'low' | 'out' = 'ok';
                    if (stock === 0) status = 'out';
                    else if (stock <= threshold) status = 'low';

                    return (
                      <tr key={product.id} className="border-b hover:bg-muted/50">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            {product.image && (
                              <img 
                                src={product.image} 
                                alt={product.nameAr}
                                className="w-10 h-10 object-cover rounded"
                              />
                            )}
                            <span className="font-medium">
                              {language === 'ar' ? product.nameAr : (product.nameEn || product.nameAr)}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground">{product.sku || '-'}</td>
                        <td className="p-3">{product.category}</td>
                        <td className="p-3 text-center font-bold">{formatNumber(stock)}</td>
                        <td className="p-3 text-center text-muted-foreground">{threshold}</td>
                        <td className="p-3">
                          {status === 'out' && (
                            <Badge variant="destructive">
                              {language === 'ar' ? 'نفد' : 'Out'}
                            </Badge>
                          )}
                          {status === 'low' && (
                            <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                              {language === 'ar' ? 'منخفض' : 'Low'}
                            </Badge>
                          )}
                          {status === 'ok' && (
                            <Badge variant="outline" className="border-green-500 text-green-600">
                              {language === 'ar' ? 'متوفر' : 'OK'}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
