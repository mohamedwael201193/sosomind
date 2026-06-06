'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, LogOut, Link2, Copy, CheckCheck, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useWallet } from '../context/WalletContext';

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

interface ConnectWalletProps {
  /** compact: inline button; full: card with profile info */
  variant?: 'compact' | 'full';
}

export function ConnectWallet({ variant = 'compact' }: ConnectWalletProps) {
  const { address, profile, isConnecting, error, connect, disconnect, generateLinkCode, refreshProfile } = useWallet();
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadingCode, setLoadingCode] = useState(false);

  const handleLinkTelegram = async () => {
    setLoadingCode(true);
    const code = await generateLinkCode();
    setLinkCode(code);
    setLoadingCode(false);
  };

  const copyCode = async () => {
    if (!linkCode) return;
    await navigator.clipboard.writeText(`/link ${linkCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Not connected ─────────────────────────────────────────────────────────
  if (!address) {
    return (
      <div style={{ width: '100%' }}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={connect}
          disabled={isConnecting}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 10,
            background: isConnecting
              ? 'rgba(16,185,129,0.06)'
              : 'rgba(16,185,129,0.12)',
            border: '1px solid rgba(16,185,129,0.3)',
            color: 'var(--green)',
            fontSize: 12,
            fontWeight: 600,
            cursor: isConnecting ? 'wait' : 'pointer',
            letterSpacing: '0.02em',
            transition: 'all 0.15s ease',
            opacity: isConnecting ? 0.7 : 1,
          }}
        >
          <Wallet size={13} />
          {isConnecting ? 'Connecting…' : 'Connect Wallet'}
        </motion.button>
        {!error && (
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, textAlign: 'center' }}>
            MetaMask · WalletConnect · Coinbase & more
          </div>
        )}
        {error && (
          <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 4, textAlign: 'center' }}>
            {error}
          </div>
        )}
      </div>
    );
  }

  // ── Connected — compact ────────────────────────────────────────────────────
  if (variant === 'compact') {
    return (
      <div style={{ width: '100%' }}>
        {/* Address badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '7px 10px',
          borderRadius: 10,
          background: 'rgba(16,185,129,0.08)',
          border: '1px solid rgba(16,185,129,0.2)',
          marginBottom: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: 'var(--green)',
              boxShadow: '0 0 6px var(--green)',
            }} />
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text)', letterSpacing: '0.03em' }}>
              {shortAddr(address)}
            </span>
          </div>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={disconnect}
            title="Disconnect wallet"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--muted)', lineHeight: 1 }}
          >
            <LogOut size={11} />
          </motion.button>
        </div>

        {/* Telegram link */}
        {profile?.telegram_chat_id ? (
          <div style={{ fontSize: 10, color: 'var(--green)', padding: '2px 10px', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Link2 size={9} />
            Telegram linked ✓
          </div>
        ) : (
          <AnimatePresence>
            {!linkCode ? (
              <motion.button
                key="link-btn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleLinkTelegram}
                disabled={loadingCode}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '5px 10px',
                  borderRadius: 8,
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--muted2)',
                  fontSize: 10,
                  cursor: loadingCode ? 'wait' : 'pointer',
                  opacity: loadingCode ? 0.6 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                <Link2 size={10} />
                {loadingCode ? 'Generating…' : 'Link Telegram'}
              </motion.button>
            ) : (
              <motion.div
                key="link-code"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{
                  padding: '6px 8px',
                  borderRadius: 8,
                  background: 'rgba(59,130,246,0.08)',
                  border: '1px solid rgba(59,130,246,0.25)',
                  fontSize: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ color: 'var(--muted)' }}>Send to @SosoMindbot:</span>
                  <motion.button
                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    onClick={refreshProfile}
                    title="Check if linked"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2, lineHeight: 1 }}
                  >
                    <RefreshCw size={9} />
                  </motion.button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <code style={{
                    fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
                    color: 'var(--blue)', letterSpacing: '0.1em',
                    flex: 1,
                  }}>
                    /link {linkCode}
                  </code>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={copyCode}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted2)', padding: 2 }}
                    title="Copy command"
                  >
                    {copied ? <CheckCheck size={11} style={{ color: 'var(--green)' }} /> : <Copy size={11} />}
                  </motion.button>
                </div>
                <div style={{ color: 'var(--muted)', marginTop: 3 }}>Expires in 15 min</div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    );
  }

  // ── Connected — full card ─────────────────────────────────────────────────
  return (
    <div style={{
      padding: '14px 16px',
      borderRadius: 12,
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'rgba(16,185,129,0.15)',
          display: 'grid', placeItems: 'center',
          border: '1px solid rgba(16,185,129,0.3)',
        }}>
          <Wallet size={18} style={{ color: 'var(--green)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            {profile?.display_name ?? 'Wallet'}
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {address}
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={disconnect}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 10px', borderRadius: 8,
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: 'var(--red)', fontSize: 11, cursor: 'pointer',
          }}
        >
          <LogOut size={12} /> Disconnect
        </motion.button>
      </div>

      {/* Telegram linking */}
      {profile?.telegram_chat_id ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 10px', borderRadius: 8,
          background: 'rgba(16,185,129,0.06)',
          border: '1px solid rgba(16,185,129,0.15)',
          fontSize: 12, color: 'var(--muted)',
        }}>
          <Link2 size={13} style={{ color: 'var(--green)' }} />
          Telegram linked
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
            Link your Telegram to get alerts and signals in the bot:
          </div>
          {!linkCode ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleLinkTelegram}
              disabled={loadingCode}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                padding: '9px 14px', borderRadius: 9,
                background: 'rgba(59,130,246,0.1)',
                border: '1px solid rgba(59,130,246,0.3)',
                color: 'var(--blue)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Link2 size={13} />
              {loadingCode ? 'Generating code…' : 'Link Telegram Bot'}
            </motion.button>
          ) : (
            <div style={{
              padding: '10px 12px', borderRadius: 9,
              background: 'rgba(59,130,246,0.08)',
              border: '1px solid rgba(59,130,246,0.2)',
            }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
                Send this command to <strong>@SosoMindbot</strong> on Telegram:
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code style={{
                  fontFamily: 'monospace', fontSize: 14, fontWeight: 700,
                  color: 'var(--blue)', letterSpacing: '0.08em', flex: 1,
                }}>
                  /link {linkCode}
                </code>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={copyCode}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', borderRadius: 7,
                    background: copied ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
                    color: copied ? 'var(--green)' : 'var(--muted2)',
                    fontSize: 11, cursor: 'pointer',
                  }}
                >
                  {copied ? <CheckCheck size={12} /> : <Copy size={12} />}
                  {copied ? 'Copied!' : 'Copy'}
                </motion.button>
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>
                Code expires in 15 minutes
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
