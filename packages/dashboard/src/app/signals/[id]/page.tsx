import type { Metadata } from "next";
import SignalDetailClient from "./SignalDetailClient";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://sosomind-backend.onrender.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const res = await fetch(`${API}/api/signals/${id}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error("not found");
    const json = await res.json();
    const signal = json?.data ?? json;
    const asset = (signal?.asset ?? signal?.symbol ?? "Signal").toUpperCase();
    const dir = (signal?.direction ?? "NEUTRAL").toUpperCase();
    const conf = Number(signal?.confidence ?? 70);
    const outcome = (signal?.outcome ?? "") as string;
    const reasoning = ((signal?.reasoning ?? "") as string).slice(0, 155);
    const baseUrl = "https://sosomind.vercel.app";
    const ogUrl = `${baseUrl}/api/og?asset=${encodeURIComponent(asset)}&direction=${encodeURIComponent(dir)}&confidence=${conf}&outcome=${encodeURIComponent(outcome)}`;
    const title = `${asset} ${dir} Signal — ${conf}% Confidence | SoSoMind`;
    const description =
      reasoning ||
      `AI-generated ${dir.toLowerCase()} signal for ${asset} with ${conf}% confidence. Powered by SoSoValue + SoDEX.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `${baseUrl}/signals/${id}`,
        type: "website",
        images: [{ url: ogUrl, width: 1200, height: 630, alt: `${asset} ${dir} signal` }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogUrl],
      },
    };
  } catch {
    return { title: "Signal — SoSoMind" };
  }
}

export default async function SignalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SignalDetailClient id={id} />;
}

