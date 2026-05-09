/**
 * Signal Marketplace & Social Leaderboard (Part 2)
 * Extends the existing leaderboard to support signal publishing, following, and copy-trading.
 */

import { supabase } from '../db/supabase';
import { getLeaderboard, LeaderboardEntry } from './leaderboard';

export interface PublishedSignal {
  id?: string;
  creator_id: string;
  creator_name?: string;
  signal_id?: string;
  asset: string;
  direction: string;
  confidence: number;
  entry: number;
  take_profit?: number;
  stop_loss?: number;
  reasoning?: string;
  followers_count?: number;
  copies_count?: number;
  result?: 'win' | 'loss' | 'pending';
  result_pnl?: number;
  created_at?: string;
  expires_at?: string;
}

export interface SignalFollow {
  follower_id: string;
  creator_id: string;
  auto_copy: boolean;
  max_position_pct: number;
}

export interface MarketplaceLeaderboard extends LeaderboardEntry {
  followers: number;
  total_published: number;
  win_rate_published: number;
  avg_pnl_published: number;
  is_following?: boolean;
}

/**
 * Publish a signal to the marketplace
 */
export async function publishSignal(signal: Omit<PublishedSignal, 'id' | 'created_at'>): Promise<PublishedSignal> {
  const { data, error } = await supabase
    .from('published_signals')
    .insert({
      ...signal,
      result: 'pending',
      followers_count: 0,
      copies_count: 0,
      expires_at: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as PublishedSignal;
}

/**
 * Get signals in the marketplace
 */
export async function getMarketplaceSignals(limit = 20): Promise<PublishedSignal[]> {
  const { data } = await supabase
    .from('published_signals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as PublishedSignal[];
}

/**
 * Follow a signal creator
 */
export async function followCreator(
  followerId: string,
  creatorId: string,
  autoCopy = false,
  maxPositionPct = 5
): Promise<void> {
  const { error } = await supabase.from('signal_follows').upsert(
    { follower_id: followerId, creator_id: creatorId, auto_copy: autoCopy, max_position_pct: maxPositionPct },
    { onConflict: 'follower_id,creator_id' }
  );
  if (error) throw error;

  // Update follower count on published signals
  await Promise.resolve(supabase.rpc('increment_followers', { creator: creatorId })).then(() => {}).catch(() => {});
}

/**
 * Unfollow a signal creator
 */
export async function unfollowCreator(followerId: string, creatorId: string): Promise<void> {
  const { error } = await supabase
    .from('signal_follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('creator_id', creatorId);
  if (error) throw error;
}

/**
 * Get users followed by a follower
 */
export async function getFollowing(followerId: string): Promise<SignalFollow[]> {
  const { data } = await supabase
    .from('signal_follows')
    .select('*')
    .eq('follower_id', followerId);
  return (data ?? []) as SignalFollow[];
}

/**
 * Get full marketplace leaderboard with follow counts
 */
export async function getMarketplaceLeaderboard(
  limit = 20,
  viewerId?: string
): Promise<MarketplaceLeaderboard[]> {
  const [baseLeaderboard, publishedSignals, followers] = await Promise.all([
    getLeaderboard(limit),
    supabase.from('published_signals').select('creator_id, result, result_pnl'),
    viewerId
      ? supabase.from('signal_follows').select('creator_id').eq('follower_id', viewerId)
      : Promise.resolve({ data: [] }),
  ]);

  const followingSet = new Set((followers.data ?? []).map((f: any) => f.creator_id));

  // Build stats per creator from published signals
  const pubStats = new Map<string, { total: number; wins: number; totalPnl: number; followCount: number }>();
  for (const sig of publishedSignals.data ?? []) {
    if (!pubStats.has(sig.creator_id)) {
      pubStats.set(sig.creator_id, { total: 0, wins: 0, totalPnl: 0, followCount: 0 });
    }
    const s = pubStats.get(sig.creator_id)!;
    s.total++;
    if (sig.result === 'win') s.wins++;
    s.totalPnl += Number(sig.result_pnl ?? 0);
  }

  // Get follower counts from signal_follows
  const { data: followerCounts } = await supabase
    .from('signal_follows')
    .select('creator_id');
  for (const f of followerCounts ?? []) {
    const s = pubStats.get(f.creator_id);
    if (s) s.followCount++;
    else pubStats.set(f.creator_id, { total: 0, wins: 0, totalPnl: 0, followCount: 1 });
  }

  return baseLeaderboard.map(entry => {
    const pub = pubStats.get(entry.userId) ?? { total: 0, wins: 0, totalPnl: 0, followCount: 0 };
    return {
      ...entry,
      followers: pub.followCount,
      total_published: pub.total,
      win_rate_published: pub.total > 0 ? parseFloat((pub.wins / pub.total).toFixed(4)) : 0,
      avg_pnl_published: pub.total > 0 ? parseFloat((pub.totalPnl / pub.total).toFixed(2)) : 0,
      is_following: viewerId ? followingSet.has(entry.userId) : undefined,
    };
  });
}
