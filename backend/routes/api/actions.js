import { Router } from 'express';
import { actionRepo } from '../../db/repositories.js';

const router = Router();

router.get('/', (req, res) => {
  const { status } = req.query;
  const actions = status ? actionRepo.findByStatus(status) : actionRepo.findAll();
  res.json({ actions });
});

router.patch('/:id/complete', (req, res) => {
  const result = actionRepo.markCompleted(parseInt(req.params.id, 10));
  if (result.changes === 0) return res.status(404).json({ error: 'Action not found' });
  res.json({ success: true });
});

export default router;
