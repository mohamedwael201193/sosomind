-- SosoMind — Migration 004: Per-Telegram-User Embedded Wallets
-- Every Telegram user gets a dedicated EVM wallet generated on first interaction.
-- Private keys are encrypted server-side (AES-256-GCM) with WALLET_ENCRYPT_KEY env var.
-- Users trade with their own wallet without needing MetaMask.

CREATE TABLE IF NOT EXISTS telegram_wallets (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id     text        UNIQUE NOT NULL,
  telegram_username    text,
  telegram_first_name  text,
  wallet_address       text        NOT NULL,
  encrypted_key        text        NOT NULL,  -- AES-256-GCM: iv(32hex)+tag(32hex)+ciphertext(hex)
  created_at           timestamptz NOT NULL DEFAULT now(),
  last_used_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS telegram_wallets_chat_idx ON telegram_wallets (telegram_chat_id);
CREATE INDEX IF NOT EXISTS telegram_wallets_addr_idx ON telegram_wallets (wallet_address);

ALTER TABLE telegram_wallets DISABLE ROW LEVEL SECURITY;
