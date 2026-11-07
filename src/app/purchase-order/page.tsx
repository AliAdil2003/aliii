'use client';

import React, { useState, useMemo, useRef, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  FileSpreadsheet,
  Upload,
  Search,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Download,
  Printer,
  Package,
  Layers,
  Filter,
  Trash2,
  Plus,
  Minus,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Eye,
  SlidersHorizontal,
  X,
  FileCheck,
  Building2,
  AlertTriangle,
  Save,
  FolderKanban,
} from 'lucide-react';
import {
  PurchaseOrder,
  PurchaseOrderItem,
  ColumnMapping,
  ImageStatus,
  PurchaseOrderTableDesign,
  Project,
  Product,
} from '@/types';
import { parseCatalogFile, RawParseResult, cleanInternalRefFromName } from '@/lib/excel/parser';
import { autoDetectColumns } from '@/lib/excel/columnDetector';
import { extractAndNormalizeImage } from '@/lib/images/base64Extractor';
import { AppService } from '@/lib/appwrite/service';
import { defaultTemplates } from '@/lib/templates/defaultTemplates';
import PurchaseOrderStudio from '@/components/purchase-order/PurchaseOrderStudio';
import { createDefaultPurchaseOrderDesign } from '@/lib/purchase-order/defaultDesign';

