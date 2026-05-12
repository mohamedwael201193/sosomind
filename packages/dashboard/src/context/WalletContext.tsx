'use client';

/**
 * WalletContext — MetaMask-based wallet authentication
 *
 * Flow:
 *  1. connect() → eth_requestAccounts (MetaMask popup)
 *  2. GET /api/auth/nonce → server returns message to sign
 *  3. eth_sign (personal_sign) → signature
 *  4. POST /api/auth/verify → JWT token + profile
 *  5. Token stored in localStorage('sosomind_token')
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { ensureSoDEXChain } from '@/lib/sodex-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000';
const TOKEN_KEY = 'sosomind_token';
const ADDRESS_KEY = 'sosomind_address';

export interface UserProfile {
  id?: string;
  wallet_address: string;
  telegram_chat_id?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  created_at?: string;
  last_seen_at?: string;
}

interface WalletContextValue {
  address: string | null;
  token: string | null;
  profile: UserProfile | null;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  generateLinkCode: () => Promise<string | null>;
  refreshProfile: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue>({
  address: null,
  token: null,
  profile: null,
  isConnecting: false,
  error: null,
  connect: async () => {},
  disconnect: () => {},
  generateLinkCode: async () => null,
  refreshProfile: async () => {},
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore session on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedAddress = localStorage.getItem(ADDRESS_KEY);
    if (savedToken && savedAddress) {
      setToken(savedToken);
      setAddress(savedAddress);
      // Validate and refresh profile in background
      fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${savedToken}` },
      })
        .then((r) => {
          if (r.status === 401 || r.status === 403) {
            // Token expired/invalid — clear session
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(ADDRESS_KEY);
            setToken(null);
            setAddress(null);
            return null;
          }
          return r.ok ? r.json() : null;
        })
        .then((data) => {
          if (data?.profile) setProfile(data.profile);
        })
        .catch(() => {
          // Network error — keep session alive, profile stays empty until next poll
        });
    }
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      setError('MetaMask not detected. Please install MetaMask.');
      return;
    }
    setIsConnecting(true);
    try {
      const ethereum = (window as any).ethereum;

      // 1. Request accounts
      const accounts: string[] = await ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts.length) throw new Error('No accounts returned from MetaMask');
      const addr = accounts[0].toLowerCase();

      // 1b. Auto-switch to SoDEX chain (chainId 138565 = 0x21d85)
      //     Handles 'ValueChain Testnet' duplicate-RPC case transparently
      try {
        await ensureSoDEXChain(ethereum, 138565);
      } catch (chainErr: any) {
        // Non-fatal: if user rejects chain switch, continue — they will be
        // prompted again when they actually try to sign a trade
        console.warn('[WalletContext] chain switch skipped:', chainErr?.message);
      }

      // 2. Get nonce message from server
      const nonceRes = await fetch(`${API_URL}/api/auth/nonce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr }),
      });
      if (!nonceRes.ok) throw new Error('Failed to get nonce from server');
      const { message } = await nonceRes.json();

      // 3. Sign message (personal_sign)
      const signature: string = await ethereum.request({
        method: 'personal_sign',
        params: [message, addr],
      });

      // 4. Verify signature, get JWT
      const verifyRes = await fetch(`${API_URL}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr, signature }),
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        throw new Error(err.error || 'Signature verification failed');
      }
      const { token: jwt, profile: prof } = await verifyRes.json();

      // 5. Persist
      localStorage.setItem(TOKEN_KEY, jwt);
      localStorage.setItem(ADDRESS_KEY, addr);
      setToken(jwt);
      setAddress(addr);
      setProfile(prof ?? { wallet_address: addr });
    } catch (e: any) {
      const msg = e?.message || 'Connection failed';
      // User rejected (code 4001) — show friendly message
      if (e?.code === 4001) {
        setError('Connection cancelled by user');
      } else {
        setError(msg);
      }
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADDRESS_KEY);
    setToken(null);
    setAddress(null);
    setProfile(null);
    setError(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const savedToken = token ?? localStorage.getItem(TOKEN_KEY);
    if (!savedToken) return;
    try {
      const r = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${savedToken}` },
      });
      if (!r.ok) return;
      const data = await r.json();
      if (data?.profile) setProfile(data.profile);
    } catch {}
  }, [token]);

  // Auto-poll profile every 30s when connected (picks up telegram link from bot)
  useEffect(() => {
    if (!token) return;
    const id = setInterval(refreshProfile, 30_000);
    return () => clearInterval(id);
  }, [token, refreshProfile]);

  const generateLinkCode = useCallback(async (): Promise<string | null> => {
    if (!token) return null;
    try {
      const r = await fetch(`${API_URL}/api/auth/link-code`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return null;
      const { code } = await r.json();
      return code as string;
    } catch {
      return null;
    }
  }, [token]);

  return (
    <WalletContext.Provider
      value={{ address, token, profile, isConnecting, error, connect, disconnect, generateLinkCode, refreshProfile }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  return useContext(WalletContext);
}
