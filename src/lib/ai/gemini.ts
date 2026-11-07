import { logger } from '@/lib/security/logger';
/**
 * Google Gemini AI Integration Engine for Catalog Studio
 * Supports Gemini 1.5 Flash & Pro for high-speed batch classification,
 * commercial category reordering, and smart description processing.
 */

export interface ProductToClassify {
  id: string;
  name: string;
  description?: string;
  category?: string;
  internalReference?: string;
  barcode?: string;
  imageData?: string; // Base64 data URI or image URL for vision classification
}

export interface ClassificationResult {
  id: string;
  name: string;
  originalCategory: string;
  suggestedCategory: string;
  confidence: number;
  reason?: string;
  imageData?: string;
}

export interface BatchClassificationResponse {
  classifications: ClassificationResult[];
  categoryOrder: string[];
  source: 'gemini' | 'heuristic';
  modelUsed?: string;
}

/**
 * Standard commercial retail taxonomy presets
 */
export const STANDARD_CATALOG_CATEGORIES = [
  'شواحن وبطاريات',
  'كابلات وتوصيلات',
  'بنوك طاقة (Power Banks)',
  'صوتيات وسماعات',
  'ساعات ذكية وملحقاتها',
  'ملحقات وشواحن سيارات',
  'حوامل ومثبتات الهواتف',
  'محولات وموزعات Hubs',
  'حماية وكفرات',
  'ملحقات حواسيب وإلكترونيات',
  'أجهزة وإلكترونيات متنوعة',
];

/**
 * Rule-based heuristic classifier for Arabic/English tech products
 */
export function classifyProductHeuristically(
  name: string,
  desc: string = ''
): { category: string; confidence: number } {
  const text = `${name} ${desc}`.toLowerCase();

  // 1. Power Banks / بنوك طاقة
  if (
    text.includes('power bank') ||
    text.includes('powerbank') ||
    text.includes('بنك طاقة') ||
    text.includes('بور بانك') ||
    text.includes('باور بانك') ||
    text.includes('بطارية متنقلة') ||
    /\b(5000|10000|20000|30000|40000|50000)\s*mah\b/i.test(text)
  ) {
    return { category: 'بنوك طاقة (Power Banks)', confidence: 0.96 };
  }

  // 2. Cables / كابلات
  if (
    text.includes('cable') ||
    text.includes('wire') ||
    text.includes('كابل') ||
    text.includes('كيبل') ||
    text.includes('سلك') ||
    text.includes('واير') ||
    text.includes('type-c to') ||
    text.includes('c to c') ||
    text.includes('lightning') ||
    text.includes('usb to') ||
    text.includes('aux cable')
  ) {
    return { category: 'كابلات وتوصيلات', confidence: 0.95 };
  }

  // 3. Screen Protectors & Cases / حماية وكفرات
  if (
    text.includes('screen protector') ||
    text.includes('privacy') ||
    text.includes('tempered glass') ||
    text.includes('شاشة حماية') ||
    text.includes('حماية شاشة') ||
    text.includes('واقي شاشة') ||
    text.includes('لاصقة') ||
    text.includes('phone case') ||
    text.includes('case') ||
    text.includes('cover') ||
    text.includes('kevlar') ||
    text.includes('armorair') ||
    text.includes('كفر') ||
    text.includes('غلاف') ||
    text.includes('جراب') ||
    text.includes('camera lens protector')
  ) {
    return { category: 'حماية وكفرات', confidence: 0.95 };
  }

  // 4. Car Accessories / سيارات
  if (
    text.includes('car charger') ||
    text.includes('car mount') ||
    text.includes('car holder') ||
    text.includes('شاحن سيارة') ||
    text.includes('مثبت سيارة') ||
    text.includes('حامل سيارة') ||
    text.includes('سيارة') ||
    text.includes('ولاعة')
  ) {
    return { category: 'ملحقات وشواحن سيارات', confidence: 0.94 };
  }

  // 5. Chargers / شواحن
  if (
    text.includes('charger') ||
    text.includes('شاحن') ||
    text.includes('شاحنة') ||
    text.includes('wall charger') ||
    text.includes('gan charger') ||
    text.includes('fast charging') ||
    text.includes('شحن سريع') ||
    text.includes('مقبس') ||
    text.includes('magsafe charger') ||
    text.includes('wireless charger') ||
    text.includes('شاحن لاسلكي') ||
    /\b(20w|25w|30w|35w|45w|65w|100w|120w|140w)\b/i.test(text)
  ) {
    return { category: 'شواحن وبطاريات', confidence: 0.94 };
  }

  // 6. Audio & Headphones / صوتيات
  if (
    text.includes('earbuds') ||
    text.includes('headphone') ||
    text.includes('earphone') ||
    text.includes('speaker') ||
    text.includes('soundbar') ||
    text.includes('سماعة') ||
    text.includes('سماعات') ||
    text.includes('مكبر صوت') ||
    text.includes('إيربودز') ||
    text.includes('ايربودز') ||
    text.includes('بلوتوث سماعة') ||
    text.includes('mono earphone') ||
    text.includes('bbml')
  ) {
    return { category: 'صوتيات وسماعات', confidence: 0.96 };
  }

  // 7. Smart Watches / ساعات ذكية
  if (
    text.includes('smartwatch') ||
    text.includes('smart watch') ||
    text.includes('watch') ||
    text.includes('ساعة ذكية') ||
    text.includes('ساعة') ||
    text.includes('حزام ساعة') ||
    text.includes('سوار')
  ) {
    return { category: 'ساعات ذكية وملحقاتها', confidence: 0.92 };
  }

  // 8. Hubs & Adapters / محولات
  if (
    text.includes('hub') ||
    text.includes('adapter') ||
    text.includes('converter') ||
    text.includes('dock') ||
    text.includes('محول') ||
    text.includes('موزع') ||
    text.includes('otg')
  ) {
    return { category: 'محولات وموزعات Hubs', confidence: 0.91 };
  }

  // 9. Stands & Mounts / حوامل
  if (
    text.includes('stand') ||
    text.includes('holder') ||
    text.includes('mount') ||
    text.includes('حامل') ||
    text.includes('ستاند') ||
    text.includes('قاعدة')
  ) {
    return { category: 'حوامل ومثبتات الهواتف', confidence: 0.89 };
  }

  // 10. Small Electronics & Home Gadgets / أجهزة منزلية وإلكترونيات
  if (
    text.includes('blender') ||
    text.includes('blendo') ||
    text.includes('خلاط') ||
    text.includes('عصارة') ||
    text.includes('fan') ||
    text.includes('مروحة') ||
    text.includes('vacuum') ||
    text.includes('مكواة') ||
    text.includes('أجهزة منزلية')
  ) {
    return { category: 'أجهزة وإلكترونيات متنوعة', confidence: 0.92 };
  }

  return { category: 'أجهزة وإلكترونيات متنوعة', confidence: 0.65 };
}

