import { AI_SYSTEM_PROMPT, buildShortenPrompt } from './prompts';
import { logger } from '@/lib/security/logger';

export interface ShortenOptions {
  originalDescription: string;
  wordLimit: number;
  productName?: string;
  apiKey?: string;
}

export interface ShortenResult {
  shortenedDescription: string;
  wordCount: number;
  language: 'ar' | 'en' | 'mixed';
}

// Arabic filler patterns that add no technical information
const ARABIC_FILLER_PATTERNS = [
  /يتميز هذا المنتج الرائع/gi,
  /يتميز المنتج/gi,
  /يعتبر الخيار الأمثل/gi,
  /أفضل جودة في السوق/gi,
  /عالي الجودة جداً/gi,
  /تصميم أنيق وجذاب/gi,
  /بأفضل أداء ممكن/gi,
  /سارع بالحصول عليه/gi,
  /منتج أصلي ومضمون/gi,
  /مناسب لجميع الاستخدامات/gi,
  /لا مثيل له/gi,
  /بشكل لا يصدق/gi,
  /رائع ومميز/gi,
];

// English filler patterns
const ENGLISH_FILLER_PATTERNS = [
  /this amazing product features/gi,
  /the ultimate choice for/gi,
  /best in class performance/gi,
  /high quality guaranteed/gi,
  /sleek and stylish design/gi,
  /take your experience to the next level/gi,
  /perfect for all your needs/gi,
  /revolutionary new/gi,
];

function detectLanguage(text: string): 'ar' | 'en' | 'mixed' {
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const englishChars = (text.match(/[A-Za-z]/g) || []).length;

  if (arabicChars > englishChars * 1.5) return 'ar';
  if (englishChars > arabicChars * 1.5) return 'en';
  return 'mixed';
}

/**
 * Intelligent deterministic extractive shortener that strictly extracts
 * facts, specifications, and numbers from the original text without inventing anything.
 */
export function extractFactualSummary(text: string, wordLimit: number): string {
  if (!text || !text.trim()) return '';

  let cleaned = text.trim();

  // Strip filler phrases
  ARABIC_FILLER_PATTERNS.forEach((pattern) => {
    cleaned = cleaned.replace(pattern, '');
  });
  ENGLISH_FILLER_PATTERNS.forEach((pattern) => {
    cleaned = cleaned.replace(pattern, '');
  });

  // Clean redundant whitespace and punctuation
  cleaned = cleaned.replace(/\s+/g, ' ').replace(/[،,\s]+$/, '').trim();

  // Split into clauses by punctuation (commas, periods, semicolons, bullets)
  const clauses = cleaned
    .split(/[،,.;\n|•\-\–]/)
    .map((c) => c.trim())
    .filter((c) => c.length > 2);

  if (clauses.length === 0) {
    const words = cleaned.split(/\s+/);
    return words.slice(0, wordLimit).join(' ');
  }

  // Prioritize clauses with technical specs, numbers, or units
  const techPattern = /\d+|mah|w|gb|tb|hz|khz|ip\d+|type-c|lightning|usb|gan|oled|amoled|anc|dpi|bluetooth|بلوتوث|واط|مللي|أمبير|بوصة|مم/i;

  const prioritizedClauses: string[] = [];
  const normalClauses: string[] = [];

  clauses.forEach((clause) => {
    if (techPattern.test(clause)) {
      prioritizedClauses.push(clause);
    } else {
      normalClauses.push(clause);
    }
  });

  const orderedClauses = [...prioritizedClauses, ...normalClauses];
  const selectedClauses: string[] = [];
  let currentWordCount = 0;

  for (const clause of orderedClauses) {
    const clauseWords = clause.split(/\s+/).filter(Boolean);
    if (currentWordCount + clauseWords.length <= wordLimit) {
      selectedClauses.push(clause);
      currentWordCount += clauseWords.length;
    } else if (selectedClauses.length === 0) {
      // If even the first clause exceeds wordLimit, truncate words
      selectedClauses.push(clauseWords.slice(0, wordLimit).join(' '));
      break;
    }
  }

  const result = selectedClauses.join('، ');
  return result.endsWith('.') || result.endsWith('،') ? result.replace(/[،,]$/, '') + '.' : result + '.';
}

/**
 * Shortens product description using Gemini API if key is available,
 * or using our strict deterministic extractive algorithm.
 */
export async function shortenProductDescription(options: ShortenOptions): Promise<ShortenResult> {
  const { originalDescription, wordLimit, productName, apiKey } = options;

  if (!originalDescription || !originalDescription.trim()) {
    return { shortenedDescription: '', wordCount: 0, language: 'ar' };
  }

  const lang = detectLanguage(originalDescription);
  const geminiKey = apiKey || process.env.GEMINI_API_KEY;

  if (geminiKey) {
    const modelsToTry = [
      process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      'gemini-2.5-flash',
      'gemini-2.5-pro',
    ].filter((m, idx, arr) => arr.indexOf(m) === idx);

    for (const curModel of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${curModel}:generateContent?key=${geminiKey.trim()}`;
        const prompt = buildShortenPrompt(originalDescription, wordLimit, productName);

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: AI_SYSTEM_PROMPT }],
            },
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.1, // low temperature to strictly forbid hallucination
              maxOutputTokens: 2048,
              thinkingConfig: {
                thinkingBudget: 0,
              },
            },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (candidate) {
            // Clean quotes if returned
            const cleanedText = candidate.replace(/^["'«]/, '').replace(/["'»]$/, '').trim();
            const words = cleanedText.split(/\s+/).filter(Boolean);
            return {
              shortenedDescription: cleanedText,
              wordCount: words.length,
              language: lang,
            };
          }
        }

        if (res.status === 404) {
          continue;
        }
      } catch (err) {
        logger.warn(`Gemini API call failed for model ${curModel}:`, err);
      }
    }
  }

  // Extractive fallback
  const fallback = extractFactualSummary(originalDescription, wordLimit);
  const words = fallback.split(/\s+/).filter(Boolean);

  return {
    shortenedDescription: fallback,
    wordCount: words.length,
    language: lang,
  };
}
