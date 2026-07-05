'use client';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { StatusBar } from './StatusBar';
import { PageTransition } from './PageTransition';
import { CommandPalette } from './CommandPalette';

const STANDALONE_ROUTES = ['/landing', '/docs', '/trade/sign'];

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const isStandalone = STANDALONE_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'));

  if (isStandalone) {
    return (
      <>
        {children}
        <CommandPalette />
      </>
    );
  }

  return (
    <>
      <Sidebar />
      <MobileNav />
      <main className="md:ml-[240px] min-h-[100dvh] px-4 py-6 md:px-8 md:py-8 pb-24 md:pb-10 relative z-10 max-w-[1600px]">
        <PageTransition>{children}</PageTransition>
      </main>
      <StatusBar />
      <CommandPalette />
    </>
  );
}