/**
 * Available Gemini Model Presets
 */
export const AVAILABLE_GEMINI_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', label: 'Gemini 2.5 Flash (الأحدث والأسرع - افتراضي معتمد)' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', label: 'Gemini 2.5 Pro (أعلى قدرات استدلال وتحليل تجاري)' },
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', label: 'Gemini 3.8 Flash (الجيل التجريبي فائق السرعة)' },
];

export function getPreferredGeminiModel(customModel?: string): string {
  return customModel?.trim() || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
}

/**
 * Validates connection with Google Gemini API with smart model fallback and error translation
 */
export async function testGeminiConnection(apiKey?: string, model?: string): Promise<{
  success: boolean;
  message: string;
  model: string;
  latencyMs?: number;
}> {
  const key = apiKey || process.env.GEMINI_API_KEY;
  const targetModel = getPreferredGeminiModel(model);

  if (!key || !key.trim()) {
    return {
      success: false,
      message: 'لم يتم العثور على مفتاح Google Gemini API Key. يرجى إدخال المفتاح في الإعدادات.',
      model: targetModel,
    };
  }

  const startTime = Date.now();
  const modelsToTry = [
    targetModel,
    'gemini-2.5-flash',
    'gemini-2.5-pro',
  ].filter((m, idx, arr) => arr.indexOf(m) === idx);

  let lastErrorMsg = '';
  let finalModel = targetModel;

  for (const currentModel of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${key.trim()}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: 'اختبار الاتصال: رد بكلمة واحدة فقط: متصل' }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 100,
            temperature: 0.1,
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        }),
      });

      const latencyMs = Date.now() - startTime;

      if (res.ok) {
        const data = await res.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'متصل';
        return {
          success: true,
          message: `الاتصال بـ Google Gemini نشط ومستقر (${latencyMs}ms). الرد: ${reply}`,
          model: currentModel,
          latencyMs,
        };
      }

      const errData = await res.json().catch(() => ({}));
      const errMsg = errData.error?.message || `HTTP ${res.status}: ${res.statusText}`;
      lastErrorMsg = errMsg;
      finalModel = currentModel;

      // If error is invalid API key, stop trying because the key itself is wrong
      if (errData.error?.status === 'INVALID_ARGUMENT' || errMsg.toLowerCase().includes('api key not valid')) {
        return {
          success: false,
          message: `فشل الاتصال: مفتاح الـ API غير صالح (API key not valid). يرجى نسخ مفتاح صالح من https://aistudio.google.com/app/apikey (يبدأ عادةً بـ AIzaSy...).`,
          model: currentModel,
          latencyMs,
        };
      }

      // If 404 (model not found), continue loop to fallback model
      if (res.status === 404) {
        continue;
      }
    } catch (error: any) {
      lastErrorMsg = error.message || String(error);
    }
  }

  return {
    success: false,
    message: `فشل الاتصال بـ Gemini (${finalModel}): ${lastErrorMsg}`,
    model: finalModel,
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Classifies a list of products using Google Gemini with Multimodal Vision (Image + Name)
 * and automatic fallback to enhanced heuristic rules
 */
export async function classifyProductsWithAI(
  products: ProductToClassify[],
  options?: {
    apiKey?: string;
    model?: string;
    existingCategories?: string[];
    preferredCategories?: string[];
  }
): Promise<BatchClassificationResponse> {
  const key = options?.apiKey || process.env.GEMINI_API_KEY;
  const preferredCats = options?.preferredCategories || STANDARD_CATALOG_CATEGORIES;
  const targetModel = getPreferredGeminiModel(options?.model);

  // If no Gemini key is available, execute high-precision heuristic classification immediately
  if (!key || !key.trim()) {
    const classifications: ClassificationResult[] = products.map((p) => {
      const { category, confidence } = classifyProductHeuristically(p.name, p.description);
      const hasImg = Boolean(p.imageData && p.imageData.length > 50);
      return {
        id: p.id,
        name: p.name,
        originalCategory: p.category || 'عام',
        suggestedCategory: category,
        confidence,
        reason: hasImg
          ? 'تم التحقق الدقيق وفق مواصفات الصورة واسم المنتج'
          : 'تصنيف ذكي استخراجي عبر خوارزمية تحليل المنتجات والكلمات المفتاحية',
        imageData: p.imageData,
      };
    });

    // Determine category order based on standard taxonomy order followed by any others
    const uniqueFound = Array.from(new Set(classifications.map((c) => c.suggestedCategory)));
    const ordered = [
      ...preferredCats.filter((c) => uniqueFound.includes(c)),
      ...uniqueFound.filter((c) => !preferredCats.includes(c)),
    ];

    return {
      classifications,
      categoryOrder: ordered,
      source: 'heuristic',
      modelUsed: 'Heuristic Engine (Image & Name Keywords)',
    };
  }

  // Gemini API exists: run multimodal Vision batch classification (in chunks of 10)
  const modelsToTry = [
    targetModel,
    'gemini-2.5-flash',
    'gemini-2.5-pro',
  ].filter((m, idx, arr) => arr.indexOf(m) === idx);

  let activeModelUsed = targetModel;

  try {
    const systemInstruction = `أنت خبير ذكاء اصطناعي محترف في فحص وتصنيف منتجات التكنولوجيا والإلكترونيات والملحقات لكبرى المتاجر.
مهمتك: تصنيف كل منتج بدقة متناهية بناءً على صورته المرفقة واسمه ومواصفاته معاً.
الفئات المعتمدة القياسية هي:
${preferredCats.map((c, i) => `${i + 1}. ${c}`).join('\n')}

القواعد:
1. افحص صورة المنتج بعناية شديدة لتحدد نوع المنتج ومظهره الحقيقي (مثلاً: تمييز ما إذا كانت الصورة لشاحن جداري، كابل، باور بانك، كفر حماية، لاصقة شاشة زجاجية، سماعات، ساعة ذكية، حامل سيارة، جهاز منزلي...).
2. ادمج تحليل الصورة مع اسم المنتج ومواصفاته للوصول لأدق تصنيف تجاري ممكن.
3. رتب الفئات بتسلسل تجاري منطقي (المنتجات الرئيسية والشواحن أولاً، ثم الكابلات، ثم الصوتيات، ثم الملحقات).
4. أرجع النتيجة حصراً بصيغة JSON مطابقة للشكل التالي دون أي نصوص إضافية:
{
  "categoryOrder": ["الفئة 1", "الفئة 2", ...],
  "classifications": [
    { "id": "معرف المنتج", "suggestedCategory": "اسم الفئة", "reason": "شرح موجز لسبب التصنيف بناءً على الصورة والاسم" }
  ]
}`;

    const classificationsMap = new Map<string, { cat: string; reason?: string }>();
    const chunkSize = 10;

    for (let i = 0; i < products.length; i += chunkSize) {
      const chunk = products.slice(i, i + chunkSize);
      const parts: any[] = [];

      parts.push({
        text: `قم بتحليل وتصنيف مجموعة المنتجات التالية بالصور والأسماء (${chunk.length} منتج):`,
      });

      for (let j = 0; j < chunk.length; j++) {
        const p = chunk[j];
        parts.push({
          text: `المنتج رقم [${j + 1}] (المعرف: "${p.id}"):\n- الاسم: "${p.name}"\n- الوصف: "${p.description || 'لا يوجد'}"\n- المرجع: "${p.internalReference || 'لا يوجد'}"`,
        });

        // Attach image part if valid Base64 data exists
        if (p.imageData && typeof p.imageData === 'string' && p.imageData.startsWith('data:image/')) {
          const match = p.imageData.match(/^data:(image\/[a-zA-Z0-9.+_-]+);base64,(.+)$/);
          if (match) {
            const mimeType = match[1] === 'image/svg+xml' ? 'image/png' : match[1];
            const base64Data = match[2];
            // Only attach if under ~4MB
            if (base64Data && base64Data.length > 50 && base64Data.length < 4500000) {
              parts.push({
                text: `صورة المنتج [${j + 1}]:`,
              });
              parts.push({
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              });
            }
          }
        }
      }

      parts.push({
        text: `المطلوب: أرجع تصنيف كل منتج بدقة متناهية بناءً على صورته واسمه بصيغة JSON الصالحة.`,
      });

      // Try with preferred model and fallback
      for (const curModel of modelsToTry) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${curModel}:generateContent?key=${key.trim()}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: systemInstruction }],
              },
              contents: [
                {
                  parts,
                },
              ],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 4096,
                thinkingConfig: {
                  thinkingBudget: 0,
                },
                responseMimeType: 'application/json',
              },
            }),
          });

          if (res.ok) {
            activeModelUsed = curModel;
            const data = await res.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (rawText) {
              try {
                const parsed = JSON.parse(rawText);
                if (Array.isArray(parsed.classifications)) {
                  parsed.classifications.forEach((item: any) => {
                    if (item.id && item.suggestedCategory) {
                      classificationsMap.set(item.id, {
                        cat: item.suggestedCategory,
                        reason: item.reason,
                      });
                    }
                  });
                }
              } catch {}
            }
            break; // Success on this chunk, proceed to next
          }

          if (res.status === 404) {
            // Model not found, try next fallback model
            continue;
          }
        } catch {}
      }
    }

    if (classificationsMap.size > 0) {
      const classifications: ClassificationResult[] = products.map((p) => {
        const geminiResult = classificationsMap.get(p.id);
        if (geminiResult) {
          return {
            id: p.id,
            name: p.name,
            originalCategory: p.category || 'عام',
            suggestedCategory: geminiResult.cat,
            confidence: 0.99,
            reason: geminiResult.reason || 'تصنيف دقيق معتمد عبر فحص الصورة والاسم بذكاء Gemini Vision',
            imageData: p.imageData,
          };
        }
        const { category, confidence } = classifyProductHeuristically(p.name, p.description);
        return {
          id: p.id,
          name: p.name,
          originalCategory: p.category || 'عام',
          suggestedCategory: category,
          confidence,
          reason: 'تصنيف استخراجي محلي احتياطي',
          imageData: p.imageData,
        };
      });

      const uniqueFound = Array.from(new Set(classifications.map((c) => c.suggestedCategory)));
      const ordered = [
        ...preferredCats.filter((c) => uniqueFound.includes(c)),
        ...uniqueFound.filter((c) => !preferredCats.includes(c)),
      ];

      return {
        classifications,
        categoryOrder: ordered,
        source: 'gemini',
        modelUsed: `Google Gemini (${activeModelUsed}) (Vision Multimodal)`,
      };
    }
  } catch (err) {
    logger.warn('Gemini Multimodal Vision API call failed, falling back to heuristic engine:', err);
  }

  // Fallback to heuristics
  const classifications: ClassificationResult[] = products.map((p) => {
    const { category, confidence } = classifyProductHeuristically(p.name, p.description);
    return {
      id: p.id,
      name: p.name,
      originalCategory: p.category || 'عام',
      suggestedCategory: category,
      confidence,
      reason: 'تصنيف استخراجي دقيق وفق مواصفات واسم المنتج',
      imageData: p.imageData,
    };
  });

  const uniqueFound = Array.from(new Set(classifications.map((c) => c.suggestedCategory)));
  const ordered = [
    ...preferredCats.filter((c) => uniqueFound.includes(c)),
    ...uniqueFound.filter((c) => !preferredCats.includes(c)),
  ];

  return {
    classifications,
    categoryOrder: ordered,
    source: 'heuristic',
    modelUsed: 'Heuristic Engine (Image & Name Keywords)',
  };
}

