import { Router } from 'express';
import { analyticsRepo, emailRepo, notificationRepo } from '../../db/repositories.js';

const router = Router();

router.get('/', (req, res) => {
  const overview = analyticsRepo.getOverview();
  res.json({ analytics: overview });
});

router.get('/trend', (req, res) => {
  const days = parseInt(req.query.days || '14', 10);
  const trend = analyticsRepo.getDailyTrend(days);
  res.json({ trend });
});

router.get('/dashboard', (req, res) => {
  const analytics = analyticsRepo.getOverview();
  const recentEmails = emailRepo.findRecent(24).slice(0, 5);
  const recentNotifications = notificationRepo.findRecent(5);

  res.json({
    analytics,
    recentEmails: recentEmails.map(e => ({
      id: e.id,
      subject: e.subject,
      from: e.from_address,
      category: e.category,
      receivedAt: e.received_at,
    })),
    recentNotifications,
  });
});

export default router;
