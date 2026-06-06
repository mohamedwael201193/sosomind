'use client';

/**
 * WalletContext — Reown AppKit multi-wallet auth
 *
 * Flow:
 *  1. connect() → AppKit modal (MetaMask, WalletConnect, Coinbase, etc.)
 *  2. GET /api/auth/nonce → server returns message to sign
 *  3. personal_sign via connected provider
 *  4. POST /api/auth/verify → JWT token + profile
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useAppKit, useAppKitAccount, useAppKitProvider, useDisconnect } from '@reown/appkit/react';
import { BrowserProvider } from 'ethers';
import { ensureSoDEXChain } from '@/lib/sodex-client';
import { setActiveWalletProvider } from '@/lib/wallet-provider';
import { ensureReownAppKit } from '@/lib/reown-config';

ensureReownAppKit();

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

async function authenticateWithBackend(
  addr: string,
  walletProvider: unknown,
): Promise<{ token: string; profile: UserProfile }> {
  setActiveWalletProvider(walletProvider);

  try {
    await ensureSoDEXChain(walletProvider as any, 138565);
  } catch (chainErr: any) {
    console.warn('[WalletContext] chain switch skipped:', chainErr?.message);
  }

  const nonceRes = await fetch(`${API_URL}/api/auth/nonce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: addr }),
  });
  if (!nonceRes.ok) throw new Error('Failed to get nonce from server');
  const { message } = await nonceRes.json();

  const provider = new BrowserProvider(walletProvider as any);
  const signer = await provider.getSigner();
  const signature = await signer.signMessage(message);

  const verifyRes = await fetch(`${API_URL}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: addr, signature }),
  });
  if (!verifyRes.ok) {
    const err = await verifyRes.json();
    throw new Error(err.error || 'Signature verification failed');
  }
  return verifyRes.json();
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { open } = useAppKit();
  const { disconnect: appKitDisconnect } = useDisconnect();
  const { address: appKitAddress, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider('eip155');

  const [address, setAddress] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authInFlight = useRef(false);

  // Restore session on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedAddress = localStorage.getItem(ADDRESS_KEY);
    if (savedToken && savedAddress) {
      setToken(savedToken);
      setAddress(savedAddress);
      fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${savedToken}` },
      })
        .then((r) => {
          if (r.status === 401 || r.status === 403) {
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
        .catch(() => {});
    }
  }, []);

  // Sync AppKit connection → JWT auth (when user picks a wallet in the modal)
  useEffect(() => {
    if (!isConnected || !appKitAddress || !walletProvider) return;

    const addr = appKitAddress.toLowerCase();
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedAddress = localStorage.getItem(ADDRESS_KEY)?.toLowerCase();

    if (savedToken && savedAddress === addr) {
      setAddress(addr);
      setToken(savedToken);
      setActiveWalletProvider(walletProvider);
      setIsConnecting(false);
      return;
    }

    if (authInFlight.current) return;

    authInFlight.current = true;
    setIsConnecting(true);
    setError(null);

    authenticateWithBackend(addr, walletProvider)
      .then(({ token: jwt, profile: prof }) => {
        localStorage.setItem(TOKEN_KEY, jwt);
        localStorage.setItem(ADDRESS_KEY, addr);
        setToken(jwt);
        setAddress(addr);
        setProfile(prof ?? { wallet_address: addr });
      })
      .catch((e: any) => {
        const msg = e?.message || 'Authentication failed';
        if (e?.code === 4001 || msg.toLowerCase().includes('user rejected')) {
          setError('Connection cancelled by user');
        } else {
          setError(msg);
        }
      })
      .finally(() => {
        authInFlight.current = false;
        setIsConnecting(false);
      });
  }, [isConnected, appKitAddress, walletProvider]);

  const connect = useCallback(async () => {
    setError(null);
    setIsConnecting(true);
    try {
      open();
    } catch (e: any) {
      setError(e?.message || 'Could not open wallet modal');
      setIsConnecting(false);
    }
  }, [open]);

  const disconnect = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADDRESS_KEY);
    setToken(null);
    setAddress(null);
    setProfile(null);
    setError(null);
    setActiveWalletProvider(null);
    appKitDisconnect();
  }, [appKitDisconnect]);

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
