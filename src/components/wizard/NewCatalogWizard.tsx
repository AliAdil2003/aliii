'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  HelpCircle,
  Eye,
  AlertCircle,
  X,
  FileCheck,
  RefreshCw,
  Warehouse,
  ShoppingBag,
  Tag,
  Filter,
} from 'lucide-react';
import {
  parseCatalogFile,
  RawParseResult,
  mapRowsToProducts,
  detectDuplicateBarcodes,
  DuplicateBarcodeGroup,
} from '@/lib/excel/parser';
import { autoDetectColumns } from '@/lib/excel/columnDetector';
import { ColumnMapping, Project, Product } from '@/types';
import { defaultTemplates } from '@/lib/templates/defaultTemplates';
import { AppService } from '@/lib/appwrite/service';
import DuplicateBarcodeModal from './DuplicateBarcodeModal';

interface NewCatalogWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (projectId: string) => void;
}

const FIELD_DEFINITIONS: {
  key: keyof ColumnMapping;
  label: string;
  required: boolean;
  hint: string;
}[] = [
  { key: 'productName', label: 'اسم المنتج / اسم العرض', required: true, hint: 'الاسم الرئيسي الذي سيظهر في الكتالوج' },
  { key: 'description', label: 'وصف المنتج', required: false, hint: 'النص التفصيلي أو المواصفات' },
  { key: 'barcode', label: 'الباركود', required: false, hint: 'رمز الترقيم الدولي (EAN-13 أو UPC)' },
  { key: 'customerPrice', label: 'سعر بيع الزبون (المفرد)', required: true, hint: 'سعر البيع النهائي للمستهلك / الزبون' },
  { key: 'salePrice', label: 'سعر البيع (الجملة / القياسي)', required: false, hint: 'سعر البيع القياسي أو سعر الجملة' },
  { key: 'stock', label: 'الكمية في اليد / المخزون', required: true, hint: 'يستخدم لفلترة المنتجات (مثل stock < 5)' },
  { key: 'image', label: 'صورة المنتج (رابط أو Base64)', required: false, hint: 'يدعم Base64 WebP, PNG, JPG أو روابط ويب' },
  { key: 'category', label: 'الفئة / التصنيف', required: false, hint: 'لتصنيف وترتيب المنتجات' },
  { key: 'internalReference', label: 'المرجع الداخلي (Ref / SKU)', required: false, hint: 'كود الصنف أو الموديل الخاص' },
  { key: 'unit', label: 'نوع الوحدة', required: false, hint: 'قطعة، كرتون، لتر، إلخ' },
  { key: 'currency', label: 'العملة', required: false, hint: 'مثل د.ع أو IQD' },
  { key: 'availableQuantity', label: 'الكمية المتاحة', required: false, hint: 'رصيد البيع الفعلي' },
];

