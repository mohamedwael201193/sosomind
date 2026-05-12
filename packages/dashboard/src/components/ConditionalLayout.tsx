'use client';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { StatusBar } from './StatusBar';
import { PageTransition } from './PageTransition';

const STANDALONE_ROUTES = ['/', '/landing', '/docs', '/trade/sign'];

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStandalone = STANDALONE_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'));

  if (isStandalone) {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />
      <MobileNav />
      <main className="md:ml-[240px] min-h-screen p-6 pb-20 md:pb-6 relative z-10">
        <PageTransition>{children}</PageTransition>
      </main>
      <StatusBar />
    </>
  );
}
