import { NameShortenItem, NameShortenMode, NameShortenResponse } from '@/types';
import { logger } from '@/lib/security/logger';

export interface ShortenNameOptions {
  mode?: NameShortenMode;
  maxWords?: number;
  apiKey?: string;
}

// Arabic marketing & filler phrases to strip from product titles
const ARABIC_TITLE_FILLERS = [
  /شحن فائق السرعة/gi,
  /شحن فائق/gi,
  /شحن سريع جداً?/gi,
  /شحن سريع/gi,
  /فائق السرعة/gi,
  /سريع جداً?/gi,
  /عالي الجودة/gi,
  /أصلي 100%/gi,
  /اصلي 100%/gi,
  /أصلي ومضمون/gi,
  /اصلي ومضمون/gi,
  /منتج أصلي/gi,
  /أصلي معتمد/gi,
  /معتمد أبل/gi,
  /معتمد ابل/gi,
  /كفالة سنتين/gi,
  /كفالة سنة/gi,
  /ضمان سنتين/gi,
  /ضمان سنة/gi,
  /مع كفالة/gi,
  /مع ضمان/gi,
  /متوافق مع جميع الأجهزة/gi,
  /متوافق مع جميع الاجهزة/gi,
  /لجميع أجهزة الآيفون والأندرويد/gi,
  /لجميع اجهزة الايفون والاندرويد/gi,
  /لجميع الهواتف/gi,
  /للهواتف الذكية/gi,
  /يدعم الشحن السريع/gi,
  /يدعم تقنية/gi,
  /يدعم خاصية/gi,
  /بتقنية الشحن السريع/gi,
  /قماش نايلون ضد القطع/gi,
  /ضد القطع/gi,
  /مخرجين/gi,
  /منفذين/gi,
  /لون\s+(أسود|اسود|أبيض|ابيض|أزرق|ازرق|رمادي|فضي|ذهبي|احمر|أحمر|وردي)/gi,
  /(^|\s)(أسود|اسود|أبيض|ابيض|أزرق|ازرق|رمادي|فضي|ذهبي)(?=\s|$)/gi,
  /(^|\s)(أصلي|اصلي)(?=\s|$)/gi,
  /(^|\s)(بمنفذ|بقوة|بسعة|بقدرة|بطول|طول|يو اس بي)(?=\s|$)/gi,
  /سارع بالحصول عليه/gi,
  /الأفضل مبيعاً/gi,
  /الأكثر طلباً/gi,
];

// English marketing & filler phrases to strip from product titles
const ENGLISH_TITLE_FILLERS = [
  /\b(ultra|super)?\s*fast\s+charging\b/gi,
  /\b(ultra|super)?\s*fast\b/gi,
  /\bquick\s+charge(\s+\d\.\d)?\b/gi,
  /\bpower\s+delivery\b/gi,
  /\bhigh\s+quality\b/gi,
  /\b100%\s+original\b/gi,
  /\boriginal\s+authentic\b/gi,
  /\bgenuine\s+original\b/gi,
  /\b\d\s+years?\s+warranty\b/gi,
  /\bwith\s+warranty\b/gi,
  /\bwarranty\s+included\b/gi,
  /\bcompatible\s+with\s+[^\s,]+/gi,
  /\bfor\s+iphone\s+and\s+android\b/gi,
  /\buniversal\b/gi,
  /\b(folding\s+)?(us\/uk\s+)?plug\b/gi,
  /\bdual\s+ports?\b/gi,
  /\bcolor\s+(black|white|blue|grey|gray|silver|gold)\b/gi,
  /\b(black|white|blue|grey|gray|silver|gold)\b/gi,
  /\bbest\s+seller\b/gi,
  /\bspecial\s+edition\b/gi,
];

/**
 * Heuristically shortens a product name by removing marketing clutter,
 * stripping internal reference codes, normalizing units, and focusing strictly on Brand, Type, and Key Specs.
 */
