import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/Toast';
import { ShoppingBag, ShieldCheck, Database, RefreshCw } from 'lucide-react';
import Link from 'next/link';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-outfit',
});

export const metadata: Metadata = {
  title: 'Consisto - Multi-Warehouse Inventory Reservation',
  description: 'Production-grade, concurrency-safe inventory reservation system with PostgreSQL row-level locking.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body
        className={`${outfit.variable} font-sans bg-zinc-950 text-zinc-100 min-h-screen antialiased flex flex-col`}
      >
        <ToastProvider>
          {/* Glassmorphic Navbar */}
          <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="p-2 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-200">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                    Consisto
                  </span>
                  <span className="text-[10px] font-semibold text-zinc-500 tracking-wider uppercase -mt-1">
                    Inventory Engine
                  </span>
                </div>
              </Link>

              <nav className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400 mr-4">
                  <div className="flex items-center gap-1.5 text-zinc-500 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full text-xs">
                    <Database className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                    <span>PostgreSQL (Locks Active)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-500 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full text-xs">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Serializable & SELECT FOR UPDATE</span>
                  </div>
                </div>

                <Link
                  href="/"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-all duration-200 flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset View</span>
                </Link>
              </nav>
            </div>
          </header>

          {/* Main Application Container */}
          <main className="flex-1 flex flex-col">
            {children}
          </main>

          {/* Footer */}
          <footer className="border-t border-zinc-900 bg-black/40 py-6 text-center text-xs text-zinc-600">
            <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span>
                &copy; 2026 Consisto Multi-Warehouse Inventory System
              </span>
              <div className="flex items-center gap-4 font-medium">
                <span className="text-emerald-500 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  Operational
                </span>
              </div>
            </div>
          </footer>
        </ToastProvider>
      </body>
    </html>
  );
}
