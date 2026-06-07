-- Align content_posts with application inserts (published, channel, engagement)
ALTER TABLE IF EXISTS public.content_posts
  ADD COLUMN IF NOT EXISTS published boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS channel text,
  ADD COLUMN IF NOT EXISTS engagement jsonb DEFAULT '{}'::jsonb;

UPDATE public.content_posts
SET published = (published_at IS NOT NULL)
WHERE published IS NULL AND published_at IS NOT NULL;

UPDATE public.content_posts
SET channel = telegram_channel_id
WHERE channel IS NULL AND telegram_channel_id IS NOT NULL;
