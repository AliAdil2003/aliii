'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FolderKanban,
  ShoppingCart,
  Settings,
  Search,
  Bell,
  ChevronDown,
  Sparkles,
  LogOut,
  Warehouse,
  ShoppingBag,
  Plus,
  ArrowRight,
  Menu,
  X,
  Zap,
} from 'lucide-react';
import { AppService } from '@/lib/appwrite/service';
import { LocalUser } from '@/lib/appwrite/fallbackAdapter';
import NewCatalogWizard from '@/components/wizard/NewCatalogWizard';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<LocalUser | null>(null);
  const [projectCount, setProjectCount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  useEffect(() => {
    AppService.getCurrentUser().then((u) => setUser(u));
    AppService.getProjects().then((p) => setProjectCount(p.length));
  }, [pathname]);

  const handleLogout = async () => {
    // Clear the secure httpOnly session cookie on the server
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    await AppService.logout();
    router.push('/login');
  };

  const isLoginPage = pathname === '/login';
  const isDesignerWorkspace = pathname.startsWith('/project/');

  // For Login page, render bare without dashboard chassis
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Navigation Links configuration
  const navItems = [
    {
      title: 'لوحة التحكم',
      href: '/dashboard',
      icon: LayoutDashboard,
      active: pathname === '/dashboard',
      badge: projectCount > 0 ? String(projectCount) : undefined,
    },
    {
      title: 'المشاريع والكتالوجات',
      href: '/projects',
      icon: FolderKanban,
      active: pathname.startsWith('/projects'),
      badge: undefined,
    },
    {
      title: 'طلبية المورد',
      href: '/purchase-order',
      icon: ShoppingCart,
      active: pathname === '/purchase-order',
      badge: 'PRO',
    },
    {
      title: 'الإعدادات والربط',
      href: '/settings',
      icon: Settings,
      active: pathname === '/settings',
      badge: undefined,
    },
  ];

  // If in Catalog Designer workspace (/project/[id]), provide full-width canvas edge to edge
  if (isDesignerWorkspace) {
    return (
      <div className="min-h-screen w-full bg-[#012336] flex flex-col text-white">
        {/* Studio Top Header */}
        <header className="px-5 py-3 flex items-center justify-between text-white border-b border-white/10 bg-[#01334E]">
          <div className="flex items-center gap-3">
            <Link
              href="/projects"
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              title="العودة للمشاريع"
            >
              <ArrowRight className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="h-8 px-2 rounded-xl bg-white flex items-center justify-center shadow-sm">
                <img src="/ezone-logo.png" alt="E-ZONE" className="h-5 w-auto object-contain" />
              </div>
              <span className="font-bold text-sm tracking-tight text-white font-cairo">
                استوديو تصميم الكتالوج
              </span>
              <span className="text-[10px] bg-white/20 text-white px-2.5 py-0.5 rounded-full font-bold">
                300 DPI
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs text-white font-medium transition-colors"
            >
              لوحة التحكم
            </Link>
            <Link
              href="/purchase-order"
              className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs text-white font-medium transition-colors"
            >
              طلبية المورد
            </Link>
          </div>
        </header>

        {/* Designer Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#011C2B]">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#012336] font-cairo text-slate-900 selection:bg-[#01334E] selection:text-white">
      {/* ========================================================= */}
      {/* SIDEBAR (Docked Full Height - EZONE Navy) */}
      {/* ========================================================= */}
      <aside className="w-full lg:w-64 xl:w-72 bg-[#01334E] p-5 sm:p-6 flex flex-col justify-between shrink-0 lg:h-screen lg:sticky lg:top-0 border-l border-white/10 text-white z-20 shadow-2xl">
        <div className="space-y-7">
          {/* Top Brand Logo */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="h-10 px-2 py-1 rounded-2xl bg-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                <img src="/ezone-logo.png" alt="E-ZONE" className="h-6 w-auto object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-lg tracking-tight text-white leading-tight font-cairo flex items-center gap-1.5">
                  <span>E-ZONE</span>
                  <span className="w-2 h-2 rounded-full bg-white"></span>
                </span>
                <span className="text-[10px] text-white/70 font-medium tracking-wide">
                  Catalog Studio Pro
                </span>
              </div>
            </Link>

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>

          {/* Navigation Menu */}
          <nav className={`space-y-2 ${mobileMenuOpen ? 'block' : 'hidden lg:block'}`}>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-4 py-3 rounded-full text-xs font-bold transition-all duration-200 ${
                    item.active
                      ? 'bg-white text-[#01334E] shadow-lg translate-x-1 font-black'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${item.active ? 'text-[#01334E]' : 'text-white/70'}`} />
                    <span className="text-sm font-semibold">{item.title}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-black ${
                        item.active
                          ? 'bg-[#01334E] text-white'
                          : 'bg-white/15 text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Bottom Promo Card (Upgrade to Pro / Odoo & Shopify) */}
        <div className="hidden lg:block pt-6">
          <div className="bg-white text-[#01334E] rounded-[28px] p-5 relative overflow-hidden shadow-xl group border border-white/20">
            {/* Background Subtle Accent */}
            <div className="absolute -left-6 -top-6 w-24 h-24 bg-[#01334E]/10 rounded-full blur-xl pointer-events-none" />

            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider bg-[#01334E] text-white px-2.5 py-0.5 rounded-full">
                  ERP + STORE
                </span>
                <div className="w-6 h-6 rounded-full bg-[#01334E]/10 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-[#01334E]" />
                </div>
              </div>

              <div>
                <h4 className="font-black text-sm leading-snug font-cairo text-[#01334E]">
                  تكامل Odoo & Shopify
                </h4>
                <p className="text-[11px] text-slate-600 font-medium leading-relaxed mt-1">
                  مزامنة المخزون والأسعار والأوصاف التسويقية آلياً بضغطة زر واحدة.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsWizardOpen(true)}
                className="w-full bg-[#01334E] hover:bg-[#012336] active:scale-95 text-white text-xs font-bold py-2.5 px-4 rounded-full transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-white" />
                <span>بدء كتالوج جديد</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* MAIN CONTENT CANVAS (Clean White & Navy Canvas) */}
      {/* ========================================================= */}
      <main className="flex-1 min-h-screen bg-[#F4F7FA] p-5 sm:p-7 lg:p-9 flex flex-col overflow-y-auto">
        {/* Top Bar Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/80">
          {/* User Profile Widget */}
          <div className="relative">
            <div
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-3 cursor-pointer group select-none"
            >
              <div className="w-10 h-10 rounded-full bg-[#01334E] text-white flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-white">
                {user?.name ? user.name.substring(0, 2).toUpperCase() : 'EZ'}
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-slate-900 group-hover:text-black">
                    {user?.name || 'مدير النظام (Admin)'}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-700" />
                </div>
                <span className="text-[11px] text-slate-500 font-medium block">
                  {user?.email || 'admin@ezoneiraq.com'}
                </span>
              </div>
            </div>

            {/* Profile Dropdown */}
            {profileDropdownOpen && (
              <div className="absolute top-12 right-0 z-50 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 min-w-[200px] animate-fadeIn">
                <Link
                  href="/settings"
                  onClick={() => setProfileDropdownOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-500" />
                  <span>إعدادات النظام والربط</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-rose-600 hover:bg-rose-50 transition-colors text-right"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-500" />
                  <span>تسجيل الخروج</span>
                </button>
              </div>
            )}
          </div>

          {/* Right Controls: Search, Notification, Date & Filter Pills */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Pill Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث سريع في الكتالوجات..."
                className="bg-white rounded-full pr-9 pl-4 py-2 text-xs text-slate-800 placeholder-slate-400 border border-slate-200/50 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#01334E] w-48 sm:w-60 transition-all"
              />
            </div>

            {/* Notification Circle */}
            <div className="relative">
              <button
                type="button"
                title="التنبيهات"
                className="w-9 h-9 rounded-full bg-white hover:bg-slate-100/80 text-slate-700 flex items-center justify-center shadow-xs transition-colors relative"
              >
                <Bell className="w-4 h-4" />
                <span className="w-2 h-2 rounded-full bg-[#01334E] absolute top-2 right-2 ring-2 ring-white"></span>
              </button>
            </div>

            {/* Date Pill */}
            <div className="hidden md:flex items-center px-4 py-2 rounded-full bg-white shadow-xs text-[11px] font-bold text-slate-600">
              {new Date().toLocaleDateString('ar-IQ', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </div>

            {/* Quick Action Button (+ كتالوج جديد) */}
            <button
              type="button"
              onClick={() => setIsWizardOpen(true)}
              className="px-4 py-2 rounded-full bg-[#01334E] hover:bg-[#012336] text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
              <span>+ كتالوج جديد</span>
            </button>
          </div>
        </header>

        {/* Inner Content Area */}
        <div className="flex-1 pt-6">
          {children}
        </div>
      </main>

      {/* Global New Catalog Wizard Modal */}
      {isWizardOpen && (
        <NewCatalogWizard
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          onCreated={(id) => {
            setIsWizardOpen(false);
            router.push(`/project/${id}`);
          }}
        />
      )}
    </div>
  );
}
