import { Router } from 'express';
import prisma from '../prismaClient';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// POST / - create a new maintenance log (any authenticated role)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { vehicleId, reportType, description, cost, receiptUrl } = req.body;
    const employeeId = req.user?.userId;

    if (!vehicleId || !reportType || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const log = await prisma.maintenanceLog.create({
      data: {
        vehicleId,
        reportType,
        description,
        cost: cost ?? undefined,
        receiptUrl: receiptUrl ?? undefined,
        employeeId: employeeId!,
      },
    });

    res.status(201).json(log);
  } catch (error) {
    console.error('Create maintenance log error', error);
    res.status(500).json({ error: 'Unable to create maintenance log' });
  }
});

// GET /vehicle/:vehicleId - get all maintenance logs for a vehicle
router.get('/vehicle/:vehicleId', authMiddleware, async (req, res) => {
  try {
    const vehicleId = Number(req.params.vehicleId);
    if (Number.isNaN(vehicleId)) {
      return res.status(400).json({ error: 'Invalid vehicle ID' });
    }

    const logs = await prisma.maintenanceLog.findMany({
      where: { vehicleId },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: { reportedAt: 'desc' },
    });

    res.json(logs);
  } catch (error) {
    console.error('Get maintenance logs error', error);
    res.status(500).json({ error: 'Unable to fetch maintenance logs' });
  }
});

// DELETE /:id - delete maintenance log (all roles)
router.delete('/:id', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid maintenance log ID' });
  }

  try {
    await prisma.maintenanceLog.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('Delete maintenance log error', error);
    res.status(500).json({ error: 'Unable to delete maintenance log' });
  }
});

export default router;
