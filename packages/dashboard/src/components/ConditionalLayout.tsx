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
      <main className="md:ml-[240px] min-h-screen p-6 pb-20 md:pb-24 relative z-10">
        <PageTransition>{children}</PageTransition>
      </main>
      <StatusBar />
      <CommandPalette />
    </>
  );
}
