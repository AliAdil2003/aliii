'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Lock, Mail, ArrowLeft, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';
import { LocalStorageAdapter } from '@/lib/appwrite/fallbackAdapter';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Server-side authentication (credentials are checked on the server against .env.local)
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل تسجيل الدخول');
      }

      // Keep the local profile used by the UI in sync (display only)
      if (data.user) {
        await LocalStorageAdapter.setCurrentUser(data.user);
      }

      const params = new URLSearchParams(window.location.search);
      const next = params.get('next');
      // Only allow same-site relative redirects
      router.push(next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تسجيل الدخول');
    } finally {
      setPassword('');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#012336] px-4 py-12 text-white selection:bg-[#01334E] selection:text-white">
      {/* Background Subtle Gradient & Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#023C5C_1px,transparent_1px)] [background-size:24px_24px] opacity-30 pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-2xl bg-[#01334E] border border-white/10 shadow-2xl shadow-[#011A29]/50 mb-3">
            <img src="/ezone-logo.png" alt="E-ZONE" className="h-12 w-auto object-contain" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white font-cairo">
            E-ZONE Catalog Studio
          </h1>
          <p className="text-xs text-white/70 mt-1 font-medium">
            شركة المنطقة التقنية | نظام تصميم وإنتاج الكتالوجات والطلبيات
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#01334E] border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="flex items-center justify-between pb-5 mb-5 border-b border-white/10">
            <div>
              <h2 className="text-base font-bold text-white">تسجيل الدخول للمنظومة</h2>
              <p className="text-xs text-white/60">فريق إدارة المنتجات والمبيعات</p>
            </div>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#012336] text-[11px] font-bold text-white border border-white/10">
              <ShieldCheck className="w-3.5 h-3.5 text-white" />
              دخول محمي من الخادم
            </span>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1.5">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@company.com"
                  className="w-full bg-[#012336] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-colors"
                />
                <Mail className="w-4 h-4 text-white/40 absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1.5">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#012336] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-colors"
                />
                <Lock className="w-4 h-4 text-white/40 absolute left-3.5 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-white hover:bg-slate-100 active:bg-slate-200 text-[#01334E] font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-black/20 disabled:opacity-50"
            >
              {loading ? 'جاري التحقق...' : 'دخول المنصة'}
              <ArrowLeft className="w-4 h-4" />
            </button>
          </form>

        </div>

        {/* Security Footer Notice */}
        <div className="mt-6 text-center text-xs text-white/70 flex items-center justify-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>تطبيق داخلي آمن مع دعم تشفير وحماية بيانات Excel</span>
        </div>
      </div>
    </div>
  );
}
