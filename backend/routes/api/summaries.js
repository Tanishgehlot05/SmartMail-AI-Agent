import { Router } from 'express';
import { summaryRepo } from '../../db/repositories.js';
import { runDailySummary } from '../../jobs/daily-summary.js';
import { runWeeklySummary } from '../../jobs/weekly-summary.js';

const router = Router();

router.get('/daily', (req, res) => {
  const limit = parseInt(req.query.limit || '30', 10);
  const summaries = summaryRepo.findDaily(limit);
  res.json({ summaries });
});

router.get('/weekly', (req, res) => {
  const limit = parseInt(req.query.limit || '12', 10);
  const reports = summaryRepo.findWeekly(limit);
  res.json({ reports: reports.map(r => ({ ...r, stats: r.stats ? JSON.parse(r.stats) : null })) });
});

router.post('/daily/trigger', async (req, res) => {
  try {
    const result = await runDailySummary();
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/weekly/trigger', async (req, res) => {
  try {
    const result = await runWeeklySummary();
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
