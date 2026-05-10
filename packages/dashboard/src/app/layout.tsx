import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { ConditionalLayout } from "@/components/ConditionalLayout";

export const metadata: Metadata = {
  title: "SoSoMind — The Agentic Finance OS",
  description: "Multi-agent AI-powered crypto trading intelligence. Real-time signals, DEX execution, and macro research — powered by SoSoValue + SoDEX.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
    shortcut: "/logo.png",
  },
  openGraph: {
    title: "SoSoMind — The Agentic Finance OS",
    description: "Multi-agent AI-powered crypto trading intelligence. Real-time signals, DEX execution, and macro research.",
    images: [{ url: "/logo.png", width: 1200, height: 630, alt: "SoSoMind" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SoSoMind — The Agentic Finance OS",
    description: "Multi-agent AI-powered crypto trading intelligence.",
    images: ["/logo.png"],
  },
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