function PurchaseOrderContent() {
  const searchParams = useSearchParams();
  const projectIdParam = searchParams.get('id') || searchParams.get('projectId');

  // Wizard steps: 1 = Upload & Map, 2 = Select & Quantities, 3 = Preview & Export
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Project persistence state
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [projectSaveSuccess, setProjectSaveSuccess] = useState<string | null>(null);
  const [isLoadingSavedProject, setIsLoadingSavedProject] = useState(false);

  // Supplier info & file state
  const [supplierName, setSupplierName] = useState<string>('ماكس سيدو Moxedo');
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [availableHeaders, setAvailableHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    productName: '',
    description: '',
    barcode: '',
    category: '',
    salePrice: '',
    customerPrice: '',
    price: '',
    stock: '',
    image: '',
    internalReference: '',
    unit: '',
    currency: '',
    availableQuantity: '',
  });

  // Loading & parsing states
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Working products list
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [orderNotes, setOrderNotes] = useState<string>('');

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'zero' | 'low' | 'selected_only'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Preview image modal
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string } | null>(null);

  // Exporting state
  const [isExporting, setIsExporting] = useState<'xlsx' | 'pdf' | null>(null);
  const [copiedBarcode, setCopiedBarcode] = useState<string | null>(null);
  const [batchQuantityInput, setBatchQuantityInput] = useState<number>(10);
  const [exportShowStock, setExportShowStock] = useState<boolean>(false);
  const [exportShowPrice, setExportShowPrice] = useState<boolean>(false);

  // Table Designer Studio State
  const [design, setDesign] = useState<PurchaseOrderTableDesign>(() =>
    createDefaultPurchaseOrderDesign('ماكس سيدو Moxedo')
  );

  // Odoo ERP Import & Sync State
  const [odooCategories, setOdooCategories] = useState<{ id: number; name: string; displayName: string }[]>([]);
  const [selectedOdooCategory, setSelectedOdooCategory] = useState<string>('all');
  const [odooStockFilter, setOdooStockFilter] = useState<'all' | 'with_stock' | 'zero_stock'>('all');
  const [odooImportLimit, setOdooImportLimit] = useState<number>(500);
  const [odooIncludeImages, setOdooIncludeImages] = useState<boolean>(true);
  const [isImportingFromOdoo, setIsImportingFromOdoo] = useState(false);
  const [isSyncingOdoo, setIsSyncingOdoo] = useState(false);
  const [odooSyncNotification, setOdooSyncNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Load saved project from URL param (?id=xxx or ?projectId=xxx)
  useEffect(() => {
    if (projectIdParam) {
      setIsLoadingSavedProject(true);
      AppService.getProject(projectIdParam)
        .then(async (proj) => {
          if (proj) {
            setCurrentProjectId(proj.id);
            if (proj.purchaseOrderData) {
              setSupplierName(proj.purchaseOrderData.supplierName || proj.name);
              setFileName(proj.purchaseOrderData.fileName || proj.fileName || '');
              setItems(proj.purchaseOrderData.items || []);
              if (proj.purchaseOrderData.design) {
                setDesign(proj.purchaseOrderData.design);
              }
              if (proj.purchaseOrderData.notes) {
                setOrderNotes(proj.purchaseOrderData.notes);
              }
              if (proj.purchaseOrderData.items && proj.purchaseOrderData.items.length > 0) {
                const hasSelected = proj.purchaseOrderData.items.some(
                  (i) => i.selected && i.requestedQuantity > 0
                );
                setStep(hasSelected ? 3 : 2);
              }
            } else {
              setSupplierName(proj.name);
              setFileName(proj.fileName || '');
              const prods = await AppService.getProducts(proj.id);
              if (prods && prods.length > 0) {
                const converted: PurchaseOrderItem[] = prods.map((p) => ({
                  id: p.id,
                  productName: p.name,
                  barcode: p.barcode,
                  category: p.category || 'عام',
                  internalReference: p.internalReference || '',
                  imageData: p.imageData,
                  imageStatus: p.imageStatus,
                  currentStock: p.stock,
                  customerPrice: p.customerPrice || p.price,
                  salePrice: p.salePrice,
                  requestedQuantity: 0,
                  selected: p.includedInCatalog,
                  odooId: p.odooId,
                }));
                setItems(converted);
                setStep(2);
              }
            }
          }
        })
        .catch((err) => console.error('Error loading saved PO project:', err))
        .finally(() => setIsLoadingSavedProject(false));
    }
  }, [projectIdParam]);

  // ==========================================
  // Save Purchase Order to Projects & Catalogs
  // ==========================================
  const handleSaveProject = async () => {
    if (items.length === 0) {
      alert('يرجى استيراد أو إضافة منتجات في الطلبية قبل حفظها كمشروع.');
      return;
    }

    try {
      setIsSavingProject(true);
      setProjectSaveSuccess(null);

      const projId = currentProjectId || `proj_po_${Date.now()}`;
      const poPayload: PurchaseOrder = {
        id: projId,
        supplierName: supplierName.trim() || 'المورد',
        fileName: fileName || `طلبية_${supplierName}_${new Date().toISOString().slice(0, 10)}`,
        items: items,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notes: orderNotes,
        totalItems: items.length,
        totalSelectedItems: selectedItems.length,
        totalRequestedQuantity,
        design: design,
      };

      const projectData: Project = {
        id: projId,
        userId: 'usr_default',
        name: `طلبية مورد: ${supplierName.trim() || 'طلب شراء'} (${selectedItems.length > 0 ? selectedItems.length : items.length} صنف)`,
        fileName: fileName || `طلبية_${supplierName}.xlsx`,
        rowCount: items.length,
        columnCount: 10,
        detectedColumns: ['productName', 'barcode', 'category', 'currentStock', 'requestedQuantity'],
        columnMapping: {
          productName: 'اسم المنتج',
          description: '',
          barcode: 'الباركود',
          category: 'الفئة',
          customerPrice: 'سعر الزبون',
          salePrice: 'سعر البيع',
          price: 'سعر الزبون',
          stock: 'المخزون الحالي',
          image: 'الصورة',
          internalReference: 'المرجع الداخلي',
          unit: 'قطعة',
          currency: 'د.ع',
          availableQuantity: '',
        },
        settings: {
          template: defaultTemplates[0],
          stockFilter: { mode: 'all' },
          defaultCurrency: 'د.ع',
          currencyPosition: 'suffix',
        },
        productCount: items.length,
        includedProductCount: selectedItems.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type: 'purchase_order',
        purchaseOrderData: poPayload,
      };

      await AppService.saveProject(projectData);

      const productsToSave: Product[] = items.map((item, idx) => ({
        id: item.id,
        projectId: projId,
        name: item.productName,
        originalName: item.productName,
        originalDescription: item.notes || '',
        shortenedDescription: '',
        activeDescriptionType: 'original',
        barcode: item.barcode,
        price: item.customerPrice,
        customerPrice: item.customerPrice,
        salePrice: item.salePrice,
        stock: item.currentStock,
        category: item.category,
        internalReference: item.internalReference,
        imageData: item.imageData,
        imageStatus: item.imageStatus,
        includedInCatalog: item.selected,
        order: idx + 1,
        odooId: item.odooId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      await AppService.saveProducts(projId, productsToSave);

      setCurrentProjectId(projId);
      setProjectSaveSuccess('تم حفظ مشروع الطلبية بنجاح في المشاريع والكتالوجات!');
      setTimeout(() => setProjectSaveSuccess(null), 3500);
    } catch (err: any) {
      console.error('Save project error:', err);
      alert('حدث خطأ أثناء حفظ المشروع: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setIsSavingProject(false);
    }
  };

  // Preload Odoo categories on page load
  useEffect(() => {
    fetch('/api/odoo/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loadCategories: true, categoriesOnly: true, limit: 0, includeImages: false }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.categories && Array.isArray(data.categories) && data.categories.length > 0) {
          setOdooCategories(data.categories);
        }
      })
      .catch((err) => console.log('Odoo categories preload error:', err));
  }, []);

  useEffect(() => {
    if (supplierName) {
      setDesign((prev) => ({
        ...prev,
        orderTitle: `طلب شراء مواد - ${supplierName}`,
      }));
    }
  }, [supplierName]);

  // ==========================================
  // Odoo: Import Products (All or By Brand/Category)
  // ==========================================
  const handleImportFromOdoo = async () => {
    try {
      setIsImportingFromOdoo(true);
      setParseError(null);

      const categoryId = selectedOdooCategory === 'all' ? undefined : Number(selectedOdooCategory);
      const onlyWithStock = odooStockFilter === 'with_stock';

      const res = await fetch('/api/odoo/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId,
          onlyWithStock,
          limit: odooImportLimit,
          includeImages: odooIncludeImages,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'فشل جلب المنتجات من Odoo');
      }

      let fetchedProducts = data.products || [];

      // Filter zero stock on client side if specifically selected
      if (odooStockFilter === 'zero_stock') {
        fetchedProducts = fetchedProducts.filter((p: any) => (p.stock || 0) === 0);
      }

      if (fetchedProducts.length === 0) {
        throw new Error('لم يتم العثور على أي منتجات مطابقة في مخزن Odoo.');
      }

      // Determine supplier name based on selected category/brand
      let brandName = 'مخزن Odoo ERP';
      if (selectedOdooCategory !== 'all') {
        const foundCat = odooCategories.find((c) => String(c.id) === selectedOdooCategory);
        if (foundCat) {
          brandName = foundCat.displayName || foundCat.name;
        }
      }

      setSupplierName(brandName);
      setFileName(`استيراد_Odoo_${brandName}_${new Date().toISOString().slice(0, 10)}`);

      // Convert Odoo products into PurchaseOrderItem[]
      const parsedItems: PurchaseOrderItem[] = fetchedProducts.map((p: any, idx: number) => {
        const customerPriceNum =
          typeof p.customerPrice === 'number'
            ? p.customerPrice
            : parseFloat(p.customerPrice) || 0;
        const salePriceNum =
          typeof p.salePrice === 'number'
            ? p.salePrice
            : parseFloat(p.salePrice) || 0;

        return {
          id: p.id || `odoo_${p.odooId || idx}`,
          odooId: p.odooId,
          productName: p.name || p.displayName || `منتج #${idx + 1}`,
          barcode: p.barcode || '',
          category: p.category || brandName || 'عام',
          internalReference: p.internalReference || '',
          imageData: p.imageData || '',
          imageStatus: p.imageStatus || (p.imageData ? 'valid' : 'none'),
          currentStock: typeof p.stock === 'number' ? p.stock : 0,
          customerPrice: customerPriceNum,
          salePrice: salePriceNum,
          requestedQuantity: 0,
          notes: '',
          selected: false,
        };
      });

      setItems(parsedItems);
      // Auto advance to selection step!
      setStep(2);
    } catch (err: any) {
      console.error('Odoo import error:', err);
      setParseError(err.message || 'تعذر استيراد المنتجات من Odoo. يرجى مراجعة إعدادات الربط.');
    } finally {
      setIsImportingFromOdoo(false);
    }
  };

  // ==========================================
  // Odoo: Sync Stock & Prices for current items
  // ==========================================
  const handleSyncFromOdoo = async () => {
    if (items.length === 0) {
      alert('لا توجد منتجات في القائمة لتحديث كمياتها وأسعارها.');
      return;
    }

    try {
      setIsSyncingOdoo(true);
      setOdooSyncNotification(null);

      const syncPayload = items.map((item) => ({
        id: item.id,
        odooId: item.odooId,
        barcode: item.barcode,
        internalReference: item.internalReference,
      }));

      const res = await fetch('/api/odoo/sync-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: syncPayload }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'فشلت المزامنة مع Odoo');
      }

      let updatedCount = data.updatedCount || 0;
      let newCount = data.newCount || 0;

      if (data.updates && data.updates.length > 0) {
        const updateMap = new Map<string, any>(data.updates.map((u: any) => [u.id, u]));

        setItems((prev) => {
          let updated = prev.map((item) => {
            const u = updateMap.get(item.id);
            if (u) {
              return {
                ...item,
                currentStock: u.stock !== undefined ? u.stock : item.currentStock,
                customerPrice: u.customerPrice !== undefined ? u.customerPrice : item.customerPrice,
                salePrice: u.salePrice !== undefined ? u.salePrice : item.salePrice,
                odooId: u.odooId || item.odooId,
              };
            }
            return item;
          });

          // Append newly discovered products from Odoo if any
          if (data.newProducts && Array.isArray(data.newProducts) && data.newProducts.length > 0) {
            const newOrderItems: PurchaseOrderItem[] = data.newProducts.map((np: any) => ({
              id: np.id,
              productName: np.name,
              barcode: np.barcode || '',
              category: np.category || supplierName || 'عام',
              internalReference: np.internalReference || '',
              imageData: np.imageData,
              imageStatus: np.imageStatus || 'missing',
              currentStock: np.stock || 0,
              customerPrice: np.customerPrice || 0,
              salePrice: np.salePrice || 0,
              requestedQuantity: 0,
              selected: false,
              odooId: np.odooId,
            }));
            updated = [...updated, ...newOrderItems];
          }

          return updated;
        });

        let successMsg = `تم تحديث كميات وأسعار ${updatedCount} منتج مباشرة من مخزن Odoo بنجاح!`;
        if (newCount > 0) {
          successMsg = `تم تحديث ${updatedCount} منتج وإضافة ${newCount} منتج جديد من Odoo للملف تلقائياً!`;
        }

        setOdooSyncNotification({
          type: 'success',
          message: successMsg,
        });
      } else if (data.newProducts && Array.isArray(data.newProducts) && data.newProducts.length > 0) {
        const newOrderItems: PurchaseOrderItem[] = data.newProducts.map((np: any) => ({
          id: np.id,
          productName: np.name,
          barcode: np.barcode || '',
          category: np.category || supplierName || 'عام',
          internalReference: np.internalReference || '',
          imageData: np.imageData,
          imageStatus: np.imageStatus || 'missing',
          currentStock: np.stock || 0,
          customerPrice: np.customerPrice || 0,
          salePrice: np.salePrice || 0,
          requestedQuantity: 0,
          selected: false,
          odooId: np.odooId,
        }));
        setItems((prev) => [...prev, ...newOrderItems]);
        setOdooSyncNotification({
          type: 'success',
          message: `تمت إضافة ${newOrderItems.length} منتج جديد من مخزن Odoo إلى الملف بنجاح!`,
        });
      } else {
        setOdooSyncNotification({
          type: 'error',
          message: data.message || 'لم يتم العثور على منتجات مطابقة في مخزن Odoo لتحديثها.',
        });
      }
    } catch (err: any) {
      setOdooSyncNotification({
        type: 'error',
        message: err.message || 'تعذر الاتصال بـ Odoo. يرجى مراجعة إعدادات الربط في صفحة الإعدادات.',
      });
    } finally {
      setIsSyncingOdoo(false);
    }
  };

  // ==========================================
  // Step 1: File Parsing & Column Detection
  // ==========================================
  const handleFileUpload = async (file: File) => {
    try {
      setIsParsing(true);
      setParseError(null);
      setFileName(file.name);
      setFileSize(file.size);

      // Auto-set supplier name if detected from file name
      const lowerName = file.name.toLowerCase();
      if (lowerName.includes('moxedo') || lowerName.includes('ماكس') || lowerName.includes('سيدو')) {
        setSupplierName('ماكس سيدو Moxedo');
      } else if (lowerName.includes('remax') || lowerName.includes('ريماكس')) {
        setSupplierName('ريماكس Remax');
      } else if (lowerName.includes('anker') || lowerName.includes('انكر')) {
        setSupplierName('أنكر Anker');
      }

      const result: RawParseResult = await parseCatalogFile(file);
      if (!result.rows || result.rows.length === 0) {
        throw new Error('الملف فارغ أو لا يحتوي على صفوف بيانات صالحة.');
      }

      setRawRows(result.rows);
      setAvailableHeaders(result.headers);

      // Auto-detect columns
      const detected = autoDetectColumns(result.headers);
      setColumnMapping(detected);
    } catch (err: any) {
      console.error('File parsing error:', err);
      setParseError(err.message || 'فشل في قراءة ومعالجة الملف.');
    } finally {
      setIsParsing(false);
    }
  };

  // Convert raw rows into PurchaseOrderItem[]
  const handleProceedToSelection = () => {
    if (!columnMapping.productName) {
      alert('يرجى تحديد عمود "اسم المنتج" على الأقل لمتابعة الاستيراد.');
      return;
    }

    const parsedItems: PurchaseOrderItem[] = rawRows.map((row, idx) => {
      const internalRef = columnMapping.internalReference
        ? String(row[columnMapping.internalReference] || '').trim()
        : '';
      const rawName = String(row[columnMapping.productName] || `منتج #${idx + 1}`).trim();
      const name = cleanInternalRefFromName(rawName, internalRef);
      const barcode = columnMapping.barcode ? String(row[columnMapping.barcode] || '').trim() : '';
      const category = columnMapping.category ? String(row[columnMapping.category] || 'عام').trim() : 'عام';

      // Price parsing
      const parsePrice = (val: any) => {
        if (val === undefined || val === null || String(val).trim() === '') return 0;
        const num = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
        return isNaN(num) ? 0 : num;
      };

      const customerPrice = columnMapping.customerPrice
        ? parsePrice(row[columnMapping.customerPrice])
        : columnMapping.price
        ? parsePrice(row[columnMapping.price])
        : 0;

      const salePrice = columnMapping.salePrice ? parsePrice(row[columnMapping.salePrice]) : undefined;

      // Stock parsing
      let currentStock = 0;
      if (columnMapping.stock && row[columnMapping.stock] !== undefined) {
        const parsedStock = parseInt(String(row[columnMapping.stock]).replace(/[^0-9.-]/g, ''), 10);
        currentStock = isNaN(parsedStock) ? 0 : parsedStock;
      }

      // Image extraction
      const rawImage = columnMapping.image ? row[columnMapping.image] : undefined;
      const processedImage = extractAndNormalizeImage(rawImage);

      return {
        id: `po_item_${idx + 1}_${Date.now()}`,
        productName: name,
        barcode,
        category,
        internalReference: internalRef,
        imageData: processedImage.src,
        imageStatus: processedImage.status,
        currentStock,
        customerPrice,
        salePrice,
        requestedQuantity: 0,
        notes: '',
        selected: false,
      };
    });

    setItems(parsedItems);
    setCurrentPage(1);
    setStep(2);
  };

  // ==========================================
  // Categories & Filtering
  // ==========================================
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set);
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = item.productName.toLowerCase().includes(q);
        const matchBarcode = item.barcode.toLowerCase().includes(q);
        const matchRef = item.internalReference.toLowerCase().includes(q);
        const matchCat = item.category.toLowerCase().includes(q);
        if (!matchName && !matchBarcode && !matchRef && !matchCat) return false;
      }

      // 2. Category filter
      if (categoryFilter !== 'all' && item.category !== categoryFilter) {
        return false;
      }

      // 3. Stock & selection filter
      if (stockFilter === 'zero' && item.currentStock !== 0) return false;
      if (stockFilter === 'low' && item.currentStock >= 5) return false;
      if (stockFilter === 'selected_only' && (!item.selected || item.requestedQuantity <= 0)) return false;

      return true;
    });
  }, [items, search, categoryFilter, stockFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  // Overall selection statistics
  const selectedItems = useMemo(() => {
    return items.filter((i) => i.selected && i.requestedQuantity > 0);
  }, [items]);

  const totalRequestedQuantity = useMemo(() => {
    return selectedItems.reduce((sum, i) => sum + i.requestedQuantity, 0);
  }, [selectedItems]);

  const estimatedTotalCost = useMemo(() => {
    return selectedItems.reduce((sum, i) => {
      const price = typeof i.customerPrice === 'number' ? i.customerPrice : parseFloat(i.customerPrice) || 0;
      return sum + price * i.requestedQuantity;
    }, 0);
  }, [selectedItems]);

  // ==========================================
  // Item updates (Quantity, Checkbox, Notes)
  // ==========================================
  const handleUpdateItem = (id: string, updates: Partial<PurchaseOrderItem>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const next = { ...item, ...updates };
          // If quantity becomes > 0 and selected is not explicitly false, auto select
          if (updates.requestedQuantity !== undefined) {
            if (updates.requestedQuantity > 0 && updates.selected === undefined) {
              next.selected = true;
            } else if (updates.requestedQuantity <= 0 && updates.selected === undefined) {
              next.selected = false;
            }
          }
          // If selected is toggled to true but qty is 0, give it default 1
          if (updates.selected === true && next.requestedQuantity <= 0) {
            next.requestedQuantity = 1;
          }
          return next;
        }
        return item;
      })
    );
  };

  const handleAdjustQuantity = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQty = Math.max(0, item.requestedQuantity + delta);
          return {
            ...item,
            requestedQuantity: newQty,
            selected: newQty > 0,
          };
        }
        return item;
      })
    );
  };

  // Bulk actions
  const handleSelectAllOnPage = () => {
    const pageIds = new Set(paginatedItems.map((p) => p.id));
    setItems((prev) =>
      prev.map((item) => {
        if (pageIds.has(item.id)) {
          return {
            ...item,
            selected: true,
            requestedQuantity: item.requestedQuantity > 0 ? item.requestedQuantity : 1,
          };
        }
        return item;
      })
    );
  };

  const handleDeselectAll = () => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        selected: false,
        requestedQuantity: 0,
      }))
    );
  };

  const handleSelectZeroStock = (defaultQty: number = 10) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.currentStock === 0) {
          return {
            ...item,
            selected: true,
            requestedQuantity: item.requestedQuantity > 0 ? item.requestedQuantity : defaultQty,
          };
        }
        return item;
      })
    );
  };

  const handleSelectLowStock = (defaultQty: number = 5) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.currentStock > 0 && item.currentStock < 5) {
          return {
            ...item,
            selected: true,
            requestedQuantity: item.requestedQuantity > 0 ? item.requestedQuantity : defaultQty,
          };
        }
        return item;
      })
    );
  };

  // Copy barcode helper
  const handleCopyBarcode = (barcode: string) => {
    navigator.clipboard.writeText(barcode);
    setCopiedBarcode(barcode);
    setTimeout(() => setCopiedBarcode(null), 2000);
  };

  // ==========================================
  // Step 3: Export Handlers (Excel / PDF)
  // ==========================================
  const handleExport = async (format: 'xlsx' | 'pdf') => {
    if (selectedItems.length === 0) {
      alert('يرجى اختيار منتج واحد على الأقل وتحديد كميته قبل التصدير.');
      return;
    }

    try {
      setIsExporting(format);

      const orderPayload: PurchaseOrder = {
        id: `po_${Date.now()}`,
        supplierName: supplierName.trim() || 'المورد',
        fileName,
        items: items,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notes: orderNotes,
        totalItems: items.length,
        totalSelectedItems: selectedItems.length,
        totalRequestedQuantity,
        design: design,
      };

      const res = await fetch('/api/purchase-order/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order: orderPayload,
          format,
          options: {
            showStock: exportShowStock,
            showPrice: exportShowPrice,
          },
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        // If server failed PDF via puppeteer, offer fallback print
        if (errorData.fallbackHtml) {
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(errorData.fallbackHtml);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => printWindow.print(), 500);
            return;
          }
        }
        throw new Error(errorData.error || errorData.message || 'فشل تصدير الطلبية');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `طلبية_${supplierName}_${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Export error:', err);
      alert('حدث خطأ أثناء التصدير: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-[28px] p-5 sm:p-6 text-slate-900 border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
              <ShoppingCart className="w-3 h-3 text-amber-600" />
              طلبية استيراد جديدة (Purchase Order)
            </span>
            {fileName && (
              <span className="text-xs text-slate-400">
                الملف: <span className="text-slate-700 font-semibold">{fileName}</span>
              </span>
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-black font-cairo text-slate-900 flex items-center gap-2">
            <span>طلبية المورد والشركة المزودة</span>
            <span className="text-amber-600 text-sm font-normal">({supplierName || 'غير محدد'})</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            ارفع ملف منتجات الشركة المزودة (مثل ماكس سيدو)، ابحث وحدد المنتجات والكميات المطلوبة استيرادها، ثم صدّر ملف Excel أو PDF رسمي وجاهز للإرسال.
          </p>
        </div>

        {/* Wizard Steps Navigation & Project Save */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <button
            type="button"
            onClick={handleSaveProject}
            disabled={isSavingProject || items.length === 0}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 disabled:opacity-40"
            title="حفظ هذه الطلبية في المشاريع والكتالوجات لفتحها وتعديلها لاحقاً"
          >
            <Save className={`w-3.5 h-3.5 ${isSavingProject ? 'animate-spin' : ''}`} />
            <span>{isSavingProject ? 'جاري الحفظ...' : 'حفظ بالمشاريع'}</span>
          </button>

          <Link
            href="/projects"
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 border border-slate-700 shadow-xs"
            title="عرض المشاريع والكتالوجات المحفوظة"
          >
            <FolderKanban className="w-3.5 h-3.5 text-amber-400" />
            <span>المشاريع</span>
          </Link>

          {/* Wizard Steps Navigation */}
          <div className="flex items-center gap-2 bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800 text-xs font-bold">
            <button
              onClick={() => setStep(1)}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                step === 1 ? 'bg-amber-500 text-slate-950 font-black shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>1. رفع الملف</span>
            </button>
            <span className="text-slate-700">←</span>
            <button
              onClick={() => items.length > 0 && setStep(2)}
              disabled={items.length === 0}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                step === 2 ? 'bg-amber-500 text-slate-950 font-black shadow' : 'text-slate-400 hover:text-white disabled:opacity-40'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>2. اختيار الكميات</span>
            </button>
            <span className="text-slate-700">←</span>
            <button
              onClick={() => selectedItems.length > 0 && setStep(3)}
              disabled={selectedItems.length === 0}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                step === 3 ? 'bg-amber-500 text-slate-950 font-black shadow' : 'text-slate-400 hover:text-white disabled:opacity-40'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>3. المعاينة والتصدير</span>
            </button>
          </div>
        </div>
      </div>

      {/* Project Save Notification */}
      {projectSaveSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between gap-3 shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{projectSaveSuccess}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/projects"
              className="text-xs text-emerald-700 underline font-black hover:text-emerald-900"
            >
              عرض في المشاريع والكتالوجات ←
            </Link>
            <button
              type="button"
              onClick={() => setProjectSaveSuccess(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Loading Saved Project Indicator */}
      {isLoadingSavedProject && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-2.5 shadow-xs animate-pulse">
          <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />
          <span>جاري تحميل بيانات مشروع الطلبية المحفوظ...</span>
        </div>
      )}

      {/* ========================================== */}
      {/* STEP 1: UPLOAD & COLUMN MAPPING */}
      {/* ========================================== */}
      {step === 1 && (
        <div className="space-y-6 animate-fadeIn">
          {/* Supplier Name & Info Input Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-cairo">
                  اسم الشركة المزودة / المورد
                </h3>
                <p className="text-xs text-slate-500">
                  سيظهر هذا الاسم في ترويسة ملف الطلبية وملف الـ PDF والإكسل
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="مثال: شركة ماكس سيدو Moxedo، ريماكس Remax..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {['ماكس سيدو Moxedo', 'ريماكس Remax', 'أنكر Anker', 'جيروم Joyroom'].map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setSupplierName(name)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      supplierName === name
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Direct Odoo Warehouse Import Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 rounded-3xl p-6 text-white border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center shadow-inner">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-black font-cairo text-white">
                      استيراد المنتجات مباشرة من نظام Odoo ERP
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      متصل بالنظام ({odooCategories.length > 0 ? `${odooCategories.length} براند/فئة متوفرة` : '1,735 منتج متوفر'})
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    يمكنك استيراد كافة المنتجات أو اختيار براند معين من خلال فئة المنتج (مثل MOXEDO، BENKS، UNIQ، SKINARMA...) مع الأسعار والمخزون الحالي تلقائياً.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {/* Category / Brand Selection */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">البراند أو الفئة من Odoo:</label>
                <select
                  value={selectedOdooCategory}
                  onChange={(e) => setSelectedOdooCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-amber-500"
                >
                  <option value="all">⭐ استيراد جميع المنتجات والبراندات (المخزن بالكامل)</option>
                  {odooCategories.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.displayName || c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Stock Filter */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">فلتر حالة المخزون:</label>
                <select
                  value={odooStockFilter}
                  onChange={(e) => setOdooStockFilter(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-amber-500"
                >
                  <option value="all">كافة المنتجات (المتوفرة والمنتهية)</option>
                  <option value="zero_stock">المنتجات المنتهية فقط (المخزون = 0)</option>
                  <option value="with_stock">المنتجات المتوفرة فقط (المخزون &gt; 0)</option>
                </select>
              </div>

              {/* Import Limit */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">الحد الأقصى للعدد:</label>
                <select
                  value={odooImportLimit}
                  onChange={(e) => setOdooImportLimit(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-amber-500"
                >
                  <option value={100}>100 منتج</option>
                  <option value={250}>250 منتج</option>
                  <option value={500}>500 منتج (افتراضي)</option>
                  <option value={1000}>1,000 منتج</option>
                  <option value={2000}>كافة المنتجات (حتى 2,000)</option>
                </select>
              </div>

              {/* Action Button */}
              <div className="flex flex-col justify-end">
                <button
                  type="button"
                  onClick={handleImportFromOdoo}
                  disabled={isImportingFromOdoo}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isImportingFromOdoo ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جاري الاستيراد من Odoo...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>بدء استيراد المنتجات من Odoo</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
              <label className="flex items-center gap-2 cursor-pointer hover:text-slate-200">
                <input
                  type="checkbox"
                  checked={odooIncludeImages}
                  onChange={(e) => setOdooIncludeImages(e.target.checked)}
                  className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 cursor-pointer"
                />
                <span>تضمين صور المنتجات المصغرة من Odoo (مستحسن للطلبية)</span>
              </label>

              <span className="text-amber-400 font-semibold">
                ✓ سيتم الانتقال تلقائياً لتحديد كميات المواد فور اكتمال الجلب
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-4 text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
              أو يمكنك رفع ملف إكسل / CSV من المورد كالمعتاد
            </span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Drag & Drop Upload Card */}
          <div className="bg-white rounded-3xl p-8 border-2 border-dashed border-slate-300 hover:border-amber-500 text-center transition-all shadow-sm">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
              className="hidden"
            />

            <div className="max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto shadow-inner">
                {isParsing ? (
                  <RefreshCw className="w-8 h-8 animate-spin" />
                ) : (
                  <Upload className="w-8 h-8" />
                )}
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900 font-cairo">
                  {isParsing ? 'جاري قراءة ومعالجة الملف...' : 'ارفع ملف منتجات الشركة المزودة (Excel / CSV)'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  يدعم ملفات الاكسل بصيغتي .xlsx و .xls بالإضافة إلى ملفات .csv ويقرأ الصور (Base64) والباركود والمخزون تلقائياً
                </p>
              </div>

              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isParsing}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black text-xs transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
                >
                  اختيار ملف من جهازك
                </button>
              </div>

              {parseError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>
          </div>

          {/* Column Mapping Preview (If file is loaded) */}
          {rawRows.length > 0 && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5 animate-fadeIn">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 font-cairo">
                      تم استخراج {rawRows.length.toLocaleString('ar-EG')} منتج بنجاح
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      تأكد من مطابقة الأعمدة التالية لضمان قراءة اسم المنتج والباركود والمخزون والصور بشكل سليم
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleProceedToSelection}
                  className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition-colors flex items-center gap-2 shadow"
                >
                  <span>استيراد المنتجات وبدء الطلبية</span>
                  <ArrowLeft className="w-4 h-4 text-amber-400" />
                </button>
              </div>

              {/* Column Mapping Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                {/* Product Name */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span>اسم المنتج *</span>
                    <span className="text-[10px] text-rose-500 font-normal">(مطلوب)</span>
                  </label>
                  <select
                    value={columnMapping.productName}
                    onChange={(e) => setColumnMapping({ ...columnMapping, productName: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 text-xs"
                  >
                    <option value="">-- اختر العمود --</option>
                    {availableHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Barcode */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <label className="font-bold text-slate-800">الباركود (Barcode)</label>
                  <select
                    value={columnMapping.barcode}
                    onChange={(e) => setColumnMapping({ ...columnMapping, barcode: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 text-xs"
                  >
                    <option value="">-- اختر العمود --</option>
                    {availableHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Current Stock */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <label className="font-bold text-slate-800">المخزون الحالي (الكمية في اليد)</label>
                  <select
                    value={columnMapping.stock}
                    onChange={(e) => setColumnMapping({ ...columnMapping, stock: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 text-xs"
                  >
                    <option value="">-- اختر العمود --</option>
                    {availableHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Product Image */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <label className="font-bold text-slate-800">صورة المنتج (Base64 / URL)</label>
                  <select
                    value={columnMapping.image}
                    onChange={(e) => setColumnMapping({ ...columnMapping, image: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 text-xs"
                  >
                    <option value="">-- اختر العمود --</option>
                    {availableHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Price */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <label className="font-bold text-slate-800">السعر (سعر الزبون / الجملة)</label>
                  <select
                    value={columnMapping.customerPrice || columnMapping.price}
                    onChange={(e) =>
                      setColumnMapping({
                        ...columnMapping,
                        customerPrice: e.target.value,
                        price: e.target.value,
                      })
                    }
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 text-xs"
                  >
                    <option value="">-- اختر العمود --</option>
                    {availableHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <label className="font-bold text-slate-800">الفئة / التصنيف</label>
                  <select
                    value={columnMapping.category}
                    onChange={(e) => setColumnMapping({ ...columnMapping, category: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 text-xs"
                  >
                    <option value="">-- اختر العمود --</option>
                    {availableHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sample Rows Preview */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700">
                  معاينة أولية لبيانات الملف (أول 3 منتجات):
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">اسم المنتج</th>
                        <th className="p-2.5">الباركود</th>
                        <th className="p-2.5">المخزون الحالي</th>
                        <th className="p-2.5">السعر</th>
                        <th className="p-2.5">الفئة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rawRows.slice(0, 3).map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-slate-800">
                            {columnMapping.productName ? r[columnMapping.productName] : '—'}
                          </td>
                          <td className="p-2.5 font-inter text-slate-600">
                            {columnMapping.barcode ? r[columnMapping.barcode] : '—'}
                          </td>
                          <td className="p-2.5 font-bold text-amber-700">
                            {columnMapping.stock ? r[columnMapping.stock] : '0'}
                          </td>
                          <td className="p-2.5 text-slate-600">
                            {columnMapping.customerPrice ? r[columnMapping.customerPrice] : '—'}
                          </td>
                          <td className="p-2.5 text-slate-600">
                            {columnMapping.category ? r[columnMapping.category] : 'عام'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* STEP 2: SELECT PRODUCTS & SET QUANTITIES */}
      {/* ========================================== */}
      {step === 2 && (
        <div className="space-y-4 animate-fadeIn">
          {/* Odoo Sync Notification Banner */}
          {odooSyncNotification && (
            <div
              className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 shadow-xs animate-fadeIn ${
                odooSyncNotification.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {odooSyncNotification.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{odooSyncNotification.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setOdooSyncNotification(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Top Statistics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 block">إجمالي المنتجات</span>
              <span className="text-xl font-black font-cairo text-slate-900">
                {items.length.toLocaleString('ar-EG')}
              </span>
            </div>

            <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 shadow-sm">
              <span className="text-[11px] font-bold text-amber-800 block">المنتجات المختارة للطلب</span>
              <span className="text-xl font-black font-cairo text-amber-700">
                {selectedItems.length.toLocaleString('ar-EG')}
              </span>
            </div>

            <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 shadow-sm">
              <span className="text-[11px] font-bold text-emerald-800 block">إجمالي الكمية المطلوبة (قطع)</span>
              <span className="text-xl font-black font-inter text-emerald-700">
                {totalRequestedQuantity.toLocaleString('en-US')}
              </span>
            </div>

            <div className="bg-sky-50/70 p-4 rounded-2xl border border-sky-200 shadow-sm">
              <span className="text-[11px] font-bold text-sky-800 block">المبلغ التقديري للطلبية</span>
              <span className="text-xl font-black font-inter text-sky-700">
                {estimatedTotalCost.toLocaleString('en-US')}
              </span>
            </div>
          </div>

          {/* Quick Shortcuts & Preset Selection Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 font-cairo">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>إجراءات ذكية وسريعة لتحديد النواقص:</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-500 text-[11px]">الكمية الافتراضية عند التحديد:</span>
                <input
                  type="number"
                  min={1}
                  value={batchQuantityInput}
                  onChange={(e) => setBatchQuantityInput(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-14 bg-slate-50 border border-slate-300 rounded-lg py-0.5 text-center font-bold text-xs"
                />

                <button
                  type="button"
                  onClick={() => handleSelectZeroStock(batchQuantityInput)}
                  className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold transition-colors flex items-center gap-1 shadow-xs"
                  title="تحديد كل منتج مخزونه صفر وتعيين كمية افتراضية له"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span>تحديد كل المنتجات المنتهية (Stock = 0)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectLowStock(batchQuantityInput)}
                  className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 font-bold transition-colors flex items-center gap-1 shadow-xs"
                  title="تحديد كل منتج مخزونه أقل من 5"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>تحديد مخزون أقل من 5</span>
                </button>

                <button
                  type="button"
                  onClick={handleSelectAllOnPage}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
                >
                  تحديد صفحة العرض
                </button>

                {selectedItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-rose-600 text-xs font-bold transition-colors"
                  >
                    إلغاء التحديد الكل
                  </button>
                )}

                {/* Odoo Sync Button */}
                <button
                  type="button"
                  onClick={handleSyncFromOdoo}
                  disabled={isSyncingOdoo || items.length === 0}
                  className="px-3.5 py-1.5 rounded-lg bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-300 font-bold transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                  title="تحديث الكميات المتوفرة في المخزن وأسعار المنتجات مباشرة من نظام Odoo"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-sky-600 ${isSyncingOdoo ? 'animate-spin' : ''}`} />
                  <span>{isSyncingOdoo ? 'جاري التحديث من Odoo...' : 'تحديث الكميات والأسعار من Odoo'}</span>
                </button>
              </div>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="relative flex-1 min-w-[260px]">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="ابحث بالاسم، الباركود، الكود، الفئة..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-bold"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Stock filter pills */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setStockFilter('all');
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                      stockFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    الكل ({items.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStockFilter('zero');
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                      stockFilter === 'zero' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-rose-600'
                    }`}
                  >
                    المنتهي (0)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStockFilter('low');
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                      stockFilter === 'low' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 hover:text-amber-700'
                    }`}
                  >
                    أقل من 5
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStockFilter('selected_only');
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                      stockFilter === 'selected_only' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-emerald-700'
                    }`}
                  >
                    المختارة فقط ({selectedItems.length})
                  </button>
                </div>

                {/* Category filter */}
                {categories.length > 0 && (
                  <select
                    value={categoryFilter}
                    onChange={(e) => {
                      setCategoryFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-bold"
                  >
                    <option value="all">جميع الفئات ({categories.length})</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Products Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-900 text-white font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          paginatedItems.length > 0 &&
                          paginatedItems.every((item) => item.selected && item.requestedQuantity > 0)
                        }
                        onChange={(e) => {
                          if (e.target.checked) handleSelectAllOnPage();
                          else {
                            const pageIds = new Set(paginatedItems.map((p) => p.id));
                            setItems((prev) =>
                              prev.map((i) => (pageIds.has(i.id) ? { ...i, selected: false, requestedQuantity: 0 } : i))
                            );
                          }
                        }}
                        className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 cursor-pointer"
                      />
                    </th>
                    <th className="p-3 w-14 text-center">الصورة</th>
                    <th className="p-3">اسم المنتج والوصف</th>
                    <th className="p-3 w-32 text-center">الباركود</th>
                    <th className="p-3 w-24 text-center">الفئة</th>
                    <th className="p-3 w-28 text-center">المخزون الحالي</th>
                    <th className="p-3 w-24 text-center">السعر</th>
                    <th className="p-3 w-40 text-center bg-amber-500/10 text-amber-300">الكمية المطلوبة (العدد) *</th>
                    <th className="p-3 w-44">ملاحظات الصنف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-slate-400">
                        لا توجد منتجات تطابق البحث أو الفلاتر المحددة
                      </td>
                    </tr>
                  ) : (
                    paginatedItems.map((item) => {
                      const isSelected = item.selected && item.requestedQuantity > 0;

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50 transition-colors ${
                            isSelected ? 'bg-amber-50/40' : ''
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={(e) =>
                                handleUpdateItem(item.id, {
                                  selected: e.target.checked,
                                  requestedQuantity: e.target.checked ? (item.requestedQuantity > 0 ? item.requestedQuantity : 1) : 0,
                                })
                              }
                              className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                            />
                          </td>

                          {/* Image */}
                          <td className="p-2 text-center">
                            <div
                              onClick={() => {
                                if (item.imageData) {
                                  setPreviewImage({ src: item.imageData, title: item.productName });
                                }
                              }}
                              className="w-12 h-12 rounded-xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center mx-auto shadow-xs cursor-pointer hover:border-amber-500 transition-colors"
                            >
                              {item.imageData && item.imageStatus === 'valid' ? (
                                <img
                                  src={item.imageData}
                                  alt={item.productName}
                                  className="w-full h-full object-contain p-0.5"
                                />
                              ) : (
                                <Package className="w-5 h-5 text-slate-300" />
                              )}
                            </div>
                          </td>

                          {/* Name & Reference */}
                          <td className="p-3">
                            <div className="font-bold text-slate-900 text-xs font-cairo">
                              {item.productName}
                            </div>
                            {item.internalReference && (
                              <div className="text-[10px] text-slate-400 font-inter mt-0.5">
                                مرجع: {item.internalReference}
                              </div>
                            )}
                          </td>

                          {/* Barcode */}
                          <td className="p-3 text-center font-inter">
                            {item.barcode ? (
                              <div className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-200 transition-colors">
                                <span className="font-semibold text-slate-700 tracking-wider">
                                  {item.barcode}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyBarcode(item.barcode)}
                                  title="نسخ الباركود"
                                  className="text-slate-400 hover:text-slate-700"
                                >
                                  {copiedBarcode === item.barcode ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>

                          {/* Category */}
                          <td className="p-3 text-center">
                            <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded text-[10px]">
                              {item.category || 'عام'}
                            </span>
                          </td>

                          {/* Current Stock */}
                          <td className="p-3 text-center">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                item.currentStock === 0
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : item.currentStock < 5
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {item.currentStock === 0 ? 'نفذ (0)' : item.currentStock}
                            </span>
                          </td>

                          {/* Price */}
                          <td className="p-3 text-center font-bold text-slate-700 font-inter">
                            {typeof item.customerPrice === 'number'
                              ? item.customerPrice.toLocaleString('en-US')
                              : item.customerPrice || '—'}
                          </td>

                          {/* Requested Quantity (Direct input + Steppers) */}
                          <td className="p-3 text-center bg-amber-500/5">
                            <div className="inline-flex items-center gap-1 bg-white border border-slate-300 rounded-xl p-1 shadow-xs">
                              <button
                                type="button"
                                onClick={() => handleAdjustQuantity(item.id, -1)}
                                disabled={item.requestedQuantity <= 0}
                                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold disabled:opacity-30"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>

                              <input
                                type="number"
                                min={0}
                                value={item.requestedQuantity}
                                onChange={(e) => {
                                  const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                  handleUpdateItem(item.id, {
                                    requestedQuantity: val,
                                    selected: val > 0,
                                  });
                                }}
                                className="w-14 text-center font-black font-inter text-sm text-slate-900 focus:outline-none"
                              />

                              <button
                                type="button"
                                onClick={() => handleAdjustQuantity(item.id, 1)}
                                className="w-7 h-7 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-xs"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>

                          {/* Notes */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.notes || ''}
                              onChange={(e) => handleUpdateItem(item.id, { notes: e.target.value })}
                              placeholder="ملاحظة خاصة..."
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500"
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-3">
              <div className="flex items-center gap-2">
                <span>عرض</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>منتج لكل صفحة (إجمالي النتائج: {filteredItems.length})</span>
              </div>

              <div className="flex items-center gap-2">
                <span>
                  الصفحة {currentPage} من {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="px-3 py-1 bg-white border border-slate-300 rounded-lg font-bold disabled:opacity-40"
                >
                  السابق
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="px-3 py-1 bg-white border border-slate-300 rounded-lg font-bold disabled:opacity-40"
                >
                  التالي
                </button>
              </div>
            </div>
          </div>

          {/* Sticky Bottom Action Bar */}
          <div className="bg-slate-900 rounded-3xl p-4 sm:p-5 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-300">
                  تم تحديد <span className="text-amber-400 font-black text-sm">{selectedItems.length}</span> منتج
                  بإجمالي <span className="text-emerald-400 font-black text-sm">{totalRequestedQuantity}</span> قطعة
                </div>
                <div className="text-[11px] text-slate-400">
                  المورد المستهدف: <span className="text-white font-semibold">{supplierName}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleSaveProject}
                disabled={isSavingProject || items.length === 0}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                title="حفظ الطلبية في المشاريع والكتالوجات للرجوع إليها لاحقاً"
              >
                {isSavingProject ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                ) : (
                  <Save className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>حفظ المشروع</span>
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
              >
                تغيير الملف
              </button>

              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={selectedItems.length === 0}
                className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <span>متابعة لمعاينة الطلبية وتصدير الملف</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* STEP 3: STUDIO & TABLE CUSTOMIZATION */}
      {/* ========================================== */}
      {step === 3 && (
        <PurchaseOrderStudio
          order={{
            id: currentProjectId || `po_${Date.now()}`,
            supplierName: supplierName.trim() || 'المورد',
            fileName,
            items: items,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            notes: orderNotes,
            totalItems: items.length,
            totalSelectedItems: selectedItems.length,
            totalRequestedQuantity,
            design: design,
          }}
          selectedItems={selectedItems}
          supplierName={supplierName}
          orderNotes={orderNotes}
          design={design}
          onChangeDesign={setDesign}
          onUpdateItem={handleUpdateItem}
          onAdjustQuantity={handleAdjustQuantity}
          onExport={handleExport}
          isExporting={isExporting}
          onBackToSelection={() => setStep(2)}
          onSyncFromOdoo={handleSyncFromOdoo}
          isSyncingOdoo={isSyncingOdoo}
          onSaveProject={handleSaveProject}
          isSavingProject={isSavingProject}
        />
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-4 max-w-lg w-full border border-slate-200 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-900 truncate font-cairo">
                {previewImage.title}
              </span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[70vh] flex items-center justify-center overflow-hidden rounded-2xl bg-slate-50 p-2">
              <img
                src={previewImage.src}
                alt={previewImage.title}
                className="max-h-[65vh] w-auto object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PurchaseOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm font-cairo">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
            <span>جاري تحميل طلبية المورد...</span>
          </div>
        </div>
      }
    >
      <PurchaseOrderContent />
    </Suspense>
  );
}
