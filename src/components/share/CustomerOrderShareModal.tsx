'use client';

import React, { useState } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
  QrCode,
  Sparkles,
  ShoppingBag,
  FileText,
} from 'lucide-react';
import { Project } from '@/types';

interface CustomerOrderShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
}

export default function CustomerOrderShareModal({
  isOpen,
  onClose,
  project,
}: CustomerOrderShareModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Compute public order link
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001';
  const orderUrl = `${origin}/order/${project.id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(orderUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenNewTab = () => {
    window.open(orderUrl, '_blank');
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `مرحباً بكم 🌿\nيسرنا مشاركتكم كتالوج منتجاتنا: *${project.name}*\nيمكنكم الآن تصفح كامل المنتجات وتحديد عدد القطع المطلوبة للشراء، ثم استخراج ملف PDF بالطلبية فوراً عبر الرابط:\n${orderUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    orderUrl
  )}&margin=8`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn font-cairo">
      <div className="bg-[#01334E] border border-white/10 rounded-3xl max-w-lg w-full p-6 text-white shadow-2xl relative overflow-hidden">
        {/* Glow corner */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white text-[#01334E] flex items-center justify-center font-bold shadow-lg shadow-black/20">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                مشاركة رابط طلب الكتالوج للزبائن
              </h3>
              <p className="text-xs text-white/70">
                رابط تفاعلي مخصص يتيح للزبون اختيار عدد القطع واستخراج PDF
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body content */}
        <div className="space-y-4">
          {/* URL Bar */}
          <div>
            <label className="block text-xs font-bold text-white/80 mb-1.5">
              رابط الطلب التفاعلي المباشر:
            </label>
            <div className="flex items-center gap-2 bg-[#012336] border border-white/15 rounded-2xl p-1.5 pl-3">
              <input
                type="text"
                readOnly
                value={orderUrl}
                dir="ltr"
                className="bg-transparent text-xs font-mono text-white flex-1 px-2 focus:outline-none select-all text-left truncate"
              />
              <button
                onClick={handleCopy}
                className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 ${
                  copied
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white text-[#01334E] hover:bg-slate-100 shadow-md'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>تم النسخ</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Action Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={handleWhatsAppShare}
              className="p-3 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-200 text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4 text-emerald-400" />
              <span>مشاركة عبر WhatsApp</span>
            </button>

            <button
              onClick={handleOpenNewTab}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4 text-white/80" />
              <span>معاينة الرابط كزبون</span>
            </button>
          </div>

          {/* QR Code Section */}
          <div className="bg-[#012336] border border-white/10 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-24 h-24 rounded-xl bg-white p-1.5 shrink-0 flex items-center justify-center overflow-hidden">
              <img
                src={qrCodeUrl}
                alt="Order QR Code"
                className="w-full h-full object-contain"
                loading="lazy"
              />
            </div>
            <div>
              <div className="text-xs font-black text-white flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-white" />
                <span>رمز الاستجابة السريعة (QR Code)</span>
              </div>
              <p className="text-[11px] text-white/70 mt-1 leading-relaxed">
                يمكن للزبائن أو مندوبي المبيعات مسح الرمز بكاميرا الهاتف لفتح كتالوج الطلب وإدخال الكميات فوراً.
              </p>
            </div>
          </div>

          {/* Feature Highlights */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-[11px] text-white/80 space-y-1.5">
            <div className="font-bold text-white flex items-center gap-1.5 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-white" />
              <span>ماذا يقدم هذا الرابط لزبائنك؟</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              <span>تصفح كافة منتجات الكتالوج بالصور والمواصفات والأسعار المعتمدة.</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              <span>حقل تفاعلي لاختيار وتعديل عدد القطع المطلوبة للشراء لكل صنف.</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              <span>استخراج وتنزيل ملف PDF رسمي بالسلة أو إرسال الطلبية مباشرة عبر الواتساب.</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 mt-5 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
