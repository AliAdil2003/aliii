import type { Metadata } from 'next';
import './globals.css';
import AppShell from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'E-ZONE Studio | استوديو الكتالوج - مولد كتالوجات المنتجات الاحترافية',
  description: 'أداة احترافية لتوليد وتصميم كتالوجات المنتجات الجاهزة للطباعة من ملفات Excel و CSV مع تكامل Odoo و Shopify',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen w-full bg-[#012336] text-slate-100 antialiased font-cairo overflow-x-hidden selection:bg-[#01334E] selection:text-white">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
