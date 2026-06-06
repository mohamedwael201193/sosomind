/** Active EIP-1193 provider from Reown AppKit (or injected fallback). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Eip1193Provider = { request: (args: { method: string; params?: unknown[] }) => Promise<any> };

let activeProvider: Eip1193Provider | null = null;

export function setActiveWalletProvider(provider: unknown | null) {
  activeProvider = provider as Eip1193Provider | null;
}

export function getActiveWalletProvider(): Eip1193Provider | null {
  if (activeProvider) return activeProvider;
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    return (window as any).ethereum as Eip1193Provider;
  }
  return null;
}
