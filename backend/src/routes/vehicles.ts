import { Router } from 'express';
import prisma from '../prismaClient';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

// GET / - list all vehicles (employees only see assigned)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = req.user!;
    const baseWhere = { companyId: user.companyId };
    const where =
      user.role === 'EMPLOYEE'
        ? { ...baseWhere, assignedDriverId: user.userId }
        : baseWhere;

    const vehicles = await prisma.vehicle.findMany({
      where,
      include: {
        assignedDriver: { select: { fullName: true } },
      },
    });

    res.json(vehicles);
  } catch (err) {
    console.error('List vehicles error', err);
    res.status(500).json({ error: 'Unable to fetch vehicles' });
  }
});

// GET /my-assigned-vehicle - return the vehicle assigned to the logged-in driver
router.get('/my-assigned-vehicle', authMiddleware, async (req, res) => {
  try {
    const user = req.user!;
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        companyId: user.companyId,
        assignedDriverId: user.userId,
      },
      include: {
        assignedDriver: { select: { fullName: true } },
      },
    });

    if (!vehicle) {
      return res.status(404).json({ error: 'No assigned vehicle found' });
    }

    res.json(vehicle);
  } catch (err) {
    console.error('Get assigned vehicle error', err);
    res.status(500).json({ error: 'Unable to fetch assigned vehicle' });
  }
});

// GET /:id/obd - list active OBD errors for a vehicle
router.get('/:id/obd', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid vehicle ID' });

  try {
    const user = req.user!;
    const vehicle = await prisma.vehicle.findFirst({ where: { id, companyId: user.companyId } });
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const errors = await prisma.oBDError.findMany({
      where: { vehicleId: id, resolved: false },
      orderBy: { createdAt: 'desc' },
    });

    res.json(errors);
  } catch (err) {
    console.error('Get OBD errors error', err);
    res.status(500).json({ error: 'Unable to fetch OBD errors' });
  }
});

// POST /:id/obd - create OBD errors from scanner webhook
router.post('/:id/obd', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid vehicle ID' });

  const { errors } = req.body as { errors: Array<{ code: string; description?: string }> };
  if (!Array.isArray(errors) || errors.length === 0) {
    return res.status(400).json({ error: 'errors array is required' });
  }

  try {
    const user = req.user!;
    const vehicle = await prisma.vehicle.findFirst({ where: { id, companyId: user.companyId } });
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const createData = errors.map((error) => ({
      code: error.code,
      description: error.description,
      vehicleId: id,
    }));

    await prisma.oBDError.createMany({ data: createData });

    res.status(201).json({ message: 'OBD errors recorded' });
  } catch (err) {
    console.error('Create OBD errors error', err);
    res.status(500).json({ error: 'Unable to save OBD errors' });
  }
});

// PUT /:id/obd/:errorId/resolve - mark an OBD error resolved
router.put('/:id/obd/:errorId/resolve', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const errorId = Number(req.params.errorId);
  if (Number.isNaN(id) || Number.isNaN(errorId)) {
    return res.status(400).json({ error: 'Invalid vehicle or error ID' });
  }

  try {
    const user = req.user!;
    const vehicle = await prisma.vehicle.findFirst({ where: { id, companyId: user.companyId } });
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const updateResult = await prisma.oBDError.updateMany({
      where: { id: errorId, vehicleId: id },
      data: { resolved: true },
    });

    if (updateResult.count === 0) {
      return res.status(404).json({ error: 'OBD error not found' });
    }

    res.json({ message: 'OBD error resolved' });
  } catch (err) {
    console.error('Resolve OBD error error', err);
    res.status(500).json({ error: 'Unable to resolve OBD error' });
  }
});

// GET /:id - get a single vehicle
router.get('/:id', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const user = req.user!;
    const vehicle = await prisma.vehicle.findFirst({ where: { id, companyId: user.companyId } });
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    res.json(vehicle);
  } catch (err) {
    console.error('Get vehicle error', err);
    res.status(500).json({ error: 'Unable to fetch vehicle' });
  }
});

