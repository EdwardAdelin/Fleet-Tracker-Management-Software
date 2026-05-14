import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { authMiddleware, requireRole } from '../middleware/auth';
import prisma from '../prismaClient';

const router = Router();

// GET / - list users in the tenant company
router.get('/', authMiddleware, requireRole('OWNER', 'DISPATCHER'), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { companyId: req.user!.companyId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
      },
    });

    res.json(users);
  } catch (error) {
    console.error('Get users error', error);
    res.status(500).json({ error: 'Unable to fetch users' });
  }
});

// POST / - create a new employee
router.post('/', authMiddleware, requireRole('OWNER', 'DISPATCHER'), async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body as {
      fullName: string;
      email: string;
      password: string;
      role: 'EMPLOYEE' | 'DISPATCHER';
    };

    if (!fullName || !email || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (role !== 'EMPLOYEE' && role !== 'DISPATCHER') {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        role,
        companyId: req.user!.companyId,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
      },
    });

    res.status(201).json(user);
  } catch (error) {
    console.error('Create user error', error);
    res.status(500).json({ error: 'Unable to create user' });
  }
});

// DELETE /:id - delete employee (owner only)
router.delete('/:id', authMiddleware, requireRole('OWNER'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const userToDelete = await prisma.user.findUnique({ where: { id } });
    if (!userToDelete || userToDelete.companyId !== req.user!.companyId) {
      return res.status(404).json({ error: 'User not found' });
    }

    await prisma.user.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('Delete user error', error);
    res.status(500).json({ error: 'Unable to delete user' });
  }
});

export default router;
