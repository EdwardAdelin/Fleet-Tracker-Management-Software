import { Router } from 'express';
import prisma from '../prismaClient';
import { authMiddleware } from '../middleware/auth';
import { calculateGreedyRoute, calculateGoogleRoute, calculateDrivingDistanceForOrder } from '../services/routingService';

const router = Router();

router.post('/vehicles/:id/optimize', authMiddleware, async (req, res) => {
  const vehicleId = Number(req.params.id);
  if (Number.isNaN(vehicleId)) {
    return res.status(400).json({ error: 'Invalid vehicle ID' });
  }

  try {
    const user = req.user!;
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, companyId: user.companyId },
    });
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const tasks = await prisma.task.findMany({
      where: {
        vehicleId,
        companyId: user.companyId,
        status: { not: 'DONE' },
        lat: { not: null },
        lng: { not: null },
      },
      orderBy: [{ id: 'asc' }],
    });

    const startLocation = { lat: 44.4268, lng: 26.1025 };
    const taskLocations = tasks.map(
      (task: { lat: number | null; lng: number | null } & Record<string, unknown>) => ({
        ...task,
        lat: task.lat as number,
        lng: task.lng as number,
      }),
    );

    const greedy = calculateGreedyRoute(startLocation, taskLocations);
    const [google, greedyTotalDistance] = await Promise.all([
      calculateGoogleRoute(startLocation, taskLocations),
      calculateDrivingDistanceForOrder(startLocation, greedy.route),
    ]);

    res.json({
      greedy: { tasks: greedy.route, totalDistance: greedyTotalDistance },
      google: { tasks: google.route, totalDistance: google.totalDistance },
    });
  } catch (error) {
    console.error('Optimize route error', error);
    res.status(500).json({ error: 'Unable to optimize route' });
  }
});

export default router;
