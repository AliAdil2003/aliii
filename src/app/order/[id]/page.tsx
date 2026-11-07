'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  FileText,
  Share2,
  Download,
  Trash2,
  Check,
  Package,
  Layers,
  ArrowRight,
  Printer,
  Sparkles,
  Phone,
  User,
  MapPin,
  MessageSquare,
  X,
  LayoutGrid,
  List,
  Eye,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronUp,
  Tag,
  Copy,
  CheckCheck,
  Hash,
  Maximize2,
} from 'lucide-react';
import { Product, Project, CustomerOrderPayload, CustomerOrderItem } from '@/types';

export default function CustomerOrderPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Pricing tier: Locked to wholesale (سعر الجملة دائماً)
  const pricingTier: 'wholesale' = 'wholesale';

  // Quantities state: map of productId -> quantity
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Checkout / Customer info
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  // Export statuses
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  // Zoomed image modal
  const [zoomedImage, setZoomedImage] = useState<{ src: string; title: string } | null>(null);

  // Full product details modal
  const [selectedProductDetails, setSelectedProductDetails] = useState<Product | null>(null);
  const [copiedBarcode, setCopiedBarcode] = useState(false);

  // ESC key listener to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedProductDetails(null);
        setZoomedImage(null);
        setIsCartOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch project and products
  useEffect(() => {
    async function loadCatalog() {
      setLoading(true);
      setNotFound(false);
      try {
        // 1. Fetch project meta
        const projRes = await fetch(`/api/projects/${projectId}`);
        if (!projRes.ok) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const projData = await projRes.json();
        if (!projData.success || !projData.project) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setProject(projData.project);

        // 2. Fetch products
        const prodRes = await fetch(`/api/projects/${projectId}/products`);
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          if (prodData.success && Array.isArray(prodData.products)) {
            // Filter included in catalog if set
            const valid = prodData.products.filter(
              (p: Product) => p.includedInCatalog !== false
            );
            setProducts(valid);
          }
        }
      } catch (err) {
        console.error('Failed to load catalog order sheet:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    if (projectId) {
      loadCatalog();
    }
  }, [projectId]);

  // Unique categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim());
      }
    });
    return Array.from(set);
  }, [products]);

  // Quantity helpers
  const handleSetQuantity = (productId: string, val: number) => {
    const q = Math.max(0, Math.floor(val || 0));
    setQuantities((prev) => {
      if (q === 0) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: q };
    });
  };

  const handleIncrement = (productId: string, step: number = 1) => {
    const cur = quantities[productId] || 0;
    handleSetQuantity(productId, cur + step);
  };

  const handleDecrement = (productId: string, step: number = 1) => {
    const cur = quantities[productId] || 0;
    handleSetQuantity(productId, Math.max(0, cur - step));
  };

  const handleClearCart = () => {
    if (window.confirm('هل أنت متأكد من رغبتك في تفريغ سلة الطلبية بالكامل؟')) {
      setQuantities({});
    }
  };

  // Helper to get product description
  const getProductDescription = (p: Product): string => {
    return (
      p.customDescription ||
      p.shopifyDescription ||
      p.shortenedDescription ||
      p.originalDescription ||
      ''
    ).trim();
  };

  // Helper to get Retail Price (سعر البيع المفرد)
  const getRetailPrice = (p: Product): number => {
    const raw =
      p.customerPrice !== undefined && p.customerPrice !== ''
        ? p.customerPrice
        : p.price ?? p.salePrice;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
      const cleaned = raw.replace(/[^0-9.]/g, '');
      return parseFloat(cleaned) || 0;
    }
    return 0;
  };

  // Helper to get Wholesale Price (سعر الجملة)
  const getWholesalePrice = (p: Product): number => {
    const raw =
      p.salePrice !== undefined && p.salePrice !== ''
        ? p.salePrice
        : p.customerPrice ?? p.price;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
      const cleaned = raw.replace(/[^0-9.]/g, '');
      return parseFloat(cleaned) || 0;
    }
    return 0;
  };

  // Get effective price: Always Wholesale (سعر الجملة دائماً)
  const getEffectivePrice = (p: Product, _tier?: string): number => {
    const wholesale = getWholesalePrice(p);
    const retail = getRetailPrice(p);
    return wholesale > 0 ? wholesale : retail;
  };

  // Selected cart items
  const selectedCartItems = useMemo(() => {
    const items: CustomerOrderItem[] = [];
    products.forEach((p) => {
      const q = quantities[p.id] || 0;
      if (q > 0) {
        const retailPrice = getRetailPrice(p);
        const wholesalePrice = getWholesalePrice(p);
        const unitPrice = getEffectivePrice(p, pricingTier);
        const subtotal = unitPrice * q;

        items.push({
          id: p.id,
          name: p.customName || p.shortenedName || p.name,
          description: getProductDescription(p),
          category: p.category,
          barcode: p.barcode,
          internalReference: p.internalReference,
          imageData: p.imageData,
          retailPrice,
          formattedRetailPrice: retailPrice.toLocaleString('en-US'),
          wholesalePrice,
          formattedWholesalePrice: wholesalePrice.toLocaleString('en-US'),
          appliedPriceType: pricingTier,
          unitPrice,
          formattedUnitPrice: unitPrice.toLocaleString('en-US'),
          requestedQuantity: q,
          subtotal,
          formattedSubtotal: subtotal.toLocaleString('en-US'),
        });
      }
    });
    return items;
  }, [products, quantities, pricingTier]);

  // Cart Totals
  const totalItemsCount = selectedCartItems.length;
  const totalPiecesCount = useMemo(() => {
    return Object.values(quantities).reduce((acc, q) => acc + (q || 0), 0);
  }, [quantities]);

  const totalAmount = useMemo(() => {
    return selectedCartItems.reduce((acc, i) => acc + i.subtotal, 0);
  }, [selectedCartItems]);

  const currency = project?.columnMapping?.currency || 'د.ع';

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory) {
        return false;
      }
      if (showOnlySelected && !(quantities[p.id] && quantities[p.id] > 0)) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = (p.name || '').toLowerCase().includes(q);
        const matchDesc = (p.originalDescription || p.shortenedDescription || '').toLowerCase().includes(q);
        const matchRef = (p.internalReference || '').toLowerCase().includes(q);
        const matchBarcode = (p.barcode || '').toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchRef && !matchBarcode) {
          return false;
        }
      }
      return true;
    });
  }, [products, selectedCategory, showOnlySelected, search, quantities]);

  // Download PDF
  const handleDownloadPdf = async () => {
    if (selectedCartItems.length === 0) {
      alert('سلة الطلب فارغة، يرجى اختيار المنتجات وتحديد كمياتها أولاً');
      return;
    }
    if (!customerName.trim()) {
      alert('يرجى كتابة اسم الزبون أو اسم المحل لاستخراج الطلبية بشكل رسمي');
      return;
    }

    setIsGeneratingPdf(true);
    setExportSuccessMessage(null);

    const payload: CustomerOrderPayload = {
      projectId,
      catalogTitle: project?.name || 'كتالوج المنتجات',
      pricingTier,
      customerInfo: {
        name: customerName.trim(),
        phone: customerPhone.trim(),
        address: customerAddress.trim(),
        notes: customerNotes.trim(),
      },
      items: selectedCartItems,
      totalItems: totalItemsCount,
      totalQuantity: totalPiecesCount,
      totalAmount,
      currency,
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await fetch('/api/customer-order/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'فشل توليد ملف PDF');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `طلبية_${customerName.trim().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setExportSuccessMessage('تم تنزيل ملف الطلبية (PDF) بنجاح!');
      setTimeout(() => setExportSuccessMessage(null), 5000);
    } catch (err: any) {
      alert(`حدث خطأ أثناء تنزيل الملف: ${err.message || 'فشل الاتصال'}`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Download Excel
  const handleDownloadExcel = async () => {
    if (selectedCartItems.length === 0) return;
    setIsExportingExcel(true);

    const payload: CustomerOrderPayload = {
      projectId,
      catalogTitle: project?.name || 'كتالوج المنتجات',
      pricingTier,
      customerInfo: {
        name: customerName.trim() || 'عميل نقدي',
        phone: customerPhone.trim(),
        address: customerAddress.trim(),
        notes: customerNotes.trim(),
      },
      items: selectedCartItems,
      totalItems: totalItemsCount,
      totalQuantity: totalPiecesCount,
      totalAmount,
      currency,
    };

    try {
      const res = await fetch('/api/customer-order/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('فشل تصدير Excel');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `طلبية_${(customerName || 'زبون').trim()}_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('خطأ أثناء تصدير Excel: ' + err.message);
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Share via WhatsApp
  const handleShareWhatsApp = () => {
    if (selectedCartItems.length === 0) {
      alert('سلة الطلب فارغة');
      return;
    }

    const tierName = 'سعر الجملة';
    const lines: string[] = [];
    lines.push(`📦 *طلب شراء جديد من الكتالوج*`);
    lines.push(`🏛️ المتجر: *${project?.name || 'E-Zone Iraq'}*`);
    lines.push(`👤 الزبون: *${customerName.trim() || 'غير محدد'}*`);
    lines.push(`🏷️ نوع التسعير المعتمد: *${tierName}*`);
    if (customerPhone.trim()) lines.push(`📱 الهاتف: ${customerPhone.trim()}`);
    if (customerAddress.trim()) lines.push(`📍 العنوان: ${customerAddress.trim()}`);
    lines.push(`-----------------------------------`);
    lines.push(`*قائمة المواد المطلوبة (${totalItemsCount} صنف):*`);

    selectedCartItems.forEach((item, idx) => {
      const barcodeStr = item.barcode ? ` | الباركود: ${item.barcode}` : '';
      lines.push(
        `${idx + 1}. *${item.name}*${barcodeStr}\n   الكمية: [ *${item.requestedQuantity}* قطعة ]\n   سعر المفرد: ${item.formattedRetailPrice} ${currency} | سعر الجملة: ${item.formattedWholesalePrice} ${currency}\n   المجموع (${tierName}): *${item.formattedSubtotal} ${currency}*`
      );
    });

    lines.push(`-----------------------------------`);
    lines.push(`📊 *إجمالي القطع:* ${totalPiecesCount} قطعة`);
    lines.push(`💰 *المبلغ الكلي (${tierName}):* ${totalAmount.toLocaleString()} ${currency}`);
    if (customerNotes.trim()) {
      lines.push(`📝 *ملاحظات:* ${customerNotes.trim()}`);
    }

    const text = encodeURIComponent(lines.join('\n'));
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#012336] flex flex-col items-center justify-center text-white font-cairo">
        <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-black text-white">جاري تحميل كتالوج الطلب...</h2>
        <p className="text-xs text-sky-200 mt-1">يرجى الانتظار ثوانٍ لتحميل المنتجات والصور</p>
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <div className="min-h-screen bg-[#012336] flex flex-col items-center justify-center text-white font-cairo p-4">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-white">لم يتم العثور على الكتالوج</h2>
        <p className="text-xs text-slate-300 mt-2 text-center max-w-md">
          الرابط الذي تحاول الوصول إليه غير متاح أو تم نقله. يرجى التأكد من صحة الرابط أو التواصل مع المتجر.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#012336] text-white font-cairo flex flex-col antialiased selection:bg-[#01334E] selection:text-white">
      {/* Top Floating / Sticky Header (EZONE Navy & White) */}
      <header className="sticky top-0 z-40 bg-[#01334E]/95 backdrop-blur-md border-b border-white/10 px-4 sm:px-8 py-3 flex items-center justify-between gap-4 shadow-xl">
        {/* Brand & Project Info */}
        <div className="flex items-center gap-3">
          <div className="h-10 px-2 py-1 rounded-2xl bg-white flex items-center justify-center shadow-lg border border-white/20">
            <img src="/ezone-logo.png" alt="E-ZONE" className="h-6 w-auto object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black text-white line-clamp-1">
                {project.name}
              </h1>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-black bg-white/20 text-white border border-white/30">
                كتالوج طلب مباشر
              </span>
            </div>
            <p className="text-[11px] text-sky-200/80">
              شركة المنطقة التقنية • تصفح وحدد عدد القطع المطلوبة للطلبية
            </p>
          </div>
        </div>

        {/* Live Cart Action Pill */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setIsCartOpen(true)}
            className={`px-4 sm:px-5 py-2.5 rounded-2xl font-black text-xs transition-all flex items-center gap-2 shadow-lg ${
              totalPiecesCount > 0
                ? 'bg-white text-[#01334E] hover:bg-slate-100 shadow-white/10 scale-105'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <ShoppingCart className="w-4 h-4 text-[#01334E]" />
            <span className="hidden sm:inline">سلة الطلبية:</span>
            <span className="bg-[#01334E] text-white px-2 py-0.5 rounded-lg text-xs font-mono font-black">
              {totalPiecesCount} قطعة
            </span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Hero Notice Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#01334E] via-[#024467] to-[#01263B] border border-white/15 p-5 sm:p-6 shadow-2xl">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-sky-300 tracking-wider uppercase flex items-center gap-1.5 mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                منظومة طلبات الشراء المعتمدة • E-ZONE
              </span>
              <h2 className="text-lg sm:text-2xl font-black text-white">
                اختر المنتجات وحدد الكميات المطلوبة
              </h2>
              <p className="text-xs sm:text-sm text-sky-100/80 mt-1 max-w-2xl">
                يمكنك كتابة عدد القطع المطلوب شرائها أمام كل منتج، وبعد الانتهاء اضغط على "معاينة السلة" لاستخراج ملف PDF معتمد يحتوي على المواد وكمياتها وصورها.
              </p>
            </div>

            {/* Quick Stats Box */}
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-3 shrink-0">
              <div className="text-center px-3 border-l border-white/15">
                <div className="text-base sm:text-xl font-black text-white">
                  {products.length}
                </div>
                <div className="text-[10px] text-sky-200">منتج معروض</div>
              </div>
              <div className="text-center px-3 border-l border-white/15">
                <div className="text-base sm:text-xl font-black text-white">
                  {categories.length}
                </div>
                <div className="text-[10px] text-sky-200">فئة تجارية</div>
              </div>
              <div className="text-center px-3">
                <div className="text-base sm:text-xl font-black text-emerald-300">
                  {totalItemsCount}
                </div>
                <div className="text-[10px] text-sky-200">صنف بالسلة</div>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar: Search, Category Chips & View Controls */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-sky-200/60 absolute right-3.5 top-3.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث باسم المنتج، الكود، الباركود، المواصفات..."
                className="w-full bg-[#01334E] border border-white/15 rounded-2xl pr-10 pl-10 py-2.5 text-xs sm:text-sm text-white placeholder-sky-200/50 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute left-3 top-3 text-sky-200/60 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* View Mode & Quick Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Fixed Pricing Tier Badge: سعر الجملة دائماً */}
              <div className="bg-[#01334E] border border-white/20 rounded-2xl px-3.5 py-2 flex items-center gap-2 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span className="text-xs font-black text-sky-200">التسعير المعتمد:</span>
                <span className="text-xs font-bold text-white">سعر الجملة</span>
              </div>

              <button
                onClick={() => setShowOnlySelected(!showOnlySelected)}
                className={`px-3 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                  showOnlySelected
                    ? 'bg-white text-[#01334E] border-white shadow-md font-black'
                    : 'bg-[#01334E] text-white border-white/15 hover:bg-[#024063]'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>المحددة فقط ({totalItemsCount})</span>
              </button>

              <div className="bg-[#01334E] border border-white/15 rounded-2xl p-1 flex items-center">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-xl transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white text-[#01334E]'
                      : 'text-sky-200/70 hover:text-white'
                  }`}
                  title="عرض شبكي (بطاقات كبيرة)"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-xl transition-colors ${
                    viewMode === 'table'
                      ? 'bg-white text-[#01334E]'
                      : 'text-sky-200/70 hover:text-white'
                  }`}
                  title="عرض جدول مضغوط"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Category Filter Pills */}
          {categories.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-white text-[#01334E] shadow-md font-black'
                    : 'bg-[#01334E] text-white/80 hover:text-white border border-white/10 hover:bg-[#024063]'
                }`}
              >
                جميع الفئات ({products.length})
              </button>
              {categories.map((cat) => {
                const count = products.filter((p) => p.category === cat).length;
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-white text-[#01334E] shadow-md font-black'
                        : 'bg-[#01334E] text-white/80 hover:text-white border border-white/10 hover:bg-[#024063]'
                    }`}
                  >
                    <span>{cat}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                        isSelected
                          ? 'bg-[#01334E]/15 text-[#01334E] font-mono font-bold'
                          : 'bg-white/10 text-white'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Product Grid / List Display */}
        {filteredProducts.length === 0 ? (
          <div className="py-24 text-center rounded-3xl bg-[#01334E] border border-white/10">
            <Package className="w-12 h-12 text-sky-300/40 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">لا توجد منتجات مطابقة</h3>
            <p className="text-xs text-sky-200/70 mt-1">
              جرب تغيير كلمة البحث أو اختيار فئة أخرى
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((p) => {
              const qty = quantities[p.id] || 0;
              const isSelected = qty > 0;
              const retailPrice = getRetailPrice(p);
              const wholesalePrice = getWholesalePrice(p);
              const effectiveUnitPrice = getEffectivePrice(p, pricingTier);
              const lineTotal = effectiveUnitPrice * qty;

              return (
                <div
                  key={p.id}
                  className={`group relative rounded-3xl p-4 flex flex-col justify-between transition-all duration-200 border ${
                    isSelected
                      ? 'bg-[#023C5C] border-white ring-2 ring-white/70 shadow-xl shadow-[#01334E]/60'
                      : 'bg-[#01334E] border-white/10 hover:border-white/30 hover:bg-[#023E5F]'
                  }`}
                >
                  {/* Selected Badge */}
                  {isSelected && (
                    <div className="absolute top-3 left-3 z-10 bg-white text-[#01334E] text-[11px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>{qty} قطعة</span>
                    </div>
                  )}

                  {/* Top: Image & Category */}
                  <div>
                    <div
                      onClick={() => setSelectedProductDetails(p)}
                      className="relative aspect-square w-full rounded-2xl bg-white p-3 flex items-center justify-center overflow-hidden mb-3 border border-slate-100/10 cursor-pointer"
                    >
                      {p.imageData ? (
                        <img
                          src={p.imageData}
                          alt={p.name}
                          className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="text-slate-400 text-xs flex flex-col items-center gap-1">
                          <Package className="w-8 h-8 stroke-1 text-slate-300" />
                          <span>بدون صورة</span>
                        </div>
                      )}

                      {/* Quick Details overlay on hover */}
                      <div className="absolute inset-0 bg-[#01334E]/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <div className="px-3 py-1.5 bg-white text-[#01334E] rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg scale-95 group-hover:scale-100 transition-transform">
                          <Eye className="w-3.5 h-3.5" />
                          <span>عرض جميع التفاصيل</span>
                        </div>
                      </div>
                    </div>

                    {/* Category & Barcode / Ref */}
                    <div className="flex items-center justify-between text-[11px] text-sky-200/80 mb-1.5 gap-1">
                      <span className="bg-white/10 px-2 py-0.5 rounded-md text-white font-semibold line-clamp-1">
                        {p.category || 'عام'}
                      </span>
                      {p.barcode ? (
                        <span
                          onClick={() => setSelectedProductDetails(p)}
                          className="font-mono text-[10px] text-white bg-white/10 hover:bg-white/20 px-1.5 py-0.5 rounded border border-white/15 shrink-0 cursor-pointer transition-colors"
                          title={`باركود: ${p.barcode} (اضغط لعرض التفاصيل)`}
                        >
                          {p.barcode}
                        </span>
                      ) : p.internalReference ? (
                        <span className="font-mono text-[10px] text-sky-200/70 shrink-0">
                          {p.internalReference}
                        </span>
                      ) : null}
                    </div>

                    {/* Name */}
                    <h3
                      onClick={() => setSelectedProductDetails(p)}
                      className="font-bold text-sm text-white hover:text-sky-300 line-clamp-2 leading-snug mb-1 cursor-pointer transition-colors"
                      title={`${p.name} (اضغط لعرض كافة التفاصيل)`}
                    >
                      {p.customName || p.shortenedName || p.name}
                    </h3>

                    {/* Description */}
                    {getProductDescription(p) ? (
                      <p
                        onClick={() => setSelectedProductDetails(p)}
                        className="text-[11px] text-sky-100/70 hover:text-white line-clamp-2 leading-relaxed mb-2 cursor-pointer transition-colors"
                        title={getProductDescription(p)}
                      >
                        {getProductDescription(p)}
                      </p>
                    ) : (
                      <div className="h-2" />
                    )}
                  </div>

                  {/* Bottom: Price & Interactive Quantity Selector */}
                  <div className="pt-2 border-t border-white/10 space-y-2.5">
                    {/* Dual Price: سعر الجملة وسعر المفرد */}
                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      <div className="p-2 rounded-xl border bg-white/5 border-white/10">
                        <div className="text-[10px] text-sky-200/80 mb-0.5">
                          سعر المفرد
                        </div>
                        <div className="text-xs font-semibold font-mono text-sky-100">
                          {retailPrice > 0 ? (
                            <>
                              {retailPrice.toLocaleString()}{' '}
                              <span className="text-[9px] text-sky-200/60 font-sans">{currency}</span>
                            </>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </div>
                      </div>

                      <div className="p-2 rounded-xl border bg-[#012538] border-white/20 shadow-sm">
                        <div className="text-[10px] text-sky-200 mb-0.5 font-bold">
                          سعر الجملة
                        </div>
                        <div className="text-xs font-black font-mono text-white">
                          {wholesalePrice > 0 ? (
                            <>
                              {wholesalePrice.toLocaleString()}{' '}
                              <span className="text-[9px] text-sky-200 font-sans">{currency}</span>
                            </>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quantity Control Box */}
                    <div className="bg-[#012538] rounded-2xl p-1.5 border border-white/15 flex items-center justify-between gap-1">
                      <button
                        onClick={() => handleDecrement(p.id, 1)}
                        disabled={qty <= 0}
                        className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-white flex items-center justify-center transition-colors"
                        title="إنقاص قطعة"
                      >
                        <Minus className="w-4 h-4" />
                      </button>

                      <div className="flex-1 text-center">
                        <input
                          type="number"
                          min="0"
                          value={qty === 0 ? '' : qty}
                          onChange={(e) => handleSetQuantity(p.id, parseInt(e.target.value, 10))}
                          placeholder="0"
                          className="w-full bg-transparent text-center font-mono font-black text-sm sm:text-base text-white focus:outline-none placeholder-sky-200/40"
                        />
                      </div>

                      <button
                        onClick={() => handleIncrement(p.id, 1)}
                        className="w-8 h-8 rounded-xl bg-white hover:bg-slate-100 active:scale-95 text-[#01334E] flex items-center justify-center transition-colors font-bold shadow-md"
                        title="إضافة قطعة"
                      >
                        <Plus className="w-4 h-4 stroke-[3]" />
                      </button>
                    </div>

                    {/* Quick Add Buttons & Subtotal */}
                    <div className="flex items-center justify-between text-[11px] pt-0.5">
                      <div className="flex items-center gap-1">
                        {[1, 5, 10].map((step) => (
                          <button
                            key={step}
                            onClick={() => handleIncrement(p.id, step)}
                            className="px-1.5 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono text-[10px] font-bold transition-colors"
                          >
                            +{step}
                          </button>
                        ))}
                      </div>

                      {isSelected && lineTotal > 0 && (
                        <div className="text-[11px] font-black text-white font-mono">
                          {lineTotal.toLocaleString()} {currency}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="bg-[#01334E] border border-white/10 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-[#012336] border-b border-white/10 text-sky-200 text-[11px]">
                    <th className="p-3 text-center w-12">#</th>
                    <th className="p-3 text-center w-16">الصورة</th>
                    <th className="p-3">اسم المنتج والمواصفات</th>
                    <th className="p-3 text-center w-28">الباركود</th>
                    <th className="p-3 text-center w-24">الفئة</th>
                    <th className="p-3 text-center w-28 text-sky-200/80 font-semibold">سعر المفرد</th>
                    <th className="p-3 text-center w-28 text-white font-black">سعر الجملة</th>
                    <th className="p-3 text-center w-48">الكمية المطلوبة</th>
                    <th className="p-3 text-left w-32 pl-4">المجموع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredProducts.map((p, idx) => {
                    const qty = quantities[p.id] || 0;
                    const isSelected = qty > 0;
                    const retailPrice = getRetailPrice(p);
                    const wholesalePrice = getWholesalePrice(p);
                    const effectiveUnitPrice = getEffectivePrice(p, pricingTier);
                    const lineTotal = effectiveUnitPrice * qty;

                    return (
                      <tr
                        key={p.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-[#023C5C]' : 'hover:bg-white/[0.04]'
                        }`}
                      >
                        <td
                          onClick={() => setSelectedProductDetails(p)}
                          className="p-3 text-center text-sky-200/70 font-mono cursor-pointer hover:text-white"
                          title="اضغط لعرض كافة التفاصيل"
                        >
                          {idx + 1}
                        </td>
                        <td
                          onClick={() => setSelectedProductDetails(p)}
                          className="p-3 text-center cursor-pointer group/img"
                          title="اضغط لعرض كافة التفاصيل"
                        >
                          <div className="w-12 h-12 rounded-xl bg-white p-1 mx-auto flex items-center justify-center overflow-hidden border border-slate-100/10 group-hover/img:scale-110 transition-transform">
                            {p.imageData ? (
                              <img
                                src={p.imageData}
                                alt={p.name}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <Package className="w-5 h-5 text-slate-300" />
                            )}
                          </div>
                        </td>
                        <td
                          onClick={() => setSelectedProductDetails(p)}
                          className="p-3 cursor-pointer group/name"
                        >
                          <div className="font-bold text-white group-hover/name:text-sky-300 text-xs sm:text-sm line-clamp-1 transition-colors">
                            {p.customName || p.shortenedName || p.name}
                          </div>
                          {getProductDescription(p) && (
                            <div className="text-[11px] text-sky-200/70 line-clamp-1 mt-0.5" title={getProductDescription(p)}>
                              {getProductDescription(p)}
                            </div>
                          )}
                          {p.internalReference && (
                            <div className="text-[10px] text-sky-200/50 font-mono mt-0.5">
                              المرجع: {p.internalReference}
                            </div>
                          )}
                        </td>
                        <td
                          onClick={() => setSelectedProductDetails(p)}
                          className="p-3 text-center font-mono cursor-pointer"
                        >
                          {p.barcode ? (
                            <span className="text-[11px] text-white bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded border border-white/15 transition-colors">
                              {p.barcode}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <span className="bg-white/10 px-2 py-0.5 rounded-md text-white text-[11px]">
                            {p.category || 'عام'}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono text-xs text-sky-100 font-semibold">
                          {retailPrice > 0 ? `${retailPrice.toLocaleString()} ${currency}` : '-'}
                        </td>
                        <td className="p-3 text-center font-mono text-xs font-black text-white bg-white/5">
                          {wholesalePrice > 0 ? `${wholesalePrice.toLocaleString()} ${currency}` : '-'}
                        </td>
                        <td className="p-3 text-center">
                          <div className="inline-flex items-center gap-1.5 bg-[#012538] rounded-xl p-1 border border-white/15">
                            <button
                              onClick={() => handleDecrement(p.id, 1)}
                              disabled={qty <= 0}
                              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 disabled:opacity-30 text-white flex items-center justify-center"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={qty === 0 ? '' : qty}
                              onChange={(e) =>
                                handleSetQuantity(p.id, parseInt(e.target.value, 10))
                              }
                              placeholder="0"
                              className="w-14 bg-transparent text-center font-mono font-black text-sm text-white focus:outline-none placeholder-sky-200/40"
                            />
                            <button
                              onClick={() => handleIncrement(p.id, 1)}
                              className="w-7 h-7 rounded-lg bg-white hover:bg-slate-100 active:scale-95 text-[#01334E] flex items-center justify-center font-bold"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="p-3 text-left font-black text-white font-mono pl-4">
                          {lineTotal > 0 ? `${lineTotal.toLocaleString()} ${currency}` : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Floating Bottom Cart Bar (Sticky - EZONE Navy & White) */}
      <aside className="sticky bottom-0 z-40 bg-[#01334E]/95 backdrop-blur-md border-t border-white/15 px-4 sm:px-8 py-3.5 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Summary numbers */}
          <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white text-[#01334E] flex items-center justify-center shadow-md">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-sky-200">ملخص سلة الطلبية:</div>
                <div className="text-sm sm:text-base font-black text-white flex items-center gap-1.5 font-mono">
                  <span>{totalItemsCount} صنف</span>
                  <span className="text-sky-300/40">•</span>
                  <span className="text-white">{totalPiecesCount} قطعة</span>
                </div>
              </div>
            </div>

            <div className="text-left sm:text-right border-r sm:border-r border-white/15 pr-4 sm:pr-6">
              <div className="text-xs text-sky-200">إجمالي المبلغ:</div>
              <div className="text-base sm:text-xl font-black text-white font-mono">
                {totalAmount.toLocaleString('en-US')}{' '}
                <span className="text-xs text-sky-200 font-sans">{currency}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {totalPiecesCount > 0 && (
              <button
                onClick={handleClearCart}
                className="p-2.5 rounded-2xl bg-white/10 hover:bg-rose-500/20 text-white hover:text-rose-300 border border-white/10 transition-colors"
                title="تفريغ السلة"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => setIsCartOpen(true)}
              disabled={totalPiecesCount === 0}
              className="flex-1 sm:flex-initial px-6 py-3 rounded-2xl bg-white hover:bg-slate-100 active:scale-95 text-[#01334E] font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-black/20 disabled:opacity-40 disabled:pointer-events-none"
            >
              <span>معاينة السلة وإصدار ملف PDF</span>
              <ArrowRight className="w-4 h-4 rotate-180" />
            </button>
          </div>
        </div>
      </aside>

      {/* Checkout & Order Review Modal (EZONE Navy & White) */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#01334E] border border-white/20 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-white">
            {/* Modal Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#012336]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white text-[#01334E] flex items-center justify-center font-bold shadow-md">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    مراجعة طلبية المنتجات وإصدار PDF
                  </h3>
                  <p className="text-xs text-sky-200/80">
                    أدخل بياناتك ثم حمل ملف PDF الرسمي بطلبك أو شاركه عبر الواتساب
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {/* Customer Inputs Form */}
              <div className="bg-[#012336] border border-white/15 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="text-xs font-black text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-sky-300" />
                  <span>بيانات الزبون / صاحب الطلبية:</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-sky-200 mb-1 font-semibold">
                      اسم الزبون أو اسم المتجر <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="مثال: شركة النور / أحمد علي"
                      className="w-full bg-[#011C2B] border border-white/15 rounded-xl px-3.5 py-2.5 text-white placeholder-sky-200/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sky-200 mb-1 font-semibold">
                      رقم الهاتف / الواتساب
                    </label>
                    <input
                      type="text"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="07XXXXXXXXX"
                      dir="ltr"
                      className="w-full bg-[#011C2B] border border-white/15 rounded-xl px-3.5 py-2.5 text-white placeholder-sky-200/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white text-left font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-sky-200 mb-1 font-semibold">
                      المدينة / عنوان الاستلام
                    </label>
                    <input
                      type="text"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      placeholder="بغداد - الكرادة"
                      className="w-full bg-[#011C2B] border border-white/15 rounded-xl px-3.5 py-2.5 text-white placeholder-sky-200/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sky-200 mb-1 font-semibold">
                      ملاحظات خاصة بالطلبية
                    </label>
                    <input
                      type="text"
                      value={customerNotes}
                      onChange={(e) => setCustomerNotes(e.target.value)}
                      placeholder="مثال: يرجى التوصيل خلال يومين"
                      className="w-full bg-[#011C2B] border border-white/15 rounded-xl px-3.5 py-2.5 text-white placeholder-sky-200/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white"
                    />
                  </div>
                </div>

                {/* Fixed Pricing Notice inside Modal */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-white/10">
                  <div className="text-xs">
                    <span className="text-white font-bold block sm:inline">نوع التسعير المعتمد للطلبية:</span>
                    <span className="text-[11px] text-sky-200/80 sm:mr-2">
                      (تم احتساب كافة أسعار وإجمالي الطلبية تلقائياً وفق تسعيرة الجملة)
                    </span>
                  </div>
                  <div className="px-3.5 py-1.5 rounded-xl bg-white/15 text-white border border-white/20 text-xs font-black flex items-center gap-1.5 shadow-sm self-start sm:self-auto">
                    <Package className="w-3.5 h-3.5 text-white" />
                    <span>سعر الجملة</span>
                  </div>
                </div>
              </div>

              {/* Selected Items Review Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-white">
                  <span>المنتجات المختارة في الطلبية ({selectedCartItems.length} صنف):</span>
                  <span className="text-white font-mono font-black">
                    {totalPiecesCount} قطعة إجمالية
                  </span>
                </div>

                <div className="border border-white/15 rounded-2xl overflow-hidden bg-[#012336]">
                  <div className="max-h-64 overflow-y-auto divide-y divide-white/10">
                    {selectedCartItems.map((item, idx) => (
                      <div
                        key={item.id}
                        className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-white/[0.04]"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-sky-200/60 font-mono text-[11px] w-4">
                            {idx + 1}
                          </span>
                          <div className="w-10 h-10 rounded-xl bg-white p-1 shrink-0 flex items-center justify-center overflow-hidden border border-slate-100">
                            {item.imageData ? (
                              <img
                                src={item.imageData}
                                alt={item.name}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <Package className="w-5 h-5 text-slate-300" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-white line-clamp-1">{item.name}</div>
                            {item.description && (
                              <div className="text-[10px] text-sky-200/70 line-clamp-1 mt-0.5">
                                {item.description}
                              </div>
                            )}
                            <div className="text-[10px] text-sky-200/80 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                              {item.barcode && (
                                <>
                                  <span className="font-mono text-white bg-white/10 px-1.5 py-0.2 rounded">باركود: {item.barcode}</span>
                                  <span>•</span>
                                </>
                              )}
                              <span className="text-sky-200/70">
                                مفرد: {item.formattedRetailPrice} {currency}
                              </span>
                              <span>•</span>
                              <span className="text-white font-black">
                                جملة: {item.formattedWholesalePrice} {currency}
                              </span>
                              {item.internalReference && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono text-sky-200/60">كود: {item.internalReference}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Adjust Quantity inline */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex items-center gap-1 bg-[#011C2B] rounded-xl p-1 border border-white/15">
                            <button
                              onClick={() => handleDecrement(item.id, 1)}
                              className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-10 text-center font-mono font-black text-xs text-white">
                              {item.requestedQuantity}
                            </span>
                            <button
                              onClick={() => handleIncrement(item.id, 1)}
                              className="w-6 h-6 rounded-lg bg-white hover:bg-slate-100 text-[#01334E] flex items-center justify-center font-bold"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="w-24 text-left font-mono font-black text-white text-xs">
                            {item.formattedSubtotal} {currency}
                          </div>

                          <button
                            onClick={() => handleSetQuantity(item.id, 0)}
                            className="p-1 text-sky-200/50 hover:text-rose-400"
                            title="حذف من السلة"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Table Footer Totals */}
                  <div className="p-4 bg-[#011C2B] border-t border-white/15 flex items-center justify-between font-black text-sm">
                    <span className="text-sky-200">المجموع الكلي للطلبية:</span>
                    <span className="text-base sm:text-lg text-white font-mono">
                      {totalAmount.toLocaleString('en-US')} {currency}
                    </span>
                  </div>
                </div>
              </div>

              {/* Feedback Success */}
              {exportSuccessMessage && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{exportSuccessMessage}</span>
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="p-5 border-t border-white/15 bg-[#012336] flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => setIsCartOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors"
              >
                رجوع لمتابعة التسوق
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleShareWhatsApp}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all flex items-center gap-2 shadow-md shadow-emerald-600/20"
                >
                  <Share2 className="w-4 h-4" />
                  <span>مشاركة عبر WhatsApp</span>
                </button>

                <button
                  onClick={handleDownloadExcel}
                  disabled={isExportingExcel}
                  className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-1.5 border border-white/15"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Excel</span>
                </button>

                <button
                  onClick={handleDownloadPdf}
                  disabled={isGeneratingPdf}
                  className="px-6 py-2.5 rounded-xl bg-white hover:bg-slate-100 active:scale-95 text-[#01334E] text-xs sm:text-sm font-black transition-all flex items-center gap-2 shadow-lg shadow-black/20 disabled:opacity-50"
                >
                  {isGeneratingPdf ? (
                    <>
                      <div className="w-4 h-4 border-2 border-[#01334E] border-t-transparent rounded-full animate-spin" />
                      <span>جاري إعداد وتنزيل PDF...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      <span>تنزيل ملف الطلبية (PDF)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Product Details Modal (EZONE Navy & White) */}
      {selectedProductDetails && (() => {
        const p = selectedProductDetails;
        const qty = quantities[p.id] || 0;
        const retailPrice = getRetailPrice(p);
        const wholesalePrice = getWholesalePrice(p);
        const unitPrice = getEffectivePrice(p, pricingTier);
        const lineTotal = unitPrice * qty;
        const fullDesc = (
          p.customDescription ||
          p.shopifyDescription ||
          p.shortenedDescription ||
          p.originalDescription ||
          ''
        ).trim();

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto"
            onClick={() => setSelectedProductDetails(null)}
          >
            <div
              className="bg-[#01334E] border border-white/20 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto text-white"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-[#012336]">
                <div className="flex items-center gap-2.5">
                  <span className="px-3 py-1 rounded-xl bg-white text-[#01334E] text-xs font-black shadow-sm">
                    {p.category || 'عام'}
                  </span>
                  {p.stock !== undefined && (
                    <span
                      className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${
                        p.stock > 0
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {p.stock > 0 ? `المخزون المتوفر: ${p.stock} قطعة` : 'نفذ من المخزن'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedProductDetails(null)}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                    title="إغلاق (Esc)"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {/* Top Section: Image & Main Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  {/* Image Column */}
                  <div className="relative aspect-square rounded-2xl bg-white p-4 flex items-center justify-center overflow-hidden border border-slate-100 shadow-inner group">
                    {p.imageData ? (
                      <img
                        src={p.imageData}
                        alt={p.name}
                        className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="text-slate-400 text-xs flex flex-col items-center gap-2">
                        <Package className="w-12 h-12 stroke-1 text-slate-300" />
                        <span>لا توجد صورة متوفرة</span>
                      </div>
                    )}

                    {p.imageData && (
                      <button
                        onClick={() => setZoomedImage({ src: p.imageData!, title: p.name })}
                        className="absolute bottom-3 left-3 bg-[#01334E]/90 hover:bg-[#01334E] text-white px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 backdrop-blur-sm transition-all border border-white/20 shadow-lg"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>تكبير الصورة</span>
                      </button>
                    )}
                  </div>

                  {/* Title & Key Meta Column */}
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-lg sm:text-xl font-black text-white leading-snug">
                        {p.customName || p.shortenedName || p.name}
                      </h2>
                      {p.originalName && p.originalName !== (p.customName || p.shortenedName || p.name) && (
                        <p className="text-[11px] text-sky-200/70 mt-1">
                          الاسم الأصلي: <span className="text-white">{p.originalName}</span>
                        </p>
                      )}
                    </div>

                    {/* Barcode & Reference Card */}
                    <div className="bg-[#012336] rounded-2xl p-3.5 border border-white/10 space-y-2.5">
                      {p.barcode && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-sky-200 font-semibold flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-white" />
                            الباركود الدولي:
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-white bg-white/15 px-2.5 py-0.5 rounded-md border border-white/20">
                              {p.barcode}
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(p.barcode);
                                setCopiedBarcode(true);
                                setTimeout(() => setCopiedBarcode(false), 2000);
                              }}
                              className="p-1 rounded bg-white/10 hover:bg-white/20 text-white transition-colors"
                              title="نسخ رقم الباركود"
                            >
                              {copiedBarcode ? (
                                <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {p.internalReference && (
                        <div className="flex items-center justify-between text-xs pt-2 border-t border-white/10">
                          <span className="text-sky-200 font-semibold flex items-center gap-1.5">
                            <Hash className="w-3.5 h-3.5 text-sky-400" />
                            المرجع الداخلي (SKU):
                          </span>
                          <span className="font-mono font-bold text-white bg-white/10 px-2 py-0.5 rounded">
                            {p.internalReference}
                          </span>
                        </div>
                      )}

                      {p.odooId && (
                        <div className="flex items-center justify-between text-xs pt-2 border-t border-white/10">
                          <span className="text-sky-200 font-semibold">معرف في نظام Odoo:</span>
                          <span className="font-mono text-white">#{p.odooId}</span>
                        </div>
                      )}

                      {p.shopifyUrl && (
                        <div className="pt-2 border-t border-white/10">
                          <a
                            href={p.shopifyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-sky-300 hover:text-white font-bold"
                          >
                            <span>مشاهدة المنتج على المتجر</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Dual Pricing Boxes in Modal */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-3 rounded-2xl border bg-[#012336] border-white/10">
                        <div className="text-[11px] text-sky-200 mb-1">
                          سعر البيع المفرد
                        </div>
                        <div className="text-sm font-semibold font-mono text-sky-100">
                          {retailPrice > 0 ? (
                            <>
                              {retailPrice.toLocaleString()}{' '}
                              <span className="text-[10px] text-sky-200/60 font-sans">{currency}</span>
                            </>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl border bg-white/15 border-white/30 shadow-sm">
                        <div className="text-[11px] text-white mb-1 font-bold">
                          سعر الجملة
                        </div>
                        <div className="text-sm font-black font-mono text-white">
                          {wholesalePrice > 0 ? (
                            <>
                              {wholesalePrice.toLocaleString()}{' '}
                              <span className="text-[10px] text-sky-200 font-sans">{currency}</span>
                            </>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Full Description Section */}
                {fullDesc ? (
                  <div className="bg-[#012336] rounded-2xl p-4 sm:p-5 border border-white/10 space-y-2">
                    <div className="text-xs font-black text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-sky-300" />
                      <span>الوصف والمواصفات الكاملة للمنتج:</span>
                    </div>
                    <div className="text-xs sm:text-sm text-sky-100 leading-relaxed whitespace-pre-line bg-[#011C2B] p-4 rounded-xl border border-white/10">
                      {fullDesc}
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#012336] rounded-2xl p-4 text-center text-xs text-sky-200/60 border border-white/10">
                    لا يوجد نص وصفي مسجل لهذا المنتج
                  </div>
                )}

                {/* Technical Specifications Grid */}
                <div className="bg-[#012336] rounded-2xl p-4 sm:p-5 border border-white/10 space-y-2.5">
                  <div className="text-xs font-black text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-sky-300" />
                    <span>جدول البيانات الفنية والتعريفية:</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-xl bg-[#011C2B] border border-white/10">
                      <span className="text-[10px] text-sky-200/70 block mb-0.5">الفئة التجارية:</span>
                      <span className="font-bold text-white line-clamp-1">{p.category || 'عام'}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#011C2B] border border-white/10">
                      <span className="text-[10px] text-sky-200/70 block mb-0.5">وحدة القياس:</span>
                      <span className="font-bold text-white">{p.unit || 'قطعة'}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#011C2B] border border-white/10">
                      <span className="text-[10px] text-sky-200/70 block mb-0.5">عملة السعر:</span>
                      <span className="font-bold text-white">{currency}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#011C2B] border border-white/10">
                      <span className="text-[10px] text-sky-200/70 block mb-0.5">المخزون المتوفر:</span>
                      <span className="font-bold font-mono text-emerald-300">{p.stock ?? '-'}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#011C2B] border border-white/10">
                      <span className="text-[10px] text-sky-200/70 block mb-0.5">رمز الباركود:</span>
                      <span className="font-bold font-mono text-white text-[11px]">{p.barcode || '-'}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#011C2B] border border-white/10">
                      <span className="text-[10px] text-sky-200/70 block mb-0.5">المرجع (SKU):</span>
                      <span className="font-bold font-mono text-white text-[11px]">{p.internalReference || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* Interactive Order / Quantity Selector Box in Modal */}
                <div className="bg-[#012336] rounded-2xl p-4 sm:p-5 border border-white/20 shadow-xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-black text-white flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4 text-sky-300" />
                        <span>تحديد الكمية المطلوبة للشراء:</span>
                      </div>
                      <div className="text-[11px] text-sky-200/70">
                        حدد عدد القطع لإضافتها مباشرة إلى سلة الطلبية
                      </div>
                    </div>

                    {qty > 0 && (
                      <div className="text-left sm:text-right">
                        <div className="text-[10px] text-sky-200/70">المجموع الفرعي لهذه المادة:</div>
                        <div className="text-base font-black text-white font-mono">
                          {lineTotal.toLocaleString()} {currency}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    {/* Stepper */}
                    <div className="flex items-center gap-1.5 bg-[#011C2B] rounded-2xl p-1.5 border border-white/15 shrink-0">
                      <button
                        onClick={() => handleDecrement(p.id, 1)}
                        disabled={qty <= 0}
                        className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-white flex items-center justify-center transition-colors"
                        title="إنقاص قطعة"
                      >
                        <Minus className="w-4 h-4" />
                      </button>

                      <input
                        type="number"
                        min="0"
                        value={qty === 0 ? '' : qty}
                        onChange={(e) => handleSetQuantity(p.id, parseInt(e.target.value, 10))}
                        placeholder="0"
                        className="w-20 bg-transparent text-center font-mono font-black text-lg text-white focus:outline-none placeholder-sky-200/40"
                      />

                      <button
                        onClick={() => handleIncrement(p.id, 1)}
                        className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 active:scale-95 text-[#01334E] flex items-center justify-center transition-colors font-bold shadow-md"
                        title="إضافة قطعة"
                      >
                        <Plus className="w-4 h-4 stroke-[3]" />
                      </button>
                    </div>

                    {/* Quick Steps */}
                    <div className="flex items-center gap-1.5">
                      {[1, 5, 10, 25].map((step) => (
                        <button
                          key={step}
                          onClick={() => handleIncrement(p.id, step)}
                          className="px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono text-xs font-bold transition-colors"
                        >
                          +{step}
                        </button>
                      ))}
                    </div>

                    {qty > 0 && (
                      <button
                        onClick={() => {
                          setSelectedProductDetails(null);
                          setIsCartOpen(true);
                        }}
                        className="mr-auto px-4 py-2.5 rounded-xl bg-white text-[#01334E] hover:bg-slate-100 text-xs font-black transition-all flex items-center gap-2 shadow-md"
                      >
                        <span>متابعة السلة</span>
                        <ArrowRight className="w-4 h-4 rotate-180" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-white/15 bg-[#012336] flex items-center justify-between">
                <span className="text-xs text-sky-200">
                  {qty > 0 ? (
                    <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                      <Check className="w-4 h-4" />
                      تمت إضافة {qty} قطعة من هذا المنتج إلى سلتك
                    </span>
                  ) : (
                    'يمكنك زيادة الكمية المطلوبة وإغلاق النافذة لمواصلة التصفح'
                  )}
                </span>
                <button
                  onClick={() => setSelectedProductDetails(null)}
                  className="px-5 py-2 rounded-xl bg-white hover:bg-slate-100 text-[#01334E] text-xs font-black transition-colors shadow-md"
                >
                  تم / متابعة التصفح
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Zoom Image Modal */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md cursor-pointer animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-4 max-w-lg w-full max-h-[85vh] flex flex-col items-center shadow-2xl"
          >
            <div className="w-full flex justify-between items-center pb-2 border-b border-slate-100 text-slate-800 mb-2">
              <span className="font-bold text-xs line-clamp-1">{zoomedImage.title}</span>
              <button
                onClick={() => setZoomedImage(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="w-full aspect-square flex items-center justify-center p-4">
              <img
                src={zoomedImage.src}
                alt={zoomedImage.title}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
