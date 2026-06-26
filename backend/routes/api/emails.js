import { Router } from 'express';
import { emailRepo } from '../../db/repositories.js';

const router = Router();

router.get('/', (req, res) => {
  const { category, type, limit = 50 } = req.query;

  let emails;
  if (type === 'important') emails = emailRepo.findImportant(parseInt(limit, 10));
  else if (type === 'personal') emails = emailRepo.findPersonal(parseInt(limit, 10));
  else if (type === 'spam-rescued') emails = emailRepo.findSpamRescued(parseInt(limit, 10));
  else if (category === 'internships' || category === 'career') emails = emailRepo.findByCategory('career', parseInt(limit, 10));
  else if (category === 'academic') emails = emailRepo.findByCategory('academic', parseInt(limit, 10));
  else if (category) emails = emailRepo.findByCategory(category, parseInt(limit, 10));
  else emails = emailRepo.findRecent(24 * 7).slice(0, parseInt(limit, 10));

  res.json({ emails: emails.map(formatEmail) });
});

router.get('/:id', (req, res) => {
  const email = emailRepo.findById(req.params.id);
  if (!email) return res.status(404).json({ error: 'Email not found' });
  res.json({ email: formatEmail(email) });
});

function formatEmail(e) {
  return {
    id: e.id,
    threadId: e.thread_id,
    from: e.from_address,
    fromName: e.from_name,
    subject: e.subject,
    snippet: e.body_snippet,
    receivedAt: e.received_at,
    category: e.category,
    subcategory: e.subcategory,
    importanceScore: e.importance_score,
    aiConfidence: e.ai_confidence,
    notifyInstant: !!e.notify_instant,
    isPersonal: !!e.is_personal,
    isSpamRescued: !!e.is_spam_rescued,
    isIgnored: !!e.is_ignored,
    summary: e.summary,
  };
}

export default router;
