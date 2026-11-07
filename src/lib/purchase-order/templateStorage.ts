import { SavedPurchaseOrderTemplate, PurchaseOrderTableDesign } from '@/types';
import { createDefaultPurchaseOrderDesign } from './defaultDesign';

const STORAGE_KEY = 'purchase_order_custom_templates';

export function getDefaultPurchaseOrderTemplates(supplierName = ''): SavedPurchaseOrderTemplate[] {
  const baseDesign = createDefaultPurchaseOrderDesign(supplierName);

  return [
    {
      id: 'tpl_default_slate',
      name: 'القالب القياسي - فحم داكن (Slate 900)',
      description: 'تصميم أنيق متوازن مع تظليل خفيف للصفوف وإبراز بارز لكميات الطلب',
      isDefault: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      design: {
        ...baseDesign,
        headerBackground: '#0f172a',
        headerTextColor: '#ffffff',
        alternateRowBackground: '#f8fafc',
        highlightQuantity: true,
        pageSize: 'A4',
        orientation: 'portrait',
      },
    },
    {
      id: 'tpl_royal_blue',
      name: 'قالب كحلي ملكي (Royal Navy)',
      description: 'ألوان رسمية كحلية ممتازة للشركات المعتمدة والموردين الدوليين',
      isDefault: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      design: {
        ...baseDesign,
        headerBackground: '#1e3a8a',
        headerTextColor: '#ffffff',
        alternateRowBackground: '#f0f9ff',
        highlightQuantity: true,
        pageSize: 'A4',
        orientation: 'portrait',
      },
    },
    {
      id: 'tpl_business_emerald',
      name: 'قالب زمردي للأعمال (Business Emerald)',
      description: 'طابع عملي منظم بلون أخضر زمردي جذاب وواضح',
      isDefault: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      design: {
        ...baseDesign,
        headerBackground: '#065f46',
        headerTextColor: '#ffffff',
        alternateRowBackground: '#f0fdf4',
        highlightQuantity: true,
        pageSize: 'A4',
        orientation: 'portrait',
      },
    },
    {
      id: 'tpl_single_long_page',
      name: 'قالب صفحة واحدة ممتدة (Single Long Page)',
      description: 'صفحة واحدة مستمرة بدون فواصل صفحات، مثالي للإرسال عبر واتساب والأجهزة الذكية',
      isDefault: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      design: {
        ...baseDesign,
        headerBackground: '#0f172a',
        headerTextColor: '#ffffff',
        alternateRowBackground: '#f8fafc',
        pageSize: 'single_long_page',
        orientation: 'portrait',
        rowPadding: 'compact',
        highlightQuantity: true,
      },
    },
    {
      id: 'tpl_warm_amber',
      name: 'قالب كهرماني دافئ (Warm Amber)',
      description: 'ترويسة بلون كهرماني متناسق مع متجر E-zone وإبراز مريح للعين',
      isDefault: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      design: {
        ...baseDesign,
        headerBackground: '#d97706',
        headerTextColor: '#ffffff',
        alternateRowBackground: '#fefce8',
        highlightQuantity: true,
        pageSize: 'A4',
        orientation: 'portrait',
      },
    },
    {
      id: 'tpl_detailed_sku',
      name: 'قالب تفصيلي مع كود الصنف والفئة',
      description: 'يعرض عمود المرجع الداخلي (SKU) وعمود الفئة بشكل مرئي في الجدول',
      isDefault: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      design: {
        ...baseDesign,
        headerBackground: '#1e293b',
        headerTextColor: '#ffffff',
        columns: baseDesign.columns.map((c) => {
          if (c.key === 'internalReference' || c.key === 'category') {
            return { ...c, visible: true };
          }
          if (c.key === 'productName') {
            return { ...c, width: 28 };
          }
          return c;
        }),
        pageSize: 'A4',
        orientation: 'landscape',
        highlightQuantity: true,
      },
    },
  ];
}

export function getCustomPurchaseOrderTemplates(): SavedPurchaseOrderTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading custom PO templates:', err);
    return [];
  }
}

export function getAllPurchaseOrderTemplates(supplierName = ''): SavedPurchaseOrderTemplate[] {
  const defaults = getDefaultPurchaseOrderTemplates(supplierName);
  const customs = getCustomPurchaseOrderTemplates();
  return [...customs, ...defaults];
}

export function savePurchaseOrderTemplate(template: SavedPurchaseOrderTemplate): void {
  if (typeof window === 'undefined') return;
  try {
    const customs = getCustomPurchaseOrderTemplates();
    const existingIndex = customs.findIndex((t) => t.id === template.id);

    if (existingIndex >= 0) {
      customs[existingIndex] = template;
    } else {
      customs.unshift(template);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(customs));
  } catch (err) {
    console.error('Error saving custom PO template:', err);
  }
}

export function deletePurchaseOrderTemplate(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const customs = getCustomPurchaseOrderTemplates();
    const filtered = customs.filter((t) => t.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Error deleting custom PO template:', err);
  }
}