export function shortenProductNameHeuristically(
  name: string,
  mode: NameShortenMode = 'short',
  customMaxWords?: number,
  internalReference?: string
): { shortened: string; wordCount: number; reductionPercent: number } {
  if (!name || !name.trim()) {
    return { shortened: '', wordCount: 0, reductionPercent: 0 };
  }

  const raw = name.trim();
  let cleaned = raw;

  // 0. Explicitly remove internal reference code from the product name if present
  if (internalReference && internalReference.trim().length > 1) {
    const escaped = internalReference.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const refRegexes = [
      new RegExp(`\\[\\s*${escaped}\\s*\\]`, 'gi'),
      new RegExp(`\\(\\s*${escaped}\\s*\\)`, 'gi'),
      new RegExp(`(?:^|\\s)[-–—|:]?\\s*${escaped}\\b`, 'gi'),
      new RegExp(`\\b${escaped}\\b`, 'gi'),
    ];
    refRegexes.forEach((r) => {
      cleaned = cleaned.replace(r, ' ');
    });
  }

  // Remove common ERP prefixes like [REF-123] at start or end of name
  cleaned = cleaned.replace(/^\[[A-Za-z0-9_\-\.\/]+\]\s*/g, '');
  cleaned = cleaned.replace(/\s*\[[A-Za-z0-9_\-\.\/]+\]$/g, '');
  cleaned = cleaned.replace(/(?:^|\s)(?:مرجع|كود|رمز|ref|sku|item\s*code|internal\s*ref)[:\s\-#]*[A-Za-z0-9\-_.]+/gi, ' ');

  // 1. Remove Arabic & English fillers
  ARABIC_TITLE_FILLERS.forEach((regex) => {
    cleaned = cleaned.replace(regex, ' ');
  });
  ENGLISH_TITLE_FILLERS.forEach((regex) => {
    cleaned = cleaned.replace(regex, ' ');
  });

  // 2. Remove common extra symbols like parentheses with promo, brackets, excessive dashes
  cleaned = cleaned
    .replace(/\([^\)]*(ضمان|كفالة|أصلي|warranty|original|free)[^\)]*\)/gi, '')
    .replace(/\[[^\]]*(ضمان|كفالة|أصلي|warranty|original|free)[^\]]*\]/gi, '')
    .replace(/\s*[-–—|]\s*(أصلي|مضمون|كفالة|ضمان|original|warranty).*/gi, '')
    .trim();

  // 3. Normalize common units into standard compact specs
  // e.g. "30 واط" -> "30W", "20000 مللي امبير" -> "20000mAh", "1.2 متر" -> "1.2M"
  cleaned = cleaned
    .replace(/(\d+)\s*(واط|watt|w)(?=\s|$|[^\w\u0600-\u06FF])/gi, '$1W')
    .replace(/(\d+)\s*(مللي\s*أمبير|مللي\s*امبير|mah)(?=\s|$|[^\w\u0600-\u06FF])/gi, '$1mAh')
    .replace(/(\d+(\.\d+)?)\s*(متر|meter|m)(?=\s|$|[^\w\u0600-\u06FF])/gi, '$1M')
    .replace(/تايب\s*سي/gi, 'Type-C')
    .replace(/لايتنينغ/gi, 'Lightning')
    .replace(/\s+/g, ' ')
    .trim();

  // 4. Determine target word limit based on mode
  let targetLimit = 5;
  if (mode === 'very_short') targetLimit = 3;
  else if (mode === 'short') targetLimit = 5;
  else if (mode === 'medium') targetLimit = 7;
  else if (mode === 'custom' && customMaxWords) targetLimit = customMaxWords;

  const words = cleaned.split(/\s+/).filter(Boolean);

  let shortened = '';
  if (words.length <= targetLimit) {
    shortened = cleaned;
  } else {
    // Priority patterns for essential spec tokens (e.g. 20W, 65W, GaN, 10000mAh, 1.2M, Type-C, Lightning, Pro, Max)
    const specRegex = /^(\d+(W|mAh|M|GB|TB)?)$|^(GaN\d?|Nano\d?|Type-C|Lightning|USB-C|Pro|Max|Plus|Ultra|Mini)$/i;

    const leadLimit = Math.min(3, targetLimit - 1);
    const leadWords = words.slice(0, leadLimit);
    const remainder = words.slice(leadLimit);

    // Filter and prioritize remainder
    const specWords = remainder.filter((w) => specRegex.test(w.replace(/[(),+]/g, '')));
    const otherWords = remainder.filter((w) => !specRegex.test(w.replace(/[(),+]/g, '')));

    // Sort spec words so tokens with actual units (W, mAh, M, GaN) come before single digits
    specWords.sort((a, b) => {
      const aHasUnit = /\d+(W|mAh|M|GB|TB)/i.test(a) || /GaN/i.test(a);
      const bHasUnit = /\d+(W|mAh|M|GB|TB)/i.test(b) || /GaN/i.test(b);
      if (aHasUnit && !bHasUnit) return -1;
      if (!aHasUnit && bHasUnit) return 1;
      return 0;
    });

    const result = [...leadWords];
    for (const sw of specWords) {
      if (result.length < targetLimit && !result.includes(sw)) {
        result.push(sw);
      }
    }
    for (const ow of otherWords) {
      if (result.length < targetLimit && !result.includes(ow)) {
        result.push(ow);
      }
    }

    shortened = result.join(' ');
  }

  // Clean trailing punctuation
  shortened = shortened.replace(/[،,.\-:;+]+$/, '').trim();

  const finalWordCount = shortened.split(/\s+/).filter(Boolean).length;
  const initialLen = raw.length;
  const finalLen = shortened.length;
  const reductionPercent =
    initialLen > 0 ? Math.max(0, Math.round(((initialLen - finalLen) / initialLen) * 100)) : 0;

  return {
    shortened: shortened || raw,
    wordCount: finalWordCount,
    reductionPercent,
  };
}

