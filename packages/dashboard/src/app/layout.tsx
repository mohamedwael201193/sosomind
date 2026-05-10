import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { ConditionalLayout } from "@/components/ConditionalLayout";

export const metadata: Metadata = {
  title: "SosoMind — Agentic Finance OS",
  description: "Multi-agent crypto research, signals & execution, powered by SoSoValue + SoDEX.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen" style={{ fontFamily: 'var(--font-body)' }}>
        <Providers>
          <ConditionalLayout>{children}</ConditionalLayout>
        </Providers>
      </body>
    </html>
  );
}

