import { Router } from 'express';
import { deadlineRepo } from '../../db/repositories.js';

const router = Router();

router.get('/', (req, res) => {
  const { includeCompleted } = req.query;
  const deadlines = deadlineRepo.findAll(includeCompleted === 'true');
  res.json({ deadlines });
});

router.get('/upcoming', (req, res) => {
  const days = parseInt(req.query.days || '7', 10);
  const deadlines = deadlineRepo.findUpcoming(days);
  res.json({ deadlines });
});

router.patch('/:id/complete', (req, res) => {
  const result = deadlineRepo.markCompleted(parseInt(req.params.id, 10));
  if (result.changes === 0) return res.status(404).json({ error: 'Deadline not found' });
  res.json({ success: true });
});

export default router;