export default function NewCatalogWizard({ isOpen, onClose, onCreated }: NewCatalogWizardProps) {
  const router = useRouter();

  // Wizard Steps: 1: Info, 2: Upload, 3: Mapping
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [projectName, setProjectName] = useState('');
  const [enrichWithShopify, setEnrichWithShopify] = useState(true);

  // Odoo category & brand selection state
  const [odooCategories, setOdooCategories] = useState<{ id: number; name: string; displayName: string }[]>([]);
  const [selectedOdooCategory, setSelectedOdooCategory] = useState<string>('all');
  const [odooStockFilter, setOdooStockFilter] = useState<'all' | 'with_stock'>('all');
  const [odooLimit, setOdooLimit] = useState<number>(500);
  const [loadingCategories, setLoadingCategories] = useState<boolean>(false);

  // Function to load Odoo categories
  const loadOdooCategoriesList = async () => {
    try {
      setLoadingCategories(true);
      const res = await fetch('/api/odoo/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loadCategories: true, categoriesOnly: true, limit: 0, includeImages: false }),
      });
      const data = await res.json();
      if (data.categories && Array.isArray(data.categories) && data.categories.length > 0) {
        setOdooCategories(data.categories);
      }
    } catch (err) {
      console.log('Odoo categories preload error in wizard:', err);
    } finally {
      setLoadingCategories(false);
    }
  };

  // Preload Odoo categories on wizard open or step change
  useEffect(() => {
    if (isOpen) {
      loadOdooCategoriesList();
    }
  }, [isOpen]);

  const [parsedData, setParsedData] = useState<RawParseResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    productName: '',
    description: '',
    barcode: '',
    category: '',
    customerPrice: '',
    salePrice: '',
    price: '',
    stock: '',
    image: '',
    internalReference: '',
    unit: '',
    currency: '',
    availableQuantity: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateBarcodeGroup[]>([]);
  const [pendingProducts, setPendingProducts] = useState<Product[]>([]);
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);

  if (!isOpen) return null;

  // Step 2: Handle File Upload
  const handleFileUpload = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const result = await parseCatalogFile(file);
      setParsedData(result);

      // Auto-detect columns
      const detectedMapping = autoDetectColumns(result.headers);
      setColumnMapping(detectedMapping);

      if (!projectName) {
        setProjectName(file.name.replace(/\.[^/.]+$/, ''));
      }
      setCurrentStep(3);
    } catch (err: any) {
      setError(err.message || 'فشل قراءة الملف. يرجى التأكد من صلاحية الملف.');
    } finally {
      setLoading(false);
    }
  };

  // Load Built-in Sample Excel
  const handleLoadSample = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sample-data');
      if (!res.ok) throw new Error('فشل جلب ملف العينة');
      const blob = await res.blob();
      const file = new File([blob], 'moxedo_sample_catalog.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      await handleFileUpload(file);
      setProjectName('كتالوج أجهزة MOXEDO (عينة تجريبية)');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Import Products Directly from Odoo ERP Warehouse (All or by specific Brand/Category)
  const handleImportFromOdoo = async () => {
    setLoading(true);
    setError(null);
    try {
      const categoryId = selectedOdooCategory === 'all' ? undefined : Number(selectedOdooCategory);
      const onlyWithStock = odooStockFilter === 'with_stock';

      const res = await fetch('/api/odoo/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limit: odooLimit || 500,
          categoryId,
          onlyWithStock,
          includeImages: true,
          enrichWithShopify: enrichWithShopify,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'فشل جلب المنتجات من Odoo');
      }

      if (!data.products || data.products.length === 0) {
        throw new Error('لم يتم العثور على أي منتجات مطابقة في Odoo.');
      }

      const foundCat = odooCategories.find((c) => String(c.id) === selectedOdooCategory);
      const brandLabel = foundCat ? foundCat.displayName || foundCat.name : '';

      const matchMsg = data.shopifyMatchedCount
        ? ` (تم دمج أوصاف وروابط شوبيفاي لـ ${data.shopifyMatchedCount} منتج)`
        : '';

      const defaultName = brandLabel
        ? `كتالوج براند: ${brandLabel} (${new Date().toLocaleDateString('ar-EG')})`
        : `كتالوج مخزن Odoo ${matchMsg} (${new Date().toLocaleDateString('ar-EG')})`;

      const targetProjectName = projectName.trim() || defaultName;
      const projectId = 'proj_' + Date.now();
      await finalizeProjectCreation(projectId, data.products, targetProjectName);
    } catch (err: any) {
      setError(err.message || 'تعذر الاتصال بـ Odoo. يرجى مراجعة إعدادات Odoo في صفحة الإعدادات.');
      setLoading(false);
    }
  };

  // Step 3: Complete Project Creation
  const handleComplete = async () => {
    if (!parsedData) return;
    if (!parsedData.rows || parsedData.rows.length === 0) {
      setError('لا توجد أي صفوف بيانات في هذا الملف.');
      return;
    }
    if (!columnMapping.productName) {
      setError('يرجى تحديد عمود "اسم المنتج" على الأقل.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const projectId = 'proj_' + Date.now();
      const products = mapRowsToProducts(parsedData.rows, columnMapping, projectId);

      if (products.length === 0) {
        setError('لم يتم العثور على أي منتجات صالحة للاستيراد في الملف.');
        setLoading(false);
        return;
      }

      // Check for duplicate barcodes
      const detectedDuplicates = detectDuplicateBarcodes(products);
      if (detectedDuplicates.length > 0) {
        setDuplicates(detectedDuplicates);
        setPendingProducts(products);
        setShowDuplicatesModal(true);
        setLoading(false);
        return;
      }

      await finalizeProjectCreation(projectId, products);
    } catch (err: any) {
      console.error('Error in handleComplete:', err);
      setError(err.message || 'حدث خطأ أثناء معالجة وحفظ المشروع');
      setLoading(false);
    }
  };

  const finalizeProjectCreation = async (
    projectId: string,
    products: Product[],
    customProjectName?: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      const user = await AppService.getCurrentUser();
      const effectiveName = customProjectName || projectName.trim() || 'كتالوج منتجات جديد';
      const effectiveMapping = columnMapping.productName
        ? columnMapping
        : {
            productName: 'اسم المنتج',
            description: 'وصف المنتج',
            barcode: 'الباركود',
            category: 'الفئة',
            customerPrice: 'سعر بيع الزبون',
            salePrice: 'سعر البيع',
            price: 'سعر بيع الزبون',
            stock: 'الكمية في اليد',
            image: 'الصورة',
            internalReference: 'مرجع داخلي',
            unit: 'الوحدة',
            currency: 'العملة',
            availableQuantity: 'الكمية المتاحة',
          };

      const newProject: Project = {
        id: projectId,
        userId: user?.id || 'usr_default',
        name: effectiveName,
        fileName: parsedData?.fileName || 'odoo_live_inventory',
        fileSize: parsedData?.fileSize || 0,
        rowCount: products.length,
        columnCount: parsedData?.columnCount || 10,
        detectedColumns: parsedData?.headers || [
          'اسم المنتج',
          'باركود',
          'سعر بيع الزبون',
          'الكمية في اليد',
          'مرجع داخلي',
        ],
        columnMapping: effectiveMapping,
        settings: {
          templateId: 'moxedo_default',
          template: defaultTemplates[0],
          stockFilter: { mode: 'all' },
          defaultCurrency: 'د.ع',
          currencyPosition: 'suffix',
        },
        productCount: products.length,
        includedProductCount: products.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 1. Save project and products safely
      await AppService.saveProject(newProject);
      await AppService.saveProducts(projectId, products);

      // 2. Navigate smoothly
      if (onCreated) {
        onCreated(projectId);
      } else {
        router.push(`/project/${projectId}`);
      }

      // Close modal smoothly after navigation starts
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: any) {
      console.error('Finalize project error:', err);
      setError(err.message || 'حدث خطأ أثناء حفظ المشروع في المتصفح وقاعدة البيانات.');
      setLoading(false);
    }
  };

  const handleDuplicateResolved = async (resolvedProducts: Product[]) => {
    try {
      setShowDuplicatesModal(false);
      const projectId = 'proj_' + Date.now();
      await finalizeProjectCreation(projectId, resolvedProducts);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء معالجة الباركودات المكررة');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
      <div className="bg-white rounded-[32px] max-w-3xl w-full border border-black/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#01334E] text-white px-7 py-5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white text-[#01334E] flex items-center justify-center font-bold shadow-md">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black font-cairo text-white">
                معالج إنشاء كتالوج جديد
              </h2>
              <p className="text-xs text-slate-400">
                استيراد المنتجات من مخزن Odoo أو Excel وتجهيزها للطباعة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Indicator */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3">
          <div className="flex items-center justify-between text-xs font-bold">
            <div
              className={`flex items-center gap-2 ${
                currentStep >= 1 ? 'text-sky-600' : 'text-slate-400'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  currentStep >= 1 ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                1
              </span>
              <span>اسم المشروع</span>
            </div>

            <div className="flex-1 h-0.5 bg-slate-200 mx-4" />

            <div
              className={`flex items-center gap-2 ${
                currentStep >= 2 ? 'text-sky-600' : 'text-slate-400'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  currentStep >= 2 ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                2
              </span>
              <span>رفع ملف Excel / CSV</span>
            </div>

            <div className="flex-1 h-0.5 bg-slate-200 mx-4" />

            <div
              className={`flex items-center gap-2 ${
                currentStep >= 3 ? 'text-sky-600' : 'text-slate-400'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  currentStep >= 3 ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                3
              </span>
              <span>مطابقة الأعمدة والبيانات</span>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Wizard Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* STEP 1: Project Name */}
          {currentStep === 1 && (
            <div className="space-y-6 max-w-lg mx-auto py-6">
              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-900 font-cairo">
                  ما هو اسم الكتالوج أو المشروع؟
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  يمكنك استخدام اسم شركتك أو العلامة التجارية مع تاريخ الإصدار
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اسم المشروع
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="مثال: كتالوج موكسيدو خريف 2026"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 flex items-start gap-3 text-xs text-sky-800">
                <Sparkles className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
                <p>
                  بعد إدخال الاسم، سنقوم في الخطوة التالية برفع ملف الـ Excel أو CSV واستخراج الصور
                  وبيانات الأسعار والمخزون تلقائياً.
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: File Upload */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-900 font-cairo">
                  رفع ملف بيانات المنتجات
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  يدعم ملفات .xlsx و .xls و .csv (حتى 5000 منتج والصور المدمجة بصيغة Base64)
                </p>
              </div>

              {/* Upload Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                className="border-2 border-dashed border-slate-300 hover:border-sky-500 rounded-2xl p-8 text-center transition-colors bg-slate-50 hover:bg-sky-50/30 cursor-pointer flex flex-col items-center justify-center relative"
              >
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="w-14 h-14 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center mb-3 shadow-inner">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <p className="text-sm font-bold text-slate-800 mb-1">
                  اسحب وأفلت ملف Excel هنا أو اضغط للتصفح
                </p>
                <p className="text-xs text-slate-400">
                  الصيغ المدعومة: XLSX, XLS, CSV (بما فيها خلايا Base64 للصور)
                </p>
              </div>

              {/* Sample Excel One-Click Trigger */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      ليس لديك ملف Excel جاهز الآن؟
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      استخدم ملف عينة واقعي (منتجات MOXEDO مع باركودات وصور Base64 ومخزون)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLoadSample}
                  disabled={loading}
                  className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors shadow-sm"
                >
                  تحميل عينة MOXEDO
                </button>
              </div>

              {/* Direct Odoo Warehouse Import Card */}
              <div className="p-4 rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-white to-indigo-50/40 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-3 border-b border-indigo-100/80 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-600/20">
                      <Warehouse className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <span>استيراد المنتجات مباشرة من مخزن Odoo ERP</span>
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                          تكامل المخزن
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        يمكنك استيراد جميع المنتجات أو تحديد براند معين، مع جلب المخزون والأسعار والصور واستبعاد التكلفة.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Brand & Stock Filters Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Brand / Category Selection */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-indigo-600" />
                        <span>البراند أو الفئة من Odoo:</span>
                      </span>
                      <div className="flex items-center gap-1">
                        {loadingCategories ? (
                          <span className="text-[10px] text-indigo-600 flex items-center gap-1">
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                            جاري جلب الفئات...
                          </span>
                        ) : odooCategories.length > 0 ? (
                          <span className="text-[10px] text-emerald-600 font-bold">
                            ({odooCategories.length} فئة متوفرة)
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => loadOdooCategoriesList()}
                          disabled={loadingCategories}
                          title="تحديث قائمة الفئات والبراندات"
                          className="p-1 rounded-md hover:bg-indigo-100 text-indigo-600 transition-colors"
                        >
                          <RefreshCw className={`w-3 h-3 ${loadingCategories ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    </label>
                    <select
                      value={selectedOdooCategory}
                      onChange={(e) => setSelectedOdooCategory(e.target.value)}
                      disabled={loadingCategories && odooCategories.length === 0}
                      className="w-full bg-white border border-indigo-200 rounded-xl p-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-xs disabled:opacity-60"
                    >
                      <option value="all">⭐ استيراد جميع المنتجات والبراندات (المخزن بالكامل)</option>
                      {loadingCategories && odooCategories.length === 0 && (
                        <option disabled value="">⏳ جاري الاتصال بـ Odoo وتحميل الفئات...</option>
                      )}
                      {odooCategories.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.displayName || c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Stock Filter */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5 text-indigo-600" />
                      <span>فلتر المخزون المتوفر:</span>
                    </label>
                    <select
                      value={odooStockFilter}
                      onChange={(e) => setOdooStockFilter(e.target.value as any)}
                      className="w-full bg-white border border-indigo-200 rounded-xl p-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-xs"
                    >
                      <option value="all">كافة المنتجات (المتوفرة والمنتهية)</option>
                      <option value="with_stock">المنتجات المتوفرة في المخزن فقط (المخزون &gt; 0)</option>
                    </select>
                  </div>
                </div>

                {/* Shopify Description & Purchase Links Integration Option & Action Button */}
                <div className="pt-2 border-t border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-indigo-950 font-bold">
                    <input
                      type="checkbox"
                      checked={enrichWithShopify}
                      onChange={(e) => setEnrichWithShopify(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
                    />
                    <div className="flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                      <span>دمج الأوصاف التسويقية وروابط الشراء المباشرة من متجر Shopify (ezoneiraq.com)</span>
                    </div>
                  </label>

                  <button
                    type="button"
                    onClick={handleImportFromOdoo}
                    disabled={loading}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap self-end sm:self-auto"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Warehouse className="w-4 h-4" />
                    )}
                    <span>
                      {selectedOdooCategory !== 'all'
                        ? `استيراد براند ${odooCategories.find((c) => String(c.id) === selectedOdooCategory)?.name || ''} الآن`
                        : 'جلب المنتجات من Odoo الآن'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Column Mapping */}
          {currentStep === 3 && parsedData && (
            <div className="space-y-6">
              {/* File Summary Bar */}
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between text-xs gap-3">
                <div className="flex items-center gap-2 text-sky-900 font-bold">
                  <FileCheck className="w-4 h-4 text-sky-600" />
                  <span>الملف: {parsedData.fileName}</span>
                </div>
                <div className="flex items-center gap-4 text-sky-700 font-medium">
                  <span>عدد الصفوف: {parsedData.rowCount}</span>
                  <span>عدد الأعمدة: {parsedData.columnCount}</span>
                </div>
              </div>

              <div className="border-b border-slate-200 pb-2">
                <h3 className="text-sm font-bold text-slate-900 font-cairo">
                  مطابقة أعمدة الملف مع حقول الكتالوج
                </h3>
                <p className="text-xs text-slate-500">
                  تم اكتشاف الأعمدة تلقائياً بناءً على أسماء الحقول. يمكنك تعديل أي حقل يدوياً:
                </p>
              </div>

              {/* Mapping Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {FIELD_DEFINITIONS.map((field) => (
                  <div
                    key={field.key}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        {field.label}
                        {field.required && (
                          <span className="text-[10px] text-rose-500 font-bold">*</span>
                        )}
                      </label>
                      <span className="text-[10px] text-slate-400">{field.hint}</span>
                    </div>

                    <select
                      value={columnMapping[field.key] || ''}
                      onChange={(e) =>
                        setColumnMapping({
                          ...columnMapping,
                          [field.key]: e.target.value,
                        })
                      }
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="">-- غير متوفر (Not available) --</option>
                      {parsedData.headers.map((hdr) => (
                        <option key={hdr} value={hdr}>
                          {hdr}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Sample Data Preview Row */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-sky-600" />
                  معاينة أول صف من الملف بعد المطابقة:
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                  <div className="p-2 rounded bg-slate-50">
                    <span className="text-slate-400 block text-[10px]">الاسم:</span>
                    <span className="font-bold text-slate-800 line-clamp-1">
                      {parsedData.rows[0]?.[columnMapping.productName] || '-'}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-50">
                    <span className="text-slate-400 block text-[10px]">سعر بيع الزبون:</span>
                    <span className="font-bold text-sky-600">
                      {parsedData.rows[0]?.[columnMapping.customerPrice] || parsedData.rows[0]?.[columnMapping.price] || '-'}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-50">
                    <span className="text-slate-400 block text-[10px]">سعر البيع:</span>
                    <span className="font-bold text-slate-700">
                      {parsedData.rows[0]?.[columnMapping.salePrice] || '-'}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-50">
                    <span className="text-slate-400 block text-[10px]">المخزون:</span>
                    <span className="font-bold text-slate-800">
                      {parsedData.rows[0]?.[columnMapping.stock] || '0'}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-50">
                    <span className="text-slate-400 block text-[10px]">الباركود:</span>
                    <span className="font-bold font-inter text-slate-800">
                      {parsedData.rows[0]?.[columnMapping.barcode] || '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                disabled={loading}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1.5"
              >
                <ArrowRight className="w-4 h-4" />
                السابق
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
            >
              إلغاء
            </button>

            {currentStep === 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-colors flex items-center gap-2 shadow-sm"
              >
                التالي: رفع الملف
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            {currentStep === 3 && (
              <button
                type="button"
                onClick={handleComplete}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-slate-950 text-xs font-bold transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    جاري استيراد المنتجات...
                  </>
                ) : (
                  <>
                    إنشاء الكتالوج وفتح الاستوديو
                    <ArrowLeft className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Duplicate Barcode Modal */}
      <DuplicateBarcodeModal
        isOpen={showDuplicatesModal}
        duplicates={duplicates}
        products={pendingProducts}
        onClose={() => setShowDuplicatesModal(false)}
        onResolve={handleDuplicateResolved}
      />
    </div>
  );
}
