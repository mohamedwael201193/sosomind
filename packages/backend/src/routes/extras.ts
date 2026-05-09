import { Router } from 'express';
import { handleA2ARequest } from '../a2a/handler';
import { getLeaderboard } from '../social/leaderboard';
import { runStressTest, listPresetScenarios } from '../simulation/stress';
import { getMacroOutlook } from '../agents/macroOverlay';
import { generateVoiceBrief, briefingScript, hasVoice } from '../agents/voice';
import { asyncHandler } from '../utils/http';

const router = Router();

// ─── Agent-to-Agent ──────────────────────────────────────────────────────────
router.post('/a2a/request', asyncHandler(async (req, res) => {
  const out = await handleA2ARequest(req.body || {});
  res.status(out.status === 'success' ? 200 : 400).json(out);
}));

// ─── Social leaderboard ──────────────────────────────────────────────────────
router.get('/social/leaderboard', asyncHandler(async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number((req.query.limit as string) || 20)));
  const data = await getLeaderboard(limit);
  res.json({ data });
}));

// ─── Stress simulator ────────────────────────────────────────────────────────
router.get('/simulation/scenarios', (_req, res) => {
  res.json({ data: listPresetScenarios() });
});

router.post('/simulation/run', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const scenario = body.scenario || { name: 'custom', assetChanges: body.assetChanges || {} };
  if (!scenario.assetChanges || typeof scenario.assetChanges !== 'object') {
    return res.status(400).json({ error: 'assetChanges object required' });
  }
  const result = await runStressTest(scenario);
  res.json({ data: result });
}));

// ─── Macro outlook (agents/* alias) ──────────────────────────────────────────
router.get('/agents/macro', asyncHandler(async (_req, res) => {
  const outlook = await getMacroOutlook();
  res.json({ data: outlook });
}));

// ─── Voice brief ─────────────────────────────────────────────────────────────
router.post('/voice/brief', asyncHandler(async (req, res) => {
  if (!hasVoice()) return res.status(503).json({ error: 'voice_disabled', message: 'ELEVENLABS_API_KEY not set' });
  const body = req.body || {};
  const text = body.text || briefingScript(body);
  const buf = await generateVoiceBrief(text);
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Disposition', 'inline; filename="brief.mp3"');
  res.send(buf);
}));

export default router;
