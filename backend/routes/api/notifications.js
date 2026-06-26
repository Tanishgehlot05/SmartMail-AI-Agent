import { Router } from 'express';
import { notificationRepo } from '../../db/repositories.js';

const router = Router();

router.get('/', (req, res) => {
  const limit = parseInt(req.query.limit || '100', 10);
  const notifications = notificationRepo.findRecent(limit);
  res.json({ notifications });
});

export default router;
