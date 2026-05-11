-- Add citations column for newsletter provenance.
-- Idempotent: safe to apply on existing databases.

ALTER TABLE IF EXISTS public.content_posts
  ADD COLUMN IF NOT EXISTS citations jsonb DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_content_posts_created_at
  ON public.content_posts (created_at DESC);
