import { Router } from 'express';
import prisma from '../prismaClient';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

// POST / - add a document to a vehicle (all authenticated users)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { vehicleId, documentType, fileUrl, expiresAt } = req.body;

    if (!vehicleId || !documentType || !fileUrl) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const document = await prisma.document.create({
      data: {
        vehicleId,
        documentType,
        fileUrl,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      },
    });

    res.status(201).json(document);
  } catch (error) {
    console.error('Create document error', error);
    res.status(500).json({ error: 'Unable to create document' });
  }
});

// GET /vehicle/:vehicleId - get all documents for a vehicle
router.get('/vehicle/:vehicleId', authMiddleware, async (req, res) => {
  try {
    const vehicleId = Number(req.params.vehicleId);
    if (Number.isNaN(vehicleId)) {
      return res.status(400).json({ error: 'Invalid vehicle ID' });
    }

    const docs = await prisma.document.findMany({
      where: { vehicleId },
      orderBy: { createdAt: 'desc' },
    });

    res.json(docs);
  } catch (error) {
    console.error('Get documents error', error);
    res.status(500).json({ error: 'Unable to fetch documents' });
  }
});

// DELETE /:id - delete document (all authenticated users)
router.delete('/:id', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid document ID' });
  }

  try {
    await prisma.document.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('Delete document error', error);
    res.status(500).json({ error: 'Unable to delete document' });
  }
});

export default router;