/**
 * Shortens product names in batch using Google Gemini 1.5 Flash with fallback to smart heuristics.
 * Strictly guarantees that internal references and SKU codes are NOT part of the product name.
 */
export async function batchShortenProductNames(
  products: { id: string; name: string; category?: string; internalReference?: string }[],
  options?: ShortenNameOptions
): Promise<NameShortenResponse> {
  const mode = options?.mode || 'short';
  const customLimit = options?.maxWords;
  const key = options?.apiKey || process.env.GEMINI_API_KEY;

  let targetWordLimit = 5;
  if (mode === 'very_short') targetWordLimit = 3;
  else if (mode === 'short') targetWordLimit = 5;
  else if (mode === 'medium') targetWordLimit = 7;
  else if (mode === 'custom' && customLimit) targetWordLimit = customLimit;

  // If no Gemini key is provided, execute local smart heuristic shortener immediately
  if (!key || !key.trim()) {
    const results: NameShortenItem[] = products.map((p) => {
      const { shortened, wordCount, reductionPercent } = shortenProductNameHeuristically(
        p.name,
        mode,
        customLimit,
        p.internalReference
      );
      return {
        id: p.id,
        originalName: p.name,
        shortenedName: shortened,
        wordCount,
        reductionPercent,
        reason: 'حذف المرجع الداخلي والحشو التسويقي والاحتفاظ بالماركة ونوع المنتج والمواصفة الأساسية',
      };
    });

    return {
      results,
      source: 'heuristic',
      modelUsed: 'Heuristic Title Engine',
    };
  }

  // Gemini API integration
  try {
    const modelsToTry = [
      process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      'gemini-2.5-flash',
      'gemini-2.5-pro',
    ].filter((m, idx, arr) => arr.indexOf(m) === idx);

    const systemInstruction = `أنت خبير لغوي متخصص في تصميم كتالوجات المنتجات التجارية للطباعة.
مهمتك: اختصار أسماء المنتجات الطويلة لتكون عناوين مدمجة وأنيقة تتناسب مع جداول الكتالوج المطبوع.

القواعد الصارمة والإلزامية:
1. استخرج اسماً مختصراً احترافياً مركزاً (أقصى حد: ${targetWordLimit} كلمات).
2. احتفظ بـ: الماركة (Brand)، نوع المنتج الرئيسي (شاحن / كابل / بنك طاقة / سماعة...)، وأهم مواصفة أساسية (مثل 65W GaN أو 20000mAh أو Type-C أو Pro).
3. احذف تماماً ودون استثناء أي مرجع داخلي أو رمز SKU أو كود منتج (مثل MOX-CH-65W أو A2147 أو [REF-01])؛ المرجع الداخلي له عمود وحقل منفصل في الكتالوج ويمنع منعاً باتاً ظهوره ضمن اسم المنتج.
4. احذف تماماً: الحشو التسويقي (مثل "أصلي ومضمون"، "فائق السرعة"، "كفالة سنة")، وتفاصيل التوافق الطويلة، والألوان المكررة.
5. حافظ على لغة المنتج الأصلية (العربية للعربية، والإنجليزية للإنجليزية).
6. لا تخترع أي معلومات أو موديلات غير موجودة في الاسم الأصلي.
7. أرجع النتيجة حصراً بصيغة JSON مطابقة للشكل التالي:
{
  "items": [
    { "id": "معرف المنتج", "shortenedName": "الاسم المختصر بدون مرجع داخلي", "reason": "سبب الحذف" }
  ]
}`;

    const payload = products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      internalReference: p.internalReference,
    }));

    const userPrompt = `اختصر أسماء هذه المنتجات (${products.length} منتج) بحد أقصى ${targetWordLimit} كلمات، مع حذف أي مرجع داخلي نهائياً من الاسم:\n${JSON.stringify(payload, null, 2)}`;

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
              maxOutputTokens: 2048,
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
            const map = new Map<string, { shortened: string; reason?: string }>();
            if (Array.isArray(parsed.items)) {
              parsed.items.forEach((item: any) => {
                if (item.id && item.shortenedName) {
                  map.set(item.id, { shortened: item.shortenedName.trim(), reason: item.reason });
                }
              });
            }

            const results: NameShortenItem[] = products.map((p) => {
              const geminiResult = map.get(p.id);
              if (geminiResult && geminiResult.shortened) {
                // Guarantee internal reference is stripped even if Gemini included it
                let finalShortened = geminiResult.shortened;
                if (p.internalReference && p.internalReference.trim().length > 1) {
                  const esc = p.internalReference.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                  finalShortened = finalShortened.replace(new RegExp(`\\[?${esc}\\]?`, 'gi'), '').trim();
                }
                const originalWords = p.name.trim().split(/\s+/).length;
                const shortenedWords = finalShortened.split(/\s+/).length;
                const reduction = Math.max(0, Math.round(((originalWords - shortenedWords) / originalWords) * 100));

                return {
                  id: p.id,
                  originalName: p.name,
                  shortenedName: finalShortened,
                  wordCount: shortenedWords,
                  reductionPercent: reduction,
                  reason: geminiResult.reason || 'اختصار ذكي عبر Google Gemini بدون مرجع داخلي',
                  accepted: true,
                };
              }

              const fallback = shortenProductNameHeuristically(p.name, mode, customLimit, p.internalReference);
              return {
                id: p.id,
                originalName: p.name,
                shortenedName: fallback.shortened,
                wordCount: fallback.wordCount,
                reductionPercent: fallback.reductionPercent,
                reason: 'اختصار استخراجي محلي',
                accepted: true,
              };
            });

            return {
              results,
              source: 'gemini',
              modelUsed: `Google Gemini (${curModel})`,
            };
          }
        }

        if (res.status === 404) continue;
      } catch (innerErr) {
        logger.warn(`Gemini name shortener with ${curModel} failed:`, innerErr);
      }
    }
  } catch (err) {
    logger.warn('Gemini Name Shortening API failed, falling back to heuristics:', err);
  }

  // Fallback if API fails or network issue occurs
  const results: NameShortenItem[] = products.map((p) => {
    const heuristic = shortenProductNameHeuristically(p.name, mode, customLimit, p.internalReference);
    return {
      id: p.id,
      originalName: p.name,
      shortenedName: heuristic.shortened,
      wordCount: heuristic.wordCount,
      reductionPercent: heuristic.reductionPercent,
      reason: 'اختصار محلي ذكي بدون مرجع داخلي (احتياطي)',
    };
  });

  return {
    results,
    source: 'heuristic',
    modelUsed: 'Heuristic Title Engine (Offline Fallback)',
  };
}
