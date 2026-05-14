import 'dotenv/config'; // Încarcă automat datele din .env
import express from 'express';
import cors from 'cors';
import http from 'http';
import prisma from './prismaClient';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import vehiclesRouter from './routes/vehicles';
import tasksRouter from './routes/tasks';
import maintenanceRouter from './routes/maintenance';
import documentsRouter from './routes/documents';
import messagesRouter from './routes/messages';
import routingRouter from './routes/routing';
import { initSocket } from './socket';

const app = express();

// Middleware-uri esențiale
app.use(cors());
app.use(express.json());

// authentication routes
app.use('/api/auth', authRouter);

// vehicles management (protected)
app.use('/api/vehicles', vehiclesRouter);

// users (protected)
app.use('/api/users', usersRouter);

// task management (protected)
app.use('/api/tasks', tasksRouter);

// maintenance logs (protected)
app.use('/api/maintenance', maintenanceRouter);

// documents (protected)
app.use('/api/documents', documentsRouter);

// company group chat messages (protected)
app.use('/api/messages', messagesRouter);

// route optimization utilities (protected)
app.use('/api/routing', routingRouter);

// O rută de test pentru a verifica conexiunea la baza de date
app.get('/api/test', async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.json({ 
        mesaj: 'Salut! Serverul funcționează perfect și este conectat la baza de date.', 
        utilizatori_in_db: users 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ eroare: 'Nu am putut interoga baza de date.' });
  }
});

// Pornirea serverului cu conectare Prisma și oprire grațioasă
const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await prisma.$connect();

    const server = http.createServer(app);
    initSocket(server);

    server.listen(PORT, () => {
      console.log(`🚀 Serverul a pornit cu succes și rulează pe http://localhost:${PORT}`);
    });

    const shutdown = async () => {
      console.log('📦 Închidere server...');
      server.close(async () => {
        await prisma.$disconnect();
        console.log('✅ Prisma disconnected.');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    console.error('Eroare la conectarea la baza de date:', error);
    process.exit(1);
  }
}

start();