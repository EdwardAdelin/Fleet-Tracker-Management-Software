import { Router } from 'express';
import prisma from '../prismaClient';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET / - get last 50 messages for company, ascending
router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = req.user!;

    const messages = await prisma.message.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: 'asc' },
      take: 50,
      include: {
        sender: { select: { fullName: true, role: true } },
      },
    });

    res.json(messages);
  } catch (error) {
    console.error('Get messages error', error);
    res.status(500).json({ error: 'Unable to fetch messages' });
  }
});

// POST / - create new message in company chat
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { text } = req.body as { text: string };
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    const user = req.user!;
    const message = await prisma.message.create({
      data: {
        text,
        senderId: user.userId,
        companyId: user.companyId,
      },
      include: {
        sender: { select: { fullName: true, role: true } },
      },
    });

    res.status(201).json(message);
  } catch (error) {
    console.error('Create message error', error);
    res.status(500).json({ error: 'Unable to create message' });
  }
});

export default router;
