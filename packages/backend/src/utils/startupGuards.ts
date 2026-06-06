/**
 * Production startup guards — fail fast on insecure defaults (Wave 2).
 */
const DEV_JWT = 'sosomind-dev-secret-change-in-prod';

export function assertProductionSecrets(): void {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) return;

  const jwt = process.env.JWT_SECRET || DEV_JWT;
  if (!process.env.JWT_SECRET || jwt === DEV_JWT) {
    throw new Error('[startup] JWT_SECRET must be set to a strong value in production');
  }

  if (!process.env.WALLET_ENCRYPT_KEY?.trim()) {
    throw new Error('[startup] WALLET_ENCRYPT_KEY must be set in production (Telegram wallet encryption)');
  }

  if (!process.env.CRON_SECRET || process.env.CRON_SECRET.includes('change_in_prod')) {
    console.warn('[startup] CRON_SECRET should be rotated in production');
  }

  if (process.env.ALLOW_HOUSE_TRADES === 'true') {
    console.warn('[startup] ALLOW_HOUSE_TRADES=true — house wallet route enabled (not recommended for public deploy)');
  }
}
