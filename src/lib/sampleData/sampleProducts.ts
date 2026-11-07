import { Product } from '@/types';

// Real lightweight Base64 test image assets (WebP and PNG)
export const SAMPLE_BASE64_WEBP =
  'data:image/webp;base64,UklGRmYAAABXRUJQVlA4IFoAAAAwAQCdASoFAAUAAUAmJaQAA3AA/vsP1sAA/v1b0f/q9v1k3e/26sA/v1X0f9/2/v1Y/9f7/1L//+F/3/v3f9/1//1L//+F/3/v3f9/1//1L//+F/3/v3f9/1//1L///2QAAAA=';

// High-fidelity SVG / PNG base64 gadget thumbnails for crisp live catalog previews
export const SAMPLE_GADGET_BATTERY_PNG =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" rx="20" fill="%230f172a"/><rect x="40" y="50" width="120" height="100" rx="14" fill="%230284c7" stroke="%2338bdf8" stroke-width="4"/><rect x="160" y="80" width="12" height="40" rx="4" fill="%2338bdf8"/><path d="M100 65 L85 105 L105 105 L95 135 L125 95 L105 95 Z" fill="%23ffffff"/><text x="100" y="175" fill="%2394a3b8" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">MOXEDO POWER</text></svg>';

export const SAMPLE_GADGET_HEADPHONES_PNG =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" rx="20" fill="%231e293b"/><path d="M50 110 A50 50 0 0 1 150 110" fill="none" stroke="%230284c7" stroke-width="12" stroke-linecap="round"/><rect x="36" y="100" width="24" height="44" rx="8" fill="%2338bdf8"/><rect x="140" y="100" width="24" height="44" rx="8" fill="%2338bdf8"/><text x="100" y="175" fill="%2394a3b8" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">ANC AUDIO</text></svg>';

export const SAMPLE_GADGET_WATCH_PNG =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" rx="20" fill="%230b1120"/><rect x="75" y="20" width="50" height="160" rx="10" fill="%23334155"/><rect x="60" y="60" width="80" height="80" rx="20" fill="%230f172a" stroke="%230284c7" stroke-width="4"/><circle cx="100" cy="100" r="26" fill="none" stroke="%2338bdf8" stroke-width="3" stroke-dasharray="120 40"/><text x="100" y="105" fill="%23ffffff" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">10:45</text></svg>';

export const SAMPLE_GADGET_CABLE_PNG =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" rx="20" fill="%230f172a"/><path d="M40 140 C80 60 120 140 160 60" fill="none" stroke="%230284c7" stroke-width="10" stroke-linecap="round"/><rect x="25" y="130" width="30" height="18" rx="4" fill="%23e2e8f0"/><rect x="145" y="50" width="30" height="18" rx="4" fill="%23e2e8f0"/><text x="100" y="180" fill="%2394a3b8" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">TYPE-C 100W</text></svg>';

export const SAMPLE_GADGET_CHARGER_PNG =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" rx="20" fill="%231e293b"/><rect x="60" y="55" width="80" height="90" rx="12" fill="%230f172a" stroke="%2338bdf8" stroke-width="4"/><rect x="75" y="25" width="12" height="30" fill="%2394a3b8"/><rect x="113" y="25" width="12" height="30" fill="%2394a3b8"/><rect x="85" y="110" width="30" height="10" rx="3" fill="%230284c7"/><text x="100" y="175" fill="%2338bdf8" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">GaN 65W</text></svg>';