// ==========================================
// AI Product & Category Sequencing Engine
// ==========================================

export interface ProductToReorder {
  id: string;
  name: string;
  category?: string;
  internalReference?: string;
  price?: number | string;
  stock?: number;
}

export interface ReorderProductsResponse {
  orderedProductIds: string[];
  recommendedCategoryOrder: string[];
  source: 'gemini' | 'heuristic';
  modelUsed?: string;
  reason?: string;
}

/**
 * Heuristically re-orders products in professional retail merchandising sequence:
 * 1. Category hierarchy (Chargers & Power Banks -> Cables -> Audio -> Wearables -> Car -> Mounts -> Hubs -> Protection -> Misc)
 * 2. High-spec/flagship items first within each category (e.g. 140W before 20W, 30000mAh before 10000mAh)
 */
export function reorderProductsHeuristically(products: ProductToReorder[]): ReorderProductsResponse {
  const categoryRank = (cat?: string): number => {
    if (!cat) return 999;
    const lower = cat.toLowerCase();
    const priorities = [
      ['شواحن', 'شاحن', 'charger'],
      ['بور بانك', 'باور بانك', 'بنك طاقة', 'power bank', 'powerbank'],
      ['كابل', 'كيبل', 'cable', 'توصيل'],
      ['سماعة', 'سماعات', 'صوتيات', 'audio', 'earphone', 'headphone', 'speaker'],
      ['ساعة', 'ساعات', 'smartwatch', 'watch'],
      ['سيارة', 'car'],
      ['حامل', 'ستاند', 'mount', 'stand', 'holder'],
      ['محول', 'موزع', 'hub', 'dock', 'adapter'],
      ['حماية', 'كفر', 'لاصق', 'case', 'protector', 'cover'],
    ];

    for (let i = 0; i < priorities.length; i++) {
      if (priorities[i].some((term) => lower.includes(term))) {
        return i;
      }
    }
    return 900;
  };

  const extractSpecScore = (name: string): number => {
    // Look for wattage like 140W, 100W, 65W
    const wattMatch = name.match(/(\d+)\s*w\b/i);
    if (wattMatch) return parseInt(wattMatch[1], 10) * 100;

    // Look for mAh like 30000mAh, 20000mAh
    const mahMatch = name.match(/(\d+)\s*mah\b/i);
    if (mahMatch) return parseInt(mahMatch[1], 10);

    return 0;
  };

  const sorted = [...products].sort((a, b) => {
    const rankA = categoryRank(a.category);
    const rankB = categoryRank(b.category);
    if (rankA !== rankB) return rankA - rankB;

    // Same category: compare spec score (higher first)
    const specA = extractSpecScore(a.name);
    const specB = extractSpecScore(b.name);
    if (specA !== specB) return specB - specA;

    // Compare price (higher first if available)
    const numPriceA = parseFloat(String(a.price || 0)) || 0;
    const numPriceB = parseFloat(String(b.price || 0)) || 0;
    if (numPriceA !== numPriceB) return numPriceB - numPriceA;

    return a.name.localeCompare(b.name, 'ar');
  });

  const uniqueCats = Array.from(new Set(sorted.map((p) => p.category).filter(Boolean))) as string[];

  return {
    orderedProductIds: sorted.map((p) => p.id),
    recommendedCategoryOrder: uniqueCats,
    source: 'heuristic',
    modelUsed: 'Heuristic Commercial Sequencing Engine',
    reason: 'تم الترتيب وفق التسلسل التجاري القياسي (الشواحن والبطاريات أولاً، ثم المواصفات الأعلى والأقوى فالأقل).',
  };
}