// POST / - create vehicle (owner or dispatcher)
router.post('/', authMiddleware, requireRole('OWNER', 'DISPATCHER'), async (req, res) => {
  try {
    const {
      brand,
      model,
      licensePlate,
      type,
      status,
      currentMileage,
      assignedDriverId,
    } = req.body;

    const assignedDriverIdValue =
      assignedDriverId === undefined || assignedDriverId === null || assignedDriverId === ''
        ? null
        : Number(assignedDriverId);

    const vehicle = await prisma.vehicle.create({
      data: {
        brand,
        model,
        licensePlate,
        type,
        status,
        currentMileage,
        assignedDriverId: assignedDriverIdValue,
        companyId: req.user!.companyId,
      },
      include: {
        assignedDriver: { select: { fullName: true } },
      },
    });

    res.status(201).json(vehicle);
  } catch (err) {
    console.error('Create vehicle error', err);
    res.status(500).json({ error: 'Unable to create vehicle' });
  }
});

// PUT /:id - update vehicle (owner or dispatcher)
router.put('/:id', authMiddleware, requireRole('OWNER', 'DISPATCHER'), async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const {
      brand,
      model,
      licensePlate,
      type,
      status,
      currentMileage,
      assignedDriverId,
    } = req.body;

    const assignedDriverIdValue =
      assignedDriverId === undefined || assignedDriverId === null || assignedDriverId === ''
        ? null
        : Number(assignedDriverId);

    const user = req.user!;
    const updateResult = await prisma.vehicle.updateMany({
      where: { id, companyId: user.companyId },
      data: {
        brand,
        model,
        licensePlate,
        type,
        status,
        currentMileage,
        assignedDriverId: assignedDriverIdValue,
      },
    });

    if (updateResult.count === 0) {
      return res.status(404).json({ error: 'Vehicle not found or access denied' });
    }

    const vehicle = await prisma.vehicle.findFirst({
      where: { id, companyId: user.companyId },
      include: { assignedDriver: { select: { fullName: true } } },
    });

    res.json(vehicle);
  } catch (err) {
    console.error('Update vehicle error', err);
    res.status(500).json({ error: 'Unable to update vehicle' });
  }
});

// PUT /:id/mileage - update vehicle mileage (all authenticated roles)
router.put('/:id/mileage', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  const { newMileage } = req.body;
  if (newMileage == null || Number.isNaN(Number(newMileage))) {
    return res.status(400).json({ error: 'newMileage is required and must be a number.' });
  }

  try {
    const user = req.user!;
    const vehicle = await prisma.vehicle.findFirst({ where: { id, companyId: user.companyId } });
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    if (Number(newMileage) < vehicle.currentMileage) {
      return res.status(400).json({ error: 'Mileage cannot be lower than the current value.' });
    }

    const updated = await prisma.vehicle.updateMany({
      where: { id, companyId: user.companyId },
      data: { currentMileage: Number(newMileage) },
    });

    if (updated.count === 0) {
      return res.status(404).json({ error: 'Vehicle not found or access denied' });
    }

    const updatedVehicle = await prisma.vehicle.findFirst({ where: { id, companyId: user.companyId } });
    res.json(updatedVehicle);
  } catch (err) {
    console.error('Update vehicle mileage error', err);
    res.status(500).json({ error: 'Unable to update vehicle mileage' });
  }
});

// PUT /:id/location - update vehicle's current GPS location
router.put('/:id/location', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  const { currentLat, currentLng } = req.body as {
    currentLat?: number | null;
    currentLng?: number | null;
  };

  if (currentLat == null || currentLng == null) {
    return res.status(400).json({ error: 'Missing currentLat and/or currentLng' });
  }

  try {
    const user = req.user!;
    const updateResult = await prisma.vehicle.updateMany({
      where: { id, companyId: user.companyId },
      data: {
        currentLat,
        currentLng,
      },
    });

    if (updateResult.count === 0) {
      return res.status(404).json({ error: 'Vehicle not found or access denied' });
    }

    const vehicle = await prisma.vehicle.findFirst({ where: { id, companyId: user.companyId } });
    res.json(vehicle);
  } catch (err) {
    console.error('Update vehicle location error', err);
    res.status(500).json({ error: 'Unable to update vehicle location' });
  }
});

// DELETE /:id - delete vehicle (only owner or dispatcher)
router.delete('/:id', authMiddleware, async (req, res) => {
  const user = req.user!;
  if (user.role !== 'OWNER' && user.role !== 'DISPATCHER') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const deleteResult = await prisma.vehicle.deleteMany({ where: { id, companyId: user.companyId } });
    if (deleteResult.count === 0) {
      return res.status(404).json({ error: 'Vehicle not found or access denied' });
    }

    res.status(204).send();
  } catch (err) {
    console.error('Delete vehicle error', err);
    res.status(400).json({
      error: 'Cannot delete vehicle because it has associated tasks.',
    });
  }
});

export default router;
