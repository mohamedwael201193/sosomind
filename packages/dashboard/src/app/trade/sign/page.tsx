'use client';

/**
 * /trade/sign — Telegram deep-link target.
 *
 * The Telegram bot builds an unsigned order in URL params (b64-encoded JSON),
 * then sends a button: https://app/.../trade/sign?p=...
 * Opening it pops MetaMask immediately and relays the signed payload.
 */
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { signAndSubmit } from '@/lib/sodex-client';
import { useWallet } from '@/context/WalletContext';
import { GlassCard } from '@/components/GlassCard';
import { Loader2, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';

function decodePayload(p: string | null): any {
  if (!p) return null;
  try { return JSON.parse(decodeURIComponent(escape(atob(p.replace(/-/g, '+').replace(/_/g, '/'))))); }
  catch { return null; }
}

function SignInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const { address, token, connect } = useWallet();
  const [status, setStatus] = useState<'idle' | 'signing' | 'ok' | 'err'>('idle');
  const [message, setMessage] = useState<string>('');
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    setOrder(decodePayload(sp.get('p')));
  }, [sp]);

  async function go() {
    if (!order) return;
    if (!address || !token) { await connect(); return; }
    setStatus('signing'); setMessage('Awaiting wallet signature…');
    try {
      const r = await signAndSubmit({
        scope: order.scope,
        actionName: order.actionName,
        body: order.body,
        market: order.market,
        side: order.side,
        quantity: order.quantity,
        price: order.price,
        orderType: order.orderType,
        source: 'telegram',
      });
      if (r.ok) {
        setStatus('ok'); setMessage(`Submitted to SoDEX (${r.orderId?.slice(0, 8)})`);
        // Notify Telegram via callback URL (bot polls signed_orders)
      } else {
        setStatus('err'); setMessage(r.error || 'Order rejected');
      }
    } catch (e: any) {
      setStatus('err'); setMessage(e?.message || 'Signature cancelled');
    }
  }

  if (!order) {
    return (
      <GlassCard className="text-center">
        <p className="text-[var(--text-muted)]">No order payload found in this link.</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard padding="lg" className="text-center">
      <div className="flex items-center justify-center gap-2 mb-4 text-emerald-400">
        <ShieldCheck className="w-5 h-5" /><span className="text-sm font-semibold">Non-custodial signing</span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Confirm trade</h1>
      <p className="text-sm text-[var(--text-muted)] mb-6">
        Telegram → your wallet. The server never sees your key.
      </p>

      <div className="bg-[var(--bg-elevated)] rounded-lg p-4 text-left text-sm space-y-1 mb-6">
        <div className="flex justify-between"><span className="text-[var(--text-muted)]">Side</span>
          <span className={order.side === 'buy' ? 'text-emerald-400' : 'text-red-400'}>{String(order.side).toUpperCase()}</span></div>
        <div className="flex justify-between"><span className="text-[var(--text-muted)]">Market</span><span>{order.market}</span></div>
        <div className="flex justify-between"><span className="text-[var(--text-muted)]">Type</span><span>{order.orderType}</span></div>
        <div className="flex justify-between"><span className="text-[var(--text-muted)]">Amount</span><span>{order.quantity}</span></div>
        {order.price && <div className="flex justify-between"><span className="text-[var(--text-muted)]">Price</span><span>{order.price}</span></div>}
      </div>

      {status === 'idle' && (
        <button onClick={go}
          className="w-full py-3 rounded-lg font-semibold bg-emerald-500 hover:bg-emerald-400 text-black">
          {address ? 'Sign with wallet' : 'Connect wallet'}
        </button>
      )}
      {status === 'signing' && (
        <div className="flex items-center justify-center gap-2 text-blue-400">
          <Loader2 className="w-4 h-4 animate-spin" /> {message}
        </div>
      )}
      {status === 'ok' && (
        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}
          className="flex items-center justify-center gap-2 text-emerald-400">
          <CheckCircle2 className="w-5 h-5" /> {message}
        </motion.div>
      )}
      {status === 'err' && (
        <div className="flex items-center justify-center gap-2 text-red-400">
          <XCircle className="w-5 h-5" /> {message}
        </div>
      )}

      <button onClick={() => router.push('/trade')}
        className="mt-6 text-xs text-[var(--text-muted)] hover:text-blue-400">
        Open full trading desk →
      </button>
    </GlassCard>
  );
}

export default function SignPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Suspense fallback={<div className="text-[var(--text-muted)]">Loading…</div>}>
          <SignInner />
        </Suspense>
      </div>
    </div>
  );
}
