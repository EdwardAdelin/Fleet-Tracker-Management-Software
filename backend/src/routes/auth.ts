import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Role } from '@prisma/client';
import prisma from '../prismaClient';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// helper to remove sensitive fields before sending user back
function sanitizeUser(user: User) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safe } = user;
  return safe;
}

router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName, companyName } = req.body as {
      email: string;
      password: string;
      fullName: string;
      companyName: string;
    };

    if (!email || !password || !fullName || !companyName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const company = await prisma.company.create({
      data: {
        name: companyName,
      },
    });

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        role: Role.OWNER,
        companyId: company.id,
      },
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, companyId: user.companyId },
      process.env.JWT_SECRET as string,
      { expiresIn: '1h' }
    );

    res.json({ token, user: sanitizeUser(user) });
  } catch (error) {
    console.error('Register error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, companyId: user.companyId },
      process.env.JWT_SECRET as string,
      { expiresIn: '1h' }
    );

    res.json({ token, user: sanitizeUser(user) });
  } catch (error) {
    console.error('Login error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /profile - update current user profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { fullName, email, newPassword } = req.body as {
      fullName?: string;
      email?: string;
      newPassword?: string;
    };

    const updateData: any = {};
    if (fullName) updateData.fullName = fullName;
    if (email) updateData.email = email;
    if (newPassword) {
      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    res.json(sanitizeUser(updatedUser));
  } catch (error) {
    console.error('Update profile error', error);
    res.status(500).json({ error: 'Unable to update profile' });
  }
});

export default router;
