'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookOpen,
  LayoutDashboard,
  FolderKanban,
  FileSpreadsheet,
  Settings,
  Plus,
  LogOut,
  UserCheck,
  Sparkles,
  ShoppingCart,
} from 'lucide-react';
import { AppService } from '@/lib/appwrite/service';
import { LocalUser } from '@/lib/appwrite/fallbackAdapter';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<LocalUser | null>(null);

  useEffect(() => {
    AppService.getCurrentUser().then((u) => setUser(u));
  }, [pathname]);

  const handleLogout = async () => {
    await AppService.logout();
    router.push('/login');
  };

  const isLoginPage = pathname === '/login';
  if (isLoginPage) return null;

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-900 border-b border-slate-800 text-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-brand-400 flex items-center justify-center text-white shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight font-cairo text-white">
                  Catalog Studio
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-400 -mt-0.5">مولّد كتالوجات المنتجات الاحترافية</p>
            </div>
          </Link>

          {/* Navigation Items */}
          <nav className="hidden md:flex items-center gap-1 mr-4">
            <Link
              href="/dashboard"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                pathname === '/dashboard'
                  ? 'bg-slate-800 text-sky-400 border border-slate-700'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              الرئيسية
            </Link>

            <Link
              href="/projects"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                pathname.startsWith('/projects') || pathname.startsWith('/project/')
                  ? 'bg-slate-800 text-sky-400 border border-slate-700'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <FolderKanban className="w-4 h-4" />
              المشاريع والكتالوجات
            </Link>

            <Link
              href="/settings"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                pathname === '/settings'
                  ? 'bg-slate-800 text-sky-400 border border-slate-700'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Settings className="w-4 h-4" />
              الإعدادات
            </Link>

            <Link
              href="/purchase-order"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                pathname === '/purchase-order'
                  ? 'bg-slate-800 text-amber-400 border border-slate-700'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              طلبية المورد
            </Link>
          </nav>
        </div>

        {/* Right Tools & User Profile */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard?action=new"
            className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            كتالوج جديد
          </Link>

          {user && (
            <div className="flex items-center gap-3 pl-2 border-r border-slate-800 pr-3">
              <div className="text-left hidden lg:block">
                <p className="text-xs font-bold text-slate-200">{user.name}</p>
                <p className="text-[10px] text-slate-400">{user.email}</p>
              </div>

              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400 text-xs font-bold">
                {user.name.charAt(0)}
              </div>

              <button
                onClick={handleLogout}
                title="تسجيل الخروج"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
