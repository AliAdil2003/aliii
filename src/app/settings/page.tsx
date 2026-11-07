'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Database,
  Sparkles,
  DollarSign,
  Type,
  Building,
  Save,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Zap,
  Check,
  ShieldCheck,
  Warehouse,
  Boxes,
  KeyRound,
  ExternalLink,
  ShoppingBag,
} from 'lucide-react';
import { isAppwriteConfigured } from '@/lib/appwrite/client';
import { OdooTestResult, ShopifyTestResult } from '@/types';

export default function SettingsPage() {
  const [appwriteEndpoint, setAppwriteEndpoint] = useState(
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1'
  );
  const [appwriteProjectId, setAppwriteProjectId] = useState(
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || ''
  );
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [hasServerKey, setHasServerKey] = useState(false);
  const [serverMaskedKey, setServerMaskedKey] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('د.ع');
  const [currencyPosition, setCurrencyPosition] = useState<'suffix' | 'prefix'>('suffix');
  const [companyName, setCompanyName] = useState('كتالوج المنتجات الرسمي');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Gemini Test state
  const [geminiModel, setGeminiModel] = useState<string>('gemini-2.5-flash');
  const [testingGemini, setTestingGemini] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
    latencyMs?: number;
    model?: string;
  } | null>(null);

  // Odoo ERP State
  const [odooUrl, setOdooUrl] = useState('');
  const [odooDb, setOdooDb] = useState('');
  const [odooUsername, setOdooUsername] = useState('');
  // Secrets are never shipped to the browser. Leave empty to keep the key stored in .env.local on the server.
  const [odooApiKey, setOdooApiKey] = useState('');
  const [odooMaskedKey, setOdooMaskedKey] = useState('');
  const [odooSalePriceField, setOdooSalePriceField] = useState('lst_price');
  const [odooCustomerPriceField, setOdooCustomerPriceField] = useState('customer_sale_price');
  const [isOdooConfigured, setIsOdooConfigured] = useState(false);
  const [testingOdoo, setTestingOdoo] = useState(false);
  const [odooTestResult, setOdooTestResult] = useState<OdooTestResult | null>(null);

  // Shopify Store State
  const [shopifyStoreDomain, setShopifyStoreDomain] = useState('');
  const [shopifyMyshopifyDomain, setShopifyMyshopifyDomain] = useState('');
  const [shopifyClientId, setShopifyClientId] = useState('');
  const [shopifyClientSecret, setShopifyClientSecret] = useState('');
  const [isShopifyConfigured, setIsShopifyConfigured] = useState(false);
  const [testingShopify, setTestingShopify] = useState(false);
  const [shopifyTestResult, setShopifyTestResult] = useState<ShopifyTestResult | null>(null);

  // Fetch initial AI, Odoo, and Shopify status
  useEffect(() => {
    fetch('/api/ai/test-connection')
      .then((res) => res.json())
      .then((data) => {
        if (data.hasKey) {
          setHasServerKey(true);
          setServerMaskedKey(data.maskedKey || 'مفتاح محفوظ');
        }
        if (data.currentModel) {
          setGeminiModel(data.currentModel);
        }
      })
      .catch(() => {});

    fetch('/api/odoo/test-connection')
      .then((res) => res.json())
      .then((data) => {
        if (data.configured) {
          setIsOdooConfigured(true);
        }
        if (data.url) setOdooUrl(data.url);
        if (data.db) setOdooDb(data.db);
        if (data.username) setOdooUsername(data.username);
        if (data.maskedApiKey) setOdooMaskedKey(data.maskedApiKey);
        if (data.salePriceField) setOdooSalePriceField(data.salePriceField);
        if (data.customerPriceField) setOdooCustomerPriceField(data.customerPriceField);
      })
      .catch(() => {});

    fetch('/api/shopify/test-connection')
      .then((res) => res.json())
      .then((data) => {
        if (data.success || data.configured) {
          setIsShopifyConfigured(true);
        }
        if (data.storeDomain) setShopifyStoreDomain(data.storeDomain);
        if (data.myshopifyDomain) setShopifyMyshopifyDomain(data.myshopifyDomain);
      })
      .catch(() => {});
  }, []);

  const handleTestGemini = async () => {
    setTestingGemini(true);
    setGeminiTestResult(null);

    try {
      const res = await fetch('/api/ai/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: geminiApiKey || undefined,
          model: geminiModel,
        }),
      });
      const data = await res.json();
      setGeminiTestResult({
        tested: true,
        success: data.success,
        message: data.message,
        latencyMs: data.latencyMs,
        model: data.model,
      });
      if (data.success && geminiApiKey) {
        setHasServerKey(true);
      }
    } catch (err: any) {
      setGeminiTestResult({
        tested: true,
        success: false,
        message: `خطأ أثناء فحص الاتصال: ${err.message}`,
        model: geminiModel,
      });
    } finally {
      setTestingGemini(false);
    }
  };

  const handleTestOdoo = async () => {
    setTestingOdoo(true);
    setOdooTestResult(null);

    // Auto-clean URL to origin
    let cleanUrl = odooUrl.trim();
    if (cleanUrl) {
      try {
        const parsed = new URL(cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`);
        cleanUrl = parsed.origin;
        setOdooUrl(cleanUrl);
      } catch {}
    }

    try {
      const res = await fetch('/api/odoo/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: cleanUrl,
          db: odooDb,
          username: odooUsername,
          apiKey: odooApiKey.trim() || undefined,
          salePriceField: odooSalePriceField,
          customerPriceField: odooCustomerPriceField,
        }),
      });
      const data = await res.json();
      setOdooTestResult(data);
      if (data.database && data.database !== odooDb) {
        setOdooDb(data.database);
      }
      if (data.success) {
        setIsOdooConfigured(true);
      }
    } catch (err: any) {
      setOdooTestResult({
        success: false,
        message: `خطأ أثناء فحص اتصال Odoo: ${err.message}`,
      });
    } finally {
      setTestingOdoo(false);
    }
  };

  const handleTestShopify = async () => {
    setTestingShopify(true);
    setShopifyTestResult(null);

    try {
      const res = await fetch('/api/shopify/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeDomain: shopifyStoreDomain,
          myshopifyDomain: shopifyMyshopifyDomain,
          clientId: shopifyClientId.trim() || undefined,
          clientSecret: shopifyClientSecret.trim() || undefined,
        }),
      });
      const data = await res.json();
      setShopifyTestResult(data);
      if (data.success) {
        setIsShopifyConfigured(true);
      }
    } catch (err: any) {
      setShopifyTestResult({
        tested: true,
        success: false,
        message: `خطأ أثناء فحص اتصال Shopify: ${err.message}`,
      });
    } finally {
      setTestingShopify(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Save Gemini settings (key and model)
    try {
      await fetch('/api/ai/save-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: geminiApiKey.trim() || undefined,
          model: geminiModel,
        }),
      });
      if (geminiApiKey.trim()) {
        setHasServerKey(true);
      }
    } catch (err) {
      console.error('Failed to save Gemini settings:', err);
    }

    // 2. Save Odoo configuration
    try {
      await fetch('/api/odoo/save-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: odooUrl,
          db: odooDb,
          username: odooUsername,
          apiKey: odooApiKey.trim() || undefined,
          salePriceField: odooSalePriceField,
          customerPriceField: odooCustomerPriceField,
        }),
      });
      if (odooUrl && odooDb && odooUsername && (odooApiKey || odooMaskedKey)) {
        setIsOdooConfigured(true);
      }
    } catch (err) {
      console.error('Failed to save Odoo config:', err);
    }

    // 3. Save Shopify configuration
    try {
      await fetch('/api/shopify/save-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeDomain: shopifyStoreDomain,
          myshopifyDomain: shopifyMyshopifyDomain,
          clientId: shopifyClientId.trim() || undefined,
          clientSecret: shopifyClientSecret.trim() || undefined,
        }),
      });
      if (shopifyClientSecret) {
        setIsShopifyConfigured(true);
      }
      // Clear secret inputs after saving so they don't stay in memory/DOM
      setOdooApiKey('');
      setShopifyClientSecret('');
      setGeminiApiKey('');
    } catch (err) {
      console.error('Failed to save Shopify config:', err);
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="max-w-4xl w-full mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200/60">
        <div className="w-10 h-10 rounded-2xl bg-[#01334E] text-white flex items-center justify-center font-bold shadow-sm">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-black font-cairo text-slate-900 tracking-tight">إعدادات المنظومة والربط</h1>
          <p className="text-xs text-slate-500">
            تخصيص الاتصال بـ Odoo ERP، متجر Shopify، محرك Google Gemini AI، وخيارات الكتالوج
          </p>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>تم حفظ الإعدادات وتحديث مفاتيح المنظومة بنجاح.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Google Gemini AI Integration Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-sm text-slate-900 font-cairo">
                محرك الذكاء الاصطناعي الكامل (Google Gemini 2.5 / 2.0 / 1.5 Flash)
              </h3>
            </div>
            <span
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                hasServerKey
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  hasServerKey ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              {hasServerKey ? `متصل بـ ${geminiModel}` : 'محرك الاستخراج الذكي المدمج نشط'}
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            يدعم Catalog Studio التكامل التام مع <strong>Google Gemini (موديل 2.5 و 2.0)</strong> لتصنيف المنتجات تلقائياً بالصور والأسماء، واقتراح تسلسل العرض الأمثل، واختصار الأوصاف والأسماء بدقة متناهية.
          </p>

          {/* Model Selector & Free API Key Link */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                <span>نموذج الذكاء الاصطناعي (Gemini Model)</span>
                <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  موديل 2.5 متاح
                </span>
              </label>
              <select
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500"
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (الأحدث والأسرع - افتراضي)</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash (الجيل الثاني فائق السرعة)</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash (مستقر ومعتمد)</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro (أعلى قدرات استدلال)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                <span>الحصول على مفتاح API مجاني</span>
                <span className="text-[10px] text-sky-600 font-bold">Google AI Studio</span>
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors shadow-sm"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>إنشاء ونسخ المفتاح من Google AI Studio</span>
              </a>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800">
                Google Gemini API Key
              </label>
              {hasServerKey && (
                <span className="text-[11px] font-mono text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded">
                  المفتاح الحالي: {serverMaskedKey || 'نشط ومحفوظ'}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder={hasServerKey ? 'أدخل مفتاحاً جديداً لتغيير المفتاح الحالي (يبدأ بـ AIzaSy...)' : 'AIzaSy...'}
                className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-inter focus:outline-none focus:border-sky-500"
              />

              <button
                type="button"
                onClick={handleTestGemini}
                disabled={testingGemini}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 whitespace-nowrap shadow-sm disabled:opacity-50"
              >
                {testingGemini ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>فحص الاتصال بـ {geminiModel}</span>
              </button>
            </div>

            {/* Test Connection Feedback */}
            {geminiTestResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 mt-2 ${
                  geminiTestResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {geminiTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <div className="font-bold">{geminiTestResult.message}</div>
                  {geminiTestResult.latencyMs && (
                    <div className="text-[10px] text-slate-500 font-mono">
                      زمن الاستجابة: {geminiTestResult.latencyMs}ms | النموذج: {geminiTestResult.model}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-500 bg-sky-50/70 border border-sky-100 rounded-xl p-3 flex items-start gap-2 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
            <span>
              <strong>الأمان والخصوصية:</strong> يتم حفظ المفتاح بأمان داخل بيئة الخادم ولا يتم كشفه للعميل. في حال عدم توفر مفتاح، تعمل خوارزميات التصنيف والاستخراج الذكية المدمجة محلياً بصورة كاملة وفورية.
            </span>
          </div>
        </div>

        {/* Odoo ERP Integration Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Warehouse className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="font-bold text-sm text-slate-900 font-cairo">
                  ربط وتكامل نظام المخازن والمستودعات (Odoo ERP)
                </h3>
                <p className="text-[11px] text-slate-500">
                  ربط مباشر مع برنامج Odoo لجلب المنتجات والكميات باليد وتحديث المخزون والأسعار حياً
                </p>
              </div>
            </div>
            <span
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                isOdooConfigured
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isOdooConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              {isOdooConfigured ? 'متصل بنظام Odoo ERP' : 'غير متصل بعد'}
            </span>
          </div>

          {/* Connection Credentials */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                رابط خادم Odoo (URL)
              </label>
              <input
                type="text"
                value={odooUrl}
                onChange={(e) => setOdooUrl(e.target.value)}
                placeholder="https://e-zone-iraq.odoo.com"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-inter focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                الرابط الأساسي فقط بدون /odoo (مثال:{' '}
                <button
                  type="button"
                  onClick={() => setOdooUrl('https://e-zone-iraq.odoo.com')}
                  className="font-mono text-indigo-600 underline font-semibold"
                >
                  https://e-zone-iraq.odoo.com
                </button>
                )
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>اسم قاعدة البيانات (Database Name)</span>
                <span className="text-[10px] text-slate-400">معرف بالإنجليزية</span>
              </label>
              <input
                type="text"
                value={odooDb}
                onChange={(e) => setOdooDb(e.target.value)}
                placeholder="husamra723-e-zone-main-33171408"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-inter focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[10px] text-amber-700 mt-1 flex items-center gap-1">
                <span>قاعدة بيانات موقعكم هي:</span>
                <button
                  type="button"
                  onClick={() => setOdooDb('husamra723-e-zone-main-33171408')}
                  className="font-mono font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded transition-colors"
                >
                  husamra723-e-zone-main-33171408
                </button>
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>اسم المستخدم أو الحساب في Odoo</span>
                <span className="text-[10px] text-emerald-600 font-bold">اسم الحساب المسجل</span>
              </label>
              <input
                type="text"
                value={odooUsername}
                onChange={(e) => setOdooUsername(e.target.value)}
                placeholder="المنطقة التقنية"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-inter focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                <span>اسم حساب Odoo المرتبط بمفتاح الـ API هو:</span>
                <button
                  type="button"
                  onClick={() => setOdooUsername('المنطقة التقنية')}
                  className="font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded hover:bg-indigo-100 transition-colors"
                >
                  المنطقة التقنية
                </button>
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>مفتاح API لبرنامج Odoo (API Key)</span>
                {odooMaskedKey && (
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded font-mono">
                    محفوظ على الخادم: {odooMaskedKey}
                  </span>
                )}
              </label>
              <input
                type="password"
                value={odooApiKey}
                onChange={(e) => setOdooApiKey(e.target.value)}
                placeholder={odooMaskedKey ? 'اتركه فارغاً للإبقاء على المفتاح المحفوظ في .env.local' : 'أدخل مفتاح Odoo API...'}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-inter focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Dedicated Price Mapping Rules Section */}
          <div className="bg-slate-50/80 rounded-xl border border-slate-200/80 p-4 space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>قواعد وخريطة جلب الأسعار المعتمدة من برنامج Odoo:</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {/* Wholesale / Sale Price */}
              <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                <div className="text-[11px] font-bold text-slate-500 flex items-center justify-between">
                  <span>سعر البيع (الجملة)</span>
                  <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">lst_price</span>
                </div>
                <div className="font-bold text-slate-800 text-sm">سعر البيع في Odoo</div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  يؤخذ مباشرة من حقل سعر البيع (Sales Price) في Odoo ويتحول إلى سعر البيع (الجملة) في الموقع.
                </p>
              </div>

              {/* Customer / Retail Price */}
              <div className="bg-white p-3 rounded-lg border border-sky-200 bg-sky-50/20 space-y-1">
                <div className="text-[11px] font-bold text-sky-600 flex items-center justify-between">
                  <span>سعر بيع الزبون</span>
                  <span className="font-mono text-[10px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded">customer_sale_price</span>
                </div>
                <div className="font-bold text-sky-900 text-sm">سعر بيع الزبون في Odoo</div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  يؤخذ مباشرة من حقل سعر بيع الزبون (Customer Sale Price) ويصبح السعر الأساسي للزبائن.
                </p>
              </div>

              {/* Strict Cost Price Exclusion */}
              <div className="bg-white p-3 rounded-lg border border-rose-200 bg-rose-50/20 space-y-1">
                <div className="text-[11px] font-bold text-rose-600 flex items-center justify-between">
                  <span>سعر التكلفة (Cost)</span>
                  <span className="font-mono text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded line-through">standard_price</span>
                </div>
                <div className="font-bold text-rose-800 text-sm">مستبعد كلياً (محمي)</div>
                <p className="text-[10px] text-rose-700/80 leading-relaxed font-semibold">
                  لا يتم سحب التكلفة ولا يتم استخدامها بأي شكل من الأشكال بناءً على توجيهاتكم.
                </p>
              </div>
            </div>

            {/* Optional Field Customization Collapsible / Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  حقل سعر البيع (الجملة) في Odoo:
                </label>
                <input
                  type="text"
                  value={odooSalePriceField}
                  onChange={(e) => setOdooSalePriceField(e.target.value)}
                  placeholder="lst_price"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  حقل سعر بيع الزبون في Odoo:
                </label>
                <input
                  type="text"
                  value={odooCustomerPriceField}
                  onChange={(e) => setOdooCustomerPriceField(e.target.value)}
                  placeholder="customer_sale_price"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <Boxes className="w-4 h-4 text-indigo-500 flex-shrink-0" />
              <span>
                يدعم جلب صور 512، الأسعار، الباركود، والكميات المتوفرة في اليد مع تنظيف المرجع الداخلي آلياً.
              </span>
            </div>

            <button
              type="button"
              onClick={handleTestOdoo}
              disabled={testingOdoo || !odooUrl || !odooDb || !odooUsername || !odooApiKey}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 whitespace-nowrap shadow-sm disabled:opacity-50"
            >
              {testingOdoo ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Warehouse className="w-3.5 h-3.5 text-indigo-200" />
              )}
              <span>فحص واختبار الاتصال بـ Odoo</span>
            </button>
          </div>

          {/* Odoo Test Connection Result Feedback */}
          {odooTestResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                odooTestResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {odooTestResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="space-y-1.5 flex-1">
                <div className="font-bold">{odooTestResult.message}</div>
                {odooTestResult.success && (
                  <div className="space-y-1 text-[11px] text-slate-600">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      <div>
                        المستخدم: <strong className="text-slate-800">{odooTestResult.userName || 'المنطقة التقنية'}</strong>
                      </div>
                      {odooTestResult.companyName && (
                        <div>
                          الشركة: <strong className="text-slate-800">{odooTestResult.companyName}</strong>
                        </div>
                      )}
                      {odooTestResult.totalProducts !== undefined && (
                        <div>
                          المنتجات بالمخزن: <strong className="text-indigo-600">{odooTestResult.totalProducts} منتج</strong>
                        </div>
                      )}
                      {odooTestResult.latencyMs && (
                        <div className="font-mono text-slate-500">
                          الاستجابة: {odooTestResult.latencyMs}ms
                        </div>
                      )}
                    </div>
                    {/* Detected fields */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px]">
                      {odooTestResult.detectedCustomerPriceField && (
                        <span className="bg-sky-100 text-sky-800 px-2 py-0.5 rounded font-mono font-semibold">
                          سعر بيع الزبون: {odooTestResult.detectedCustomerPriceField}
                        </span>
                      )}
                      {odooTestResult.detectedSalePriceField && (
                        <span className="bg-slate-200 text-slate-800 px-2 py-0.5 rounded font-mono font-semibold">
                          سعر البيع (الجملة): {odooTestResult.detectedSalePriceField}
                        </span>
                      )}
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                        تم استبعاد التكلفة تماماً ✓
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Shopify E-Commerce Store Integration Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="font-bold text-sm text-slate-900 font-cairo">
                  متجر شوبيفاي الإلكتروني (Shopify Integration - ezoneiraq.com)
                </h3>
                <p className="text-[11px] text-slate-500">
                  ربط لجلب الأوصاف التسويقية المنسقة وروابط الشراء المباشرة للمنتجات
                </p>
              </div>
            </div>
            <span
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                isShopifyConfigured
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isShopifyConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              {isShopifyConfigured ? 'متصل بمتجر ezoneiraq.com' : 'غير متصل بعد'}
            </span>
          </div>

          <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3.5 text-xs text-emerald-950 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>تكامل ثنائي ذكي مع Odoo ERP:</span>
            </div>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              تؤخذ الأسعار (سعر الزبون والجملة)، والمخزون، والباركود، والأقسام من <strong>Odoo ERP</strong>، بينما تُجلب <strong>الأوصاف التسويقية المنسقة</strong> و<strong>روابط الشراء المباشرة أونلاين</strong> من <strong>Shopify</strong> تلقائياً بناءً على مطابقة الباركود أو الـ SKU.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                رابط المتجر العام (Store URL)
              </label>
              <input
                type="text"
                value={shopifyStoreDomain}
                onChange={(e) => setShopifyStoreDomain(e.target.value)}
                placeholder="https://ezoneiraq.com"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-inter focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                نطاق شوبيفاي الداخلي (MyShopify Domain)
              </label>
              <input
                type="text"
                value={shopifyMyshopifyDomain}
                onChange={(e) => setShopifyMyshopifyDomain(e.target.value)}
                placeholder="t1ehkt-10.myshopify.com"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Shopify Client ID
              </label>
              <input
                type="text"
                value={shopifyClientId}
                onChange={(e) => setShopifyClientId(e.target.value)}
                placeholder={isShopifyConfigured ? 'اتركه فارغاً للإبقاء على المعرّف المحفوظ' : 'Client ID...'}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Shopify Client Secret
              </label>
              <input
                type="password"
                value={shopifyClientSecret}
                onChange={(e) => setShopifyClientSecret(e.target.value)}
                placeholder={isShopifyConfigured ? 'اتركه فارغاً للإبقاء على السر المحفوظ في .env.local' : 'Client Secret...'}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <ExternalLink className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>
                رابط المتجر الحي: <a href="https://ezoneiraq.com" target="_blank" rel="noreferrer" className="text-emerald-700 font-bold underline font-inter">ezoneiraq.com</a>
              </span>
            </div>

            <button
              type="button"
              onClick={handleTestShopify}
              disabled={testingShopify || !shopifyClientId || !shopifyClientSecret}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 whitespace-nowrap shadow-sm disabled:opacity-50"
            >
              {testingShopify ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShoppingBag className="w-3.5 h-3.5" />
              )}
              <span>فحص واختبار الاتصال بـ Shopify</span>
            </button>
          </div>

          {/* Shopify Test Connection Result Feedback */}
          {shopifyTestResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                shopifyTestResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {shopifyTestResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="space-y-1.5 flex-1">
                <div className="font-bold">{shopifyTestResult.message}</div>
                {shopifyTestResult.success && (
                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600 pt-1">
                    <div>
                      المتجر: <strong className="text-slate-800">{shopifyTestResult.storeDomain}</strong>
                    </div>
                    {shopifyTestResult.productCount !== undefined && (
                      <div>
                        المنتجات المفهرسة: <strong className="text-emerald-700">{shopifyTestResult.productCount} منتج</strong>
                      </div>
                    )}
                    {shopifyTestResult.latencyMs && (
                      <div className="font-mono text-slate-500">
                        زمن الاستجابة: {shopifyTestResult.latencyMs}ms
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Appwrite BaaS Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-sky-600" />
              <h3 className="font-bold text-sm text-slate-900 font-cairo">
                إعدادات خادم وقاعدة بيانات Appwrite
              </h3>
            </div>
            <span
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                isAppwriteConfigured
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {isAppwriteConfigured ? '● متصل بـ Appwrite Cloud' : '○ وضع التخزين المحلي الآمن'}
            </span>
          </div>

          <p className="text-xs text-slate-500">
            تُقرأ مفاتيح Appwrite من ملف البيئة <code className="bg-slate-100 px-1 py-0.5 rounded text-sky-600 font-inter">.env.local</code> لحماية بيانات الاعتماد من المتصفح.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Appwrite Endpoint
              </label>
              <input
                type="text"
                value={appwriteEndpoint}
                onChange={(e) => setAppwriteEndpoint(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-inter"
                placeholder="https://cloud.appwrite.io/v1"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Appwrite Project ID
              </label>
              <input
                type="text"
                value={appwriteProjectId}
                onChange={(e) => setAppwriteProjectId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-inter"
                placeholder="معرف المشروع من لوحة تحكم Appwrite"
              />
            </div>
          </div>
        </div>

        {/* Catalog & Typography Defaults */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-900 font-cairo">
              الخيارات الافتراضية للكتالوج والعملة
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">رمز العملة الافتراضي</label>
              <input
                type="text"
                value={defaultCurrency}
                onChange={(e) => setDefaultCurrency(e.target.value)}
                placeholder="د.ع أو IQD أو $"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">موضع رمز العملة</label>
              <select
                value={currencyPosition}
                onChange={(e) => setCurrencyPosition(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800"
              >
                <option value="suffix">بعد الرقم (مثال: 25,000 د.ع)</option>
                <option value="prefix">قبل الرقم (مثال: IQD 25,000)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم المؤسسة أو العلامة</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="اسم الشركة للترويسة"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-slate-950 font-bold text-xs transition-colors flex items-center gap-2 shadow-sm"
          >
            <Save className="w-4 h-4" />
            حفظ وتفعيل التغييرات
          </button>
        </div>
      </form>
    </div>
  );
}
