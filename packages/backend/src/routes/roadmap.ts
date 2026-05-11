import { Router } from 'express';
import { wrapMeta } from '../utils/responseMeta';

const router = Router();

const ROADMAP = {
  updatedAt: '2026-05-11',
  phases: [
    {
      id: 'phase-1',
      title: 'Phase 1 — Agentic Foundation',
      quarter: 'Q4 2025',
      status: 'shipped',
      summary: 'Multi-agent research/risk/execution loop, SoSoValue + SoDEX integration, Telegram bot, paper trading.',
      checklist: [
        { label: 'Multi-AI failover (6 providers)', done: true },
        { label: 'SoSoValue OpenAPI 9 modules wired', done: true },
        { label: 'SoDEX EIP-712 signing (testnet)', done: true },
        { label: 'Telegram bot with auto-wallet', done: true },
        { label: 'Supabase persistence + Redis cache', done: true },
        { label: 'Paper trading + signal marketplace', done: true },
      ],
    },
    {
      id: 'phase-2',
      title: 'Phase 2 — Index Studio & Smart-Money Brief',
      quarter: 'Q2 2026',
      status: 'in_progress',
      summary: 'On-chain SoSoValue Indexes (SSI) integration, Smart-Money newsletter pipeline, 4-step copy-trade wizard, full provenance.',
      checklist: [
        { label: 'SSI Index Studio (browse + recommend)', done: true },
        { label: 'Smart-Money Brief feed with citations', done: true },
        { label: '4-step copy-trade wizard', done: true },
        { label: 'Stale-cache freshness badges', done: true },
        { label: 'Public /docs API reference', done: true },
        { label: 'Mainnet trading via SoDEX', done: false },
      ],
    },
    {
      id: 'phase-3',
      title: 'Phase 3 — Vault & Strategy Marketplace',
      quarter: 'Q3 2026',
      status: 'planned',
      summary: 'Public vaults that copy AI strategies non-custodially. Performance leaderboards. Strategy NFT publishing.',
      checklist: [
        { label: 'Non-custodial AI vault contract', done: false },
        { label: 'Strategy NFT publishing flow', done: false },
        { label: 'Vault leaderboard + analytics', done: false },
        { label: 'Telegram subscription tiers', done: false },
      ],
    },
    {
      id: 'phase-4',
      title: 'Phase 4 — ValueChain Native + Mobile',
      quarter: 'Q4 2026',
      status: 'planned',
      summary: 'Native ValueChain deployment, mobile app (iOS / Android), perps + spot unified margin, EU MiCA compliance.',
      checklist: [
        { label: 'ValueChain mainnet deployment', done: false },
        { label: 'Native iOS + Android apps', done: false },
        { label: 'Perps + spot unified margin UX', done: false },
        { label: 'MiCA-aligned reporting', done: false },
      ],
    },
  ],
};

router.get('/', (_req, res) => {
  res.json(wrapMeta(ROADMAP, { ttlMs: 24 * 60 * 60_000, source: 'computed' }));
});

export default router;
