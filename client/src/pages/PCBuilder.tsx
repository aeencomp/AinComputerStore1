import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Product, CPUCompatibility, MotherboardCompatibility, RAMCompatibility, GPUCompatibility, StorageCompatibility, PSUCompatibility, CaseCompatibility, CoolerCompatibility, MonitorCompatibility, MouseCompatibility, KeyboardCompatibility } from '@shared/schema';
import { Cpu, CircuitBoard, MemoryStick, MonitorPlay, HardDrive, Zap, Box, Fan, Check, AlertTriangle, X, ShoppingCart, Trash2, ChevronLeft, ChevronRight, Monitor, Mouse, Keyboard } from 'lucide-react';

type ComponentType = 'cpu' | 'motherboard' | 'ram' | 'gpu' | 'storage' | 'psu' | 'case' | 'cooler' | 'monitor' | 'mouse' | 'keyboard';

interface SelectedComponents {
  cpu: Product | null;
  motherboard: Product | null;
  ram: Product | null;
  gpu: Product | null;
  storage: Product | null;
  psu: Product | null;
  case: Product | null;
  cooler: Product | null;
  monitor: Product | null;
  mouse: Product | null;
  keyboard: Product | null;
}

const componentOrder: ComponentType[] = ['cpu', 'motherboard', 'ram', 'gpu', 'storage', 'psu', 'case', 'cooler', 'monitor', 'mouse', 'keyboard'];

const componentIcons: Record<ComponentType, typeof Cpu> = {
  cpu: Cpu,
  motherboard: CircuitBoard,
  ram: MemoryStick,
  gpu: MonitorPlay,
  storage: HardDrive,
  psu: Zap,
  case: Box,
  cooler: Fan,
  monitor: Monitor,
  mouse: Mouse,
  keyboard: Keyboard,
};

