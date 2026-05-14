import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import prisma from '../prismaClient';
import { emitToRole, emitToUser } from '../socket';

const router = Router();

// POST / - create a new task (OWNER or DISPATCHER only)
router.post('/', authMiddleware, requireRole('OWNER', 'DISPATCHER'), async (req, res) => {
  try {
    const {
      title,
      description,
      employeeId,
      assignedToId,
      startDate,
      endDate,
      scheduledStartDate,
      scheduledEndDate,
      address,
      lat: rawLat,
      lng: rawLng,
      pickupLocation,
      dropoffLocation,
      contactDetails,
    } = req.body;
    const adminId = req.user?.userId;

    const assignedDriverId =
      assignedToId !== undefined
        ? Number(assignedToId)
        : employeeId !== undefined
        ? Number(employeeId)
        : undefined;

    const lat = rawLat !== undefined ? parseFloat(rawLat as string) : undefined;
    const lng = rawLng !== undefined ? parseFloat(rawLng as string) : undefined;

    if (
      !title ||
      !assignedDriverId ||
      lat === undefined ||
      lng === undefined ||
      Number.isNaN(lat) ||
      Number.isNaN(lng)
    ) {
      return res.status(400).json({
        error: 'Missing required fields: title, assignedToId, lat, lng',
      });
    }

    const assignedVehicle = await prisma.vehicle.findFirst({
      where: { assignedDriverId },
    });

    if (!assignedVehicle) {
      return res.status(400).json({
        error: 'The selected driver does not have an assigned vehicle.',
      });
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        employeeId: assignedDriverId,
        vehicleId: assignedVehicle.id,
        adminId: adminId!,
        companyId: req.user!.companyId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        scheduledStartDate: scheduledStartDate ? new Date(scheduledStartDate) : undefined,
        scheduledEndDate: scheduledEndDate ? new Date(scheduledEndDate) : undefined,
        address,
        lat,
        lng,
        pickupLocation,
        dropoffLocation,
        contactDetails,
      },
    });

    // Notify assigned employee of the new task
    emitToUser(employeeId, 'new_task', task);

    res.status(201).json(task);
  } catch (error) {
    console.error('Create task error', error);
    res.status(500).json({ error: 'Unable to create task' });
  }
});

// GET / - get tasks (OWNER/DISPATCHER see all; EMPLOYEE sees own tasks)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = req.user!;

    const baseWhere = { companyId: user.companyId };
    const where =
      user.role === 'EMPLOYEE'
        ? { ...baseWhere, employeeId: user.userId }
        : baseWhere;

    const tasks = await prisma.task.findMany({
      where,
      include: {
        employee: true,
        vehicle: true,
        admin: true,
      },
    });

    res.json(tasks);
  } catch (error) {
    console.error('Get tasks error', error);
    res.status(500).json({ error: 'Unable to fetch tasks' });
  }
});

// GET /:id - get single task by id (tenant-safe)
router.get('/:id', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const user = req.user!;
    const task = await prisma.task.findFirst({
      where: { id, companyId: user.companyId },
      include: { employee: true, vehicle: true, admin: true },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (error) {
    console.error('Get task error', error);
    res.status(500).json({ error: 'Unable to fetch task' });
  }
});

// PUT /:id - update task details (owner/dispatcher)
router.put('/:id', authMiddleware, requireRole('OWNER', 'DISPATCHER'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const user = req.user!;
    const {
      title,
      description,
      employeeId,
      assignedToId,
      startDate,
      endDate,
      scheduledStartDate,
      scheduledEndDate,
      address,
      lat: rawLat,
      lng: rawLng,
      pickupLocation,
      dropoffLocation,
      contactDetails,
    } = req.body;

    const assignedDriverId =
      assignedToId !== undefined
        ? Number(assignedToId)
        : employeeId !== undefined
        ? Number(employeeId)
        : undefined;

    const lat = rawLat !== undefined ? parseFloat(rawLat as string) : undefined;
    const lng = rawLng !== undefined ? parseFloat(rawLng as string) : undefined;

    if (
      !title ||
      !assignedDriverId ||
      lat === undefined ||
      lng === undefined ||
      Number.isNaN(lat) ||
      Number.isNaN(lng)
    ) {
      return res.status(400).json({
        error: 'Missing required fields: title, assignedToId, lat, lng',
      });
    }

    const existingTask = await prisma.task.findFirst({
      where: { id, companyId: user.companyId },
    });

    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found or access denied' });
    }

    const assignedVehicle = await prisma.vehicle.findFirst({
      where: { assignedDriverId },
    });

    if (!assignedVehicle) {
      return res.status(400).json({
        error: 'The selected driver does not have an assigned vehicle.',
      });
    }

    const updated = await prisma.task.update({
      where: { id },
      data: {
        title,
        description,
        employeeId: assignedDriverId,
        vehicleId: assignedVehicle.id,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        scheduledStartDate: scheduledStartDate ? new Date(scheduledStartDate) : undefined,
        scheduledEndDate: scheduledEndDate ? new Date(scheduledEndDate) : undefined,
        address,
        lat,
        lng,
        pickupLocation,
        dropoffLocation,
        contactDetails,
      },
    });

    res.json(
      await prisma.task.findFirst({
        where: { id, companyId: user.companyId },
        include: { employee: true, vehicle: true, admin: true },
      }),
    );
  } catch (error) {
    console.error('Update task error', error);
    res.status(500).json({ error: 'Unable to update task' });
  }
});

// PUT /:id/status - update status of a task (employee can update their own)
router.put('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const user = req.user!;

    if (!status) {
      return res.status(400).json({ error: 'Missing status' });
    }

    if (user.role === 'EMPLOYEE' && !['IN_PROGRESS', 'DONE'].includes(status)) {
      return res.status(403).json({ error: 'Employees can only set status to IN_PROGRESS or DONE' });
    }

    const task = await prisma.task.findFirst({
      where: { id: Number(id), companyId: req.user!.companyId },
      select: { employeeId: true },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found or access denied' });
    }

    if (user.role === 'EMPLOYEE' && task.employeeId !== user.userId) {
      return res.status(403).json({ error: 'Employees can only update their own tasks' });
    }

    const updateData: any = { status };
    if (status === 'DONE') {
      updateData.endDate = new Date();
    }

    const updateResult = await prisma.task.updateMany({
      where: { id: Number(id), companyId: req.user!.companyId },
      data: updateData,
    });

    if (updateResult.count === 0) {
      return res.status(404).json({ error: 'Task not found or access denied' });
    }

    const updated = await prisma.task.findFirst({
      where: { id: Number(id), companyId: req.user!.companyId },
    });

    // Notify owners/dispatchers of status change
    emitToRole('OWNER', 'task_status_updated', updated);
    emitToRole('DISPATCHER', 'task_status_updated', updated);

    res.json(updated);
  } catch (error) {
    console.error('Update task status error', error);
    res.status(500).json({ error: 'Unable to update task status' });
  }
});

// DELETE /:id - delete task (owner/dispatcher)
router.delete('/:id', authMiddleware, requireRole('OWNER', 'DISPATCHER'), async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const task = await prisma.task.findFirst({
      where: { id, companyId: req.user!.companyId },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found or access denied' });
    }

    await prisma.task.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('Delete task error', error);
    res.status(500).json({ error: 'Unable to delete task' });
  }
});

export default router;