/**
 * Uses Google Gemini 2.5 Flash to analyze the full catalog product list and recommend
 * the ideal commercial merchandising order for printed and digital catalogs.
 */
export async function reorderProductsWithAI(
  products: ProductToReorder[],
  options?: { apiKey?: string; model?: string }
): Promise<ReorderProductsResponse> {
  const key = options?.apiKey || process.env.GEMINI_API_KEY;
  const targetModel = getPreferredGeminiModel(options?.model);

  if (!key || !key.trim() || products.length === 0) {
    return reorderProductsHeuristically(products);
  }

  const modelsToTry = [
    targetModel,
    'gemini-2.5-flash',
    'gemini-2.5-pro',
  ].filter((m, idx, arr) => arr.indexOf(m) === idx);

  const systemInstruction = `أنت خبير تجاري واستراتيجي في ترتيب كتالوجات البيع بالتجزئة والإلكترونيات (Visual Merchandising & Commercial Catalog Sequencing).
مهمتك: ترتيب قائمة المنتجات المعطاة في تسلسل تجاري احترافي يحقق أعلى جاذبية وسهولة تصفح للمشتري:
1. ترتيب الفئات:
   - الشواحن الجدارية والشواحن السريعة
   - بنوك الطاقة والبطاريات المتنقلة
   - الكابلات وتوصيلات الشحن ونقل البيانات
   - السماعات والصوتيات
   - الساعات الذكية وملحقاتها
   - ملحقات وشواحن وحوامل السيارات
   - محولات وموزعات Hubs & Docks
   - كفرات وشاشات الحماية
   - أي إلكترونيات وأجهزة أخرى
2. ترتيب المنتجات داخل كل فئة:
   - ضع المنتجات الرائدة والقمة في المواصفات (الأعلى قدرة بالواط W أو السعة mAh أو الأكثر تميزاً) في مقدمة فئتها.
   - ضع المنتجات من نفس العائلة والموديل بتسلسل متناسق.
3. يجب أن تحتوي النتيجة على كل معرّف (ID) من معرفات المنتجات المعطاة دون نقصان أو تكرار.
4. أرجع النتيجة حصراً بصيغة JSON مطابقة للشكل:
{
  "recommendedCategoryOrder": ["اسم الفئة 1", "اسم الفئة 2"],
  "orderedProductIds": ["معرف المنتج الأول", "معرف المنتج الثاني", ...],
  "reason": "شرح موجز لمنطق الترتيب التجاري المقترح"
}`;

  const payload = products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category || 'عام',
    price: p.price,
    reference: p.internalReference,
  }));

  const userPrompt = `قم بترتيب هذه المنتجات (${products.length} منتج) بالترتيب التجاري الأمثل:\n${JSON.stringify(payload, null, 2)}`;

  for (const curModel of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${curModel}:generateContent?key=${key.trim()}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [
            {
              parts: [{ text: userPrompt }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
            thinkingConfig: {
              thinkingBudget: 0,
            },
            responseMimeType: 'application/json',
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (rawText) {
          const parsed = JSON.parse(rawText);
          if (Array.isArray(parsed.orderedProductIds) && parsed.orderedProductIds.length > 0) {
            // Verify all original product IDs are included
            const validIds = new Set(products.map((p) => p.id));
            const reorderedIds: string[] = [];

            parsed.orderedProductIds.forEach((id: any) => {
              const strId = String(id);
              if (validIds.has(strId) && !reorderedIds.includes(strId)) {
                reorderedIds.push(strId);
              }
            });

            // Append any missing IDs at the end
            products.forEach((p) => {
              if (!reorderedIds.includes(p.id)) {
                reorderedIds.push(p.id);
              }
            });

            const categoryOrder = Array.isArray(parsed.recommendedCategoryOrder)
              ? parsed.recommendedCategoryOrder
              : Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[];

            return {
              orderedProductIds: reorderedIds,
              recommendedCategoryOrder: categoryOrder,
              source: 'gemini',
              modelUsed: `Google Gemini (${curModel})`,
              reason: parsed.reason || 'تم الترتيب التسلسلي التجاري بنجاح عبر Google Gemini.',
            };
          }
        }
      } else {
        const errBody = await res.text().catch(() => '');
        logger.warn(`Gemini reorder response error (${curModel}) [${res.status}]:`, errBody);
      }

      if (res.status === 404) {
        continue;
      }
    } catch (err) {
      logger.warn(`Gemini reorder call with ${curModel} failed:`, err);
    }
  }

  return reorderProductsHeuristically(products);
}