export default function PCBuilder() {
  const { t, language, isRTL } = useLanguage();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState<ComponentType>('cpu');
  const [selectedComponents, setSelectedComponents] = useState<SelectedComponents>({
    cpu: null,
    motherboard: null,
    ram: null,
    gpu: null,
    storage: null,
    psu: null,
    case: null,
    cooler: null,
    monitor: null,
    mouse: null,
    keyboard: null,
  });

  // Fetch all components
  const { data: allProducts = [], isLoading } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  // Filter products by component type
  const componentProducts = useMemo(() => {
    return allProducts.filter(p => p.componentType === currentStep);
  }, [allProducts, currentStep]);

  // Compatibility checking functions
  const checkCompatibility = (product: Product): { compatible: boolean; warnings: string[] } => {
    const warnings: string[] = [];
    const compat = product.compatibility as any;
    
    if (!compat) return { compatible: true, warnings: [] };

    switch (product.componentType) {
      case 'motherboard': {
        const cpu = selectedComponents.cpu;
        if (cpu && cpu.compatibility) {
          const cpuCompat = cpu.compatibility as CPUCompatibility;
          const mbCompat = compat as MotherboardCompatibility;
          if (cpuCompat.socket !== mbCompat.socket) {
            warnings.push(t('pcBuilder.compatibility.socketMismatch'));
            return { compatible: false, warnings };
          }
        }
        break;
      }
      case 'ram': {
        const motherboard = selectedComponents.motherboard;
        if (motherboard && motherboard.compatibility) {
          const mbCompat = motherboard.compatibility as MotherboardCompatibility;
          const ramCompat = compat as RAMCompatibility;
          if (ramCompat.type !== mbCompat.ramType) {
            warnings.push(t('pcBuilder.compatibility.ramTypeMismatch'));
            return { compatible: false, warnings };
          }
          if (ramCompat.modules > mbCompat.ramSlots) {
            warnings.push(t('pcBuilder.compatibility.tooManyRamModules'));
            return { compatible: false, warnings };
          }
        }
        break;
      }
      case 'gpu': {
        const caseComp = selectedComponents.case;
        if (caseComp && caseComp.compatibility) {
          const caseCompat = caseComp.compatibility as CaseCompatibility;
          const gpuCompat = compat as GPUCompatibility;
          if (gpuCompat.lengthMm > caseCompat.maxGpuLengthMm) {
            warnings.push(t('pcBuilder.compatibility.gpuTooLong'));
            return { compatible: false, warnings };
          }
        }
        break;
      }
      case 'cooler': {
        const cpu = selectedComponents.cpu;
        const caseComp = selectedComponents.case;
        if (cpu && cpu.compatibility) {
          const cpuCompat = cpu.compatibility as CPUCompatibility;
          const coolerCompat = compat as CoolerCompatibility;
          if (!coolerCompat.socketSupport?.includes(cpuCompat.socket)) {
            warnings.push(t('pcBuilder.compatibility.coolerSocketMismatch'));
            return { compatible: false, warnings };
          }
        }
        if (caseComp && caseComp.compatibility) {
          const caseCompat = caseComp.compatibility as CaseCompatibility;
          const coolerCompat = compat as CoolerCompatibility;
          if (coolerCompat.type === 'air' && coolerCompat.heightMm && coolerCompat.heightMm > caseCompat.maxCpuCoolerHeightMm) {
            warnings.push(t('pcBuilder.compatibility.coolerTooTall'));
            return { compatible: false, warnings };
          }
          if (coolerCompat.type === 'aio' && coolerCompat.radiatorSize && !caseCompat.radiatorSizes?.includes(coolerCompat.radiatorSize)) {
            warnings.push(t('pcBuilder.compatibility.radiatorNotSupported'));
            return { compatible: false, warnings };
          }
        }
        break;
      }
      case 'case': {
        const motherboard = selectedComponents.motherboard;
        if (motherboard && motherboard.compatibility) {
          const mbCompat = motherboard.compatibility as MotherboardCompatibility;
          const caseCompat = compat as CaseCompatibility;
          if (!caseCompat.supportedMB?.includes(mbCompat.formFactor)) {
            warnings.push(t('pcBuilder.compatibility.caseFormFactorMismatch'));
            return { compatible: false, warnings };
          }
        }
        break;
      }
      case 'psu': {
        const caseComp = selectedComponents.case;
        if (caseComp && caseComp.compatibility) {
          const caseCompat = caseComp.compatibility as CaseCompatibility;
          const psuCompat = compat as PSUCompatibility;
          if (!caseCompat.psuFormFactors?.includes(psuCompat.formFactor)) {
            warnings.push(t('pcBuilder.compatibility.psuFormFactorMismatch'));
            return { compatible: false, warnings };
          }
        }
        break;
      }
    }
    
    return { compatible: true, warnings };
  };

  // Calculate total power and check PSU
  const calculatePower = useMemo(() => {
    let totalTdp = 0;
    
    if (selectedComponents.cpu?.compatibility) {
      const cpuCompat = selectedComponents.cpu.compatibility as CPUCompatibility;
      totalTdp += cpuCompat.tdpW || 0;
    }
    if (selectedComponents.gpu?.compatibility) {
      const gpuCompat = selectedComponents.gpu.compatibility as GPUCompatibility;
      totalTdp += gpuCompat.tdpW || 0;
    }
    
    // Add estimated power for other components
    totalTdp += 50; // RAM, storage, etc.
    
    const recommendedPsu = Math.ceil(totalTdp * 1.4 / 50) * 50; // 40% headroom, rounded to 50W
    
    let psuSufficient = true;
    if (selectedComponents.psu?.compatibility) {
      const psuCompat = selectedComponents.psu.compatibility as PSUCompatibility;
      psuSufficient = psuCompat.wattageW >= recommendedPsu;
    }
    
    return { totalTdp, recommendedPsu, psuSufficient };
  }, [selectedComponents]);

  // Calculate total price
  const totalPrice = useMemo(() => {
    return Object.values(selectedComponents).reduce((sum, product) => {
      return sum + (product ? parseFloat(product.price) : 0);
    }, 0);
  }, [selectedComponents]);

  // Count selected components
  const selectedCount = Object.values(selectedComponents).filter(Boolean).length;

  const selectComponent = (product: Product) => {
    setSelectedComponents(prev => ({
      ...prev,
      [currentStep]: product,
    }));
  };

  const removeComponent = (type: ComponentType) => {
    setSelectedComponents(prev => ({
      ...prev,
      [type]: null,
    }));
  };

  const goToNextStep = () => {
    const currentIndex = componentOrder.indexOf(currentStep);
    if (currentIndex < componentOrder.length - 1) {
      setCurrentStep(componentOrder[currentIndex + 1]);
    }
  };

  const goToPreviousStep = () => {
    const currentIndex = componentOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(componentOrder[currentIndex - 1]);
    }
  };

  // Add build to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: async () => {
      const items = Object.values(selectedComponents)
        .filter((p): p is Product => p !== null)
        .map(p => ({ productId: p.id, quantity: 1 }));
      
      return await apiRequest('POST', '/api/cart/batch', { items });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
      toast({
        title: t('pcBuilder.addedToCart'),
        description: t('pcBuilder.addedToCartDesc'),
      });
      setLocation('/cart');
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('pcBuilder.addToCartError'),
        variant: 'destructive',
      });
    },
  });

  const formatPrice = (price: number) => {
    const formatted = new Intl.NumberFormat(language === 'ar' ? 'ar-IQ' : 'en-IQ').format(price);
    return `${formatted} ${t('common.currency')}`;
  };

  const currentStepIndex = componentOrder.indexOf(currentStep);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-pc-builder-title">
                {t('pcBuilder.title')}
              </h1>
              <p className="text-muted-foreground mt-1">{t('pcBuilder.subtitle')}</p>
            </div>
            <Link href="/">
              <Button variant="outline" data-testid="button-back-to-store">
                {t('pcBuilder.backToStore')}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - Component Selection */}
          <div className="lg:col-span-2">
            {/* Step Indicator */}
            <div className="mb-6">
              <div className="flex items-center justify-between overflow-x-auto pb-2">
                {componentOrder.map((type, index) => {
                  const Icon = componentIcons[type];
                  const isSelected = selectedComponents[type] !== null;
                  const isCurrent = currentStep === type;
                  
                  return (
                    <button
                      key={type}
                      onClick={() => setCurrentStep(type)}
                      className={`flex flex-col items-center gap-1 min-w-[80px] p-2 rounded-lg transition-colors ${
                        isCurrent 
                          ? 'bg-primary text-primary-foreground' 
                          : isSelected 
                            ? 'bg-green-500/10 text-green-600' 
                            : 'hover:bg-muted'
                      }`}
                      data-testid={`button-step-${type}`}
                    >
                      <div className="relative">
                        <Icon className="h-6 w-6" />
                        {isSelected && (
                          <Check className="absolute -top-1 -end-1 h-3 w-3 text-green-600 bg-background rounded-full" />
                        )}
                      </div>
                      <span className="text-xs font-medium">{t(`pcBuilder.component.${type}`)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="outline"
                onClick={goToPreviousStep}
                disabled={currentStepIndex === 0}
                data-testid="button-previous-step"
              >
                {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                {t('pcBuilder.previousStep')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {currentStepIndex + 1} / {componentOrder.length}
              </span>
              <Button
                variant="outline"
                onClick={goToNextStep}
                disabled={currentStepIndex === componentOrder.length - 1}
                data-testid="button-next-step"
              >
                {t('pcBuilder.nextStep')}
                {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </div>

            {/* Component List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {(() => {
                    const Icon = componentIcons[currentStep];
                    return <Icon className="h-5 w-5" />;
                  })()}
                  {t(`pcBuilder.select.${currentStep}`)}
                </CardTitle>
                <CardDescription>{t(`pcBuilder.selectDesc.${currentStep}`)}</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
                ) : componentProducts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('pcBuilder.noComponents')}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {componentProducts.map(product => {
                      const { compatible, warnings } = checkCompatibility(product);
                      const isSelected = selectedComponents[currentStep]?.id === product.id;
                      
                      return (
                        <div
                          key={product.id}
                          className={`flex items-center gap-4 p-4 rounded-lg border transition-colors cursor-pointer ${
                            isSelected 
                              ? 'border-primary bg-primary/5' 
                              : !compatible 
                                ? 'border-destructive/50 bg-destructive/5 opacity-60' 
                                : 'hover:bg-muted'
                          }`}
                          onClick={() => compatible && selectComponent(product)}
                          data-testid={`component-${product.id}`}
                        >
                          <div className="flex-shrink-0 w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                            {(() => {
                              const Icon = componentIcons[currentStep];
                              return <Icon className="h-8 w-8 text-muted-foreground" />;
                            })()}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium truncate">
                              {language === 'ar' ? product.nameAr : product.nameEn}
                            </h3>
                            <p className="text-sm text-muted-foreground truncate">
                              {language === 'ar' ? product.descriptionAr : product.descriptionEn}
                            </p>
                            {!compatible && warnings.length > 0 && (
                              <div className="flex items-center gap-1 text-destructive text-xs mt-1">
                                <AlertTriangle className="h-3 w-3" />
                                {warnings[0]}
                              </div>
                            )}
                          </div>
                          
                          <div className="text-end">
                            <div className="font-bold text-primary">
                              {formatPrice(parseFloat(product.price))}
                            </div>
                            {isSelected && (
                              <Badge className="mt-1">{t('pcBuilder.selected')}</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Build Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>{t('pcBuilder.yourBuild')}</CardTitle>
                <CardDescription>
                  {t('pcBuilder.selectedParts', { count: String(selectedCount) })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pe-4">
                  <div className="space-y-3">
                    {componentOrder.map(type => {
                      const product = selectedComponents[type];
                      const Icon = componentIcons[type];
                      
                      return (
                        <div key={type} className="flex items-center gap-3">
                          <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                            product ? 'bg-primary/10' : 'bg-muted'
                          }`}>
                            <Icon className={`h-4 w-4 ${product ? 'text-primary' : 'text-muted-foreground'}`} />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-muted-foreground">{t(`pcBuilder.component.${type}`)}</div>
                            {product ? (
                              <div className="text-sm font-medium truncate">
                                {language === 'ar' ? product.nameAr : product.nameEn}
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground italic">
                                {t('pcBuilder.notSelected')}
                              </div>
                            )}
                          </div>
                          
                          {product && (
                            <>
                              <div className="text-sm font-medium">
                                {formatPrice(parseFloat(product.price))}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeComponent(type)}
                                className="h-6 w-6"
                                data-testid={`button-remove-${type}`}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>

                <Separator className="my-4" />

                {/* Power Estimate */}
                <div className="mb-4 p-3 rounded-lg bg-muted">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('pcBuilder.estimatedPower')}</span>
                    <span className="font-medium">{calculatePower.totalTdp}W</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-muted-foreground">{t('pcBuilder.recommendedPsu')}</span>
                    <span className="font-medium">{calculatePower.recommendedPsu}W</span>
                  </div>
                  {selectedComponents.psu && !calculatePower.psuSufficient && (
                    <div className="flex items-center gap-1 text-destructive text-xs mt-2">
                      <AlertTriangle className="h-3 w-3" />
                      {t('pcBuilder.psuInsufficient')}
                    </div>
                  )}
                </div>

                {/* Total Price */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg font-medium">{t('pcBuilder.total')}</span>
                  <span className="text-2xl font-bold text-primary">{formatPrice(totalPrice)}</span>
                </div>

                {/* Add to Cart Button */}
                <Button
                  className="w-full"
                  size="lg"
                  disabled={selectedCount === 0 || addToCartMutation.isPending}
                  onClick={() => addToCartMutation.mutate()}
                  data-testid="button-add-build-to-cart"
                >
                  <ShoppingCart className="h-4 w-4 me-2" />
                  {addToCartMutation.isPending ? t('common.loading') : t('pcBuilder.addToCart')}
                </Button>

                {/* Clear Build */}
                {selectedCount > 0 && (
                  <Button
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() => setSelectedComponents({
                      cpu: null,
                      motherboard: null,
                      ram: null,
                      gpu: null,
                      storage: null,
                      psu: null,
                      case: null,
                      cooler: null,
                    })}
                    data-testid="button-clear-build"
                  >
                    <Trash2 className="h-4 w-4 me-2" />
                    {t('pcBuilder.clearBuild')}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