export const INITIAL_SAMPLE_PRODUCTS: Product[] = [
  {
    id: 'prod_moxedo_001',
    projectId: 'demo_project',
    name: 'MOXEDO PORTA-LINK POWER BANK 10,000mAh',
    originalDescription:
      'بنك طاقة متنقل فائق السرعة بسعة 10000 مللي أمبير مع كابلين مدمجين Type-C و Lightning لشحن هواتف iPhone و Samsung بسرعة فائقة 22.5 واط مع شاشة رقمية LED ذكية توضح نسبة البطارية المتبقية بدقة، وتصميم مدمج خفيف الوزن ومقاوم للحرارة والصدمات ومعتمد للطيران.',
    shortenedDescription:
      'سعة 10,000mAh مع كابلين مدمجين Type-C وLightning، شحن سريع 22.5W وشاشة LED رقمية دقيقة.',
    activeDescriptionType: 'original',
    barcode: '6977525810152',
    price: 25000,
    customerPrice: 25000,
    salePrice: 19500,
    stock: 0,
    category: 'شواحن وبطاريات',
    internalReference: 'MOX-PB-10K',
    unit: 'قطعة',
    currency: 'د.ع',
    availableQuantity: 0,
    imageData: SAMPLE_GADGET_BATTERY_PNG,
    imageStatus: 'valid',
    includedInCatalog: true,
    order: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod_moxedo_002',
    projectId: 'demo_project',
    name: 'سماعة رأس لاسلكية MOXEDO SOUNDPRO ANC',
    originalDescription:
      'سماعة رأس لاسلكية احترافية مزودة بتقنية إلغاء الضوضاء النشطة الهجينة Hybrid ANC مع مشغلات ديناميكية 40 مم لصوت محيطي نقي وعميق وبلوتوث الإصدار 5.3 لتقليل التأخير الزمني، وبطارية جبارة تدوم حتى 55 ساعة عمل متواصلة مع شحن فائق السرعة عبر منفذ Type-C ووسائد أذن جلدية مريحة جداً.',
    shortenedDescription:
      'إلغاء ضوضاء نشط Hybrid ANC، مشغلات 40مم، بلوتوث 5.3، وبطارية تدوم 55 ساعة عمل متواصل.',
    activeDescriptionType: 'original',
    barcode: '6977525810169',
    price: 48000,
    customerPrice: 48000,
    salePrice: 38000,
    stock: 3,
    category: 'صوتيات وسماعات',
    internalReference: 'MOX-HP-55H',
    unit: 'قطعة',
    currency: 'د.ع',
    availableQuantity: 3,
    imageData: SAMPLE_GADGET_HEADPHONES_PNG,
    imageStatus: 'valid',
    includedInCatalog: true,
    order: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod_moxedo_003',
    projectId: 'demo_project',
    name: 'ساعة ذكية MOXEDO ULTRA TITANIUM WATCH',
    originalDescription:
      'ساعة ذكية بشاشة AMOLED فائقة الوضوح بقياس 2.02 بوصة مع إطار صلب من سبائك التيتانيوم ومقاومة للماء بمعيار IP68 ومستشعرات طبية دقيقة لمراقبة نبضات القلب ونسبة الأكسجين وضغط الدم مع إجراء المكالمات الصوتية مباشرة عبر البلوتوث وبطارية تدوم 7 أيام استخدام مكثف.',
    shortenedDescription:
      'شاشة AMOLED بقياس 2.02 بوصة، هيكل تيتانيوم، مقاومة IP68، مكالمات بلوتوث وبطارية 7 أيام.',
    activeDescriptionType: 'original',
    barcode: '6977525810176',
    price: 65000,
    customerPrice: 65000,
    salePrice: 52000,
    stock: 14,
    category: 'ساعات ذكية',
    internalReference: 'MOX-WT-TITAN',
    unit: 'قطعة',
    currency: 'د.ع',
    availableQuantity: 14,
    imageData: SAMPLE_GADGET_WATCH_PNG,
    imageStatus: 'valid',
    includedInCatalog: true,
    order: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod_moxedo_004',
    projectId: 'demo_project',
    name: 'كابل بيانات وشحن سريع MOXEDO ARMOR CABLE 100W',
    originalDescription:
      'كابل شحن ونقل بيانات فائق التحمل بقوة 100 واط مع شريحة E-Marker الذكية ومغطى بنسيج كيفلار عسكري مقاوم للقطع ومقاوم لـ 30,000 انحناء يدعم شحن الحواسيب المحمولة MacBook Pro وأحدث هواتف الأندرويد والآيفون بطول 1.8 متر مع مؤشر طاقة رقمي بالواط.',
    shortenedDescription:
      'قدرة 100W مع شريحة E-Marker، نسيج عسكري فائق المتانة، طول 1.8م وشاشة لقياس واط الشحن.',
    activeDescriptionType: 'original',
    barcode: '6977525810183',
    price: 12000,
    customerPrice: 12000,
    salePrice: 8500,
    stock: 4,
    category: 'كابلات وتوصيلات',
    internalReference: 'MOX-CB-100W',
    unit: 'قطعة',
    currency: 'د.ع',
    availableQuantity: 4,
    imageData: SAMPLE_GADGET_CABLE_PNG,
    imageStatus: 'valid',
    includedInCatalog: true,
    order: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod_moxedo_005',
    projectId: 'demo_project',
    name: 'شاحن جداري MOXEDO NITRO GaN 65W TRIPLE PORT',
    originalDescription:
      'شاحن جداري فائق الصغر بتقنية نيتريد الغاليوم GaN الجيل الثالث بقدرة إجمالية 65 واط يحتوي على منفذي Type-C بتقنية Power Delivery 3.0 ومنفذ USB-A بتقنية Quick Charge 4.0 لشحن لابتوب وهاتفين معاً بأعلى كفاءة وحماية كاملة ضد ارتفاع درجات الحرارة والجهد الزائد.',
    shortenedDescription:
      'تقنية GaN بقدرة 65W، 3 منافذ (2x Type-C + USB-A)، شحن متزامن للابتوب والهواتف مع حماية ذكية.',
    activeDescriptionType: 'original',
    barcode: '6977525810190',
    price: 32000,
    customerPrice: 32000,
    salePrice: 25000,
    stock: 28,
    category: 'شواحن وبطاريات',
    internalReference: 'MOX-CH-65W',
    unit: 'قطعة',
    currency: 'د.ع',
    availableQuantity: 28,
    imageData: SAMPLE_GADGET_CHARGER_PNG,
    imageStatus: 'valid',
    includedInCatalog: true,
    order: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod_moxedo_006',
    projectId: 'demo_project',
    name: 'حامل هاتف مغناطيسي للسيارة MOXEDO MAG-LOCK 15W',
    originalDescription:
      'حامل هاتف ذكي للسيارة مزود بشاحن لاسلكي مغناطيسي MagSafe بقوة 15 واط مع تبريد هوائي مدمج لمنع ارتفاع حرارة الهاتف أثناء الملاحة ودوران كامل 360 درجة وقاعدة تثبيت محكمة على فتحات المكيف لثبات استثنائي على الطرق الوعرة.',
    shortenedDescription:
      'شاحن MagSafe مغناطيسي 15W للسيارة مع دوران 360 درجة وتبريد هوائي مدمج لتثبيت محكم.',
    activeDescriptionType: 'original',
    barcode: '6977525810206',
    price: 22000,
    customerPrice: 22000,
    salePrice: 16500,
    stock: 2,
    category: 'ملحقات سيارات',
    internalReference: 'MOX-CAR-15W',
    unit: 'قطعة',
    currency: 'د.ع',
    availableQuantity: 2,
    imageData: SAMPLE_BASE64_WEBP,
    imageStatus: 'valid',
    includedInCatalog: true,
    order: 6,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod_moxedo_007',
    projectId: 'demo_project',
    name: 'محول منافذ متعدد MOXEDO 8-IN-1 USB-C HUB 4K',
    originalDescription:
      'محول منافذ متعدد الوظائف من الألمنيوم الرمادي الفلكي يضم منفذ HDMI بدقة 4K@60Hz ومنفذ شحن سريع 100W PD ومنفذ شبكة إيثرنت Gigabit LAN وثلاثة منافذ USB 3.0 فائقة السرعة وقارئ بطاقات SD/TF متوافق مع الحواسيب والأجهزة اللوحية.',
    shortenedDescription:
      'هيكل ألمنيوم، منفذ HDMI 4K@60Hz، شحن 100W PD، شبكة Gigabit، ومنافذ USB 3.0 مع قارئ SD.',
    activeDescriptionType: 'original',
    barcode: '6977525810213',
    price: 38000,
    customerPrice: 38000,
    salePrice: 29000,
    stock: 0,
    category: 'محولات وتوصيلات',
    internalReference: 'MOX-HUB-8IN1',
    unit: 'قطعة',
    currency: 'د.ع',
    availableQuantity: 0,
    imageData: '',
    imageStatus: 'missing',
    includedInCatalog: true,
    order: 7,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod_moxedo_008',
    projectId: 'demo_project',
    name: 'ماوس لاسلكي مريح MOXEDO ERGO SILENT CLICK',
    originalDescription:
      'فأرة لاسلكية مريحة بزاوية رأسية تمنع إجهاد المعصم بنقرات صامتة تماماً 90% صمت وحساس ليزري قابل للتعديل حتى 4000 DPI مع اتصال مزدوج عبر بلوتوث ومستقبل 2.4GHz وبطارية تدوم 90 يوماً لكل شحنة واحدة.',
    shortenedDescription:
      'تصميم مريح مانع للإجهاد، نقرات صامتة 90%، دقة 4000 DPI، اتصال مزدوج وبطارية 90 يوماً.',
    activeDescriptionType: 'original',
    barcode: '6977525810220',
    price: 19000,
    customerPrice: 19000,
    salePrice: 14000,
    stock: 7,
    category: 'ملحقات حواسيب',
    internalReference: 'MOX-MS-ERGO',
    unit: 'قطعة',
    currency: 'د.ع',
    availableQuantity: 7,
    imageData: SAMPLE_GADGET_WATCH_PNG,
    imageStatus: 'valid',
    includedInCatalog: true,
    order: 8,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
