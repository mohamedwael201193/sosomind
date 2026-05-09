CREATE TABLE IF NOT EXISTS user_profiles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), wallet_address text UNIQUE NOT NULL, telegram_chat_id text, display_name text, avatar_url text, preferences jsonb DEFAULT '{}'::jsonb, created_at timestamptz DEFAULT now(), last_seen_at timestamptz DEFAULT now());
CREATE INDEX IF NOT EXISTS user_profiles_wallet_idx ON user_profiles (wallet_address);
CREATE INDEX IF NOT EXISTS user_profiles_telegram_idx ON user_profiles (telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;
