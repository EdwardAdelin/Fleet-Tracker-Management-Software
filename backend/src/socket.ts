import { Server } from 'socket.io';
import http from 'http';

type UserRegisterPayload = {
  userId: number;
  role: string;
};

const userSockets = new Map<number, Set<string>>();
const roleSockets = new Map<string, Set<string>>();
let io: Server | null = null;

function addToMap(map: Map<any, Set<string>>, key: any, socketId: string) {
  const set = map.get(key) ?? new Set();
  set.add(socketId);
  map.set(key, set);
}

function removeFromMap(map: Map<any, Set<string>>, key: any, socketId: string) {
  const set = map.get(key);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) map.delete(key);
}

export function initSocket(server: http.Server) {
  io = new Server(server, {
    cors: {
      origin: true,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('Socket connected', socket.id);

    socket.on('register', (payload: UserRegisterPayload) => {
      if (!payload || typeof payload.userId !== 'number' || !payload.role) return;
      addToMap(userSockets, payload.userId, socket.id);
      addToMap(roleSockets, payload.role, socket.id);
      socket.data = { userId: payload.userId, role: payload.role };
    });

    socket.on('disconnect', () => {
      const { userId, role } = (socket.data as any) ?? {};
      if (typeof userId === 'number') {
        removeFromMap(userSockets, userId, socket.id);
      }
      if (typeof role === 'string') {
        removeFromMap(roleSockets, role, socket.id);
      }
      console.log('Socket disconnected', socket.id);
    });
  });

  return io;
}

export function emitToUser(userId: number, event: string, payload: any) {
  const sockets = userSockets.get(userId);
  if (!sockets || !io) return;
  for (const id of sockets) {
    io.to(id).emit(event, payload);
  }
}

export function emitToRole(role: string, event: string, payload: any) {
  const sockets = roleSockets.get(role);
  if (!sockets || !io) return;
  for (const id of sockets) {
    io.to(id).emit(event, payload);
  }
}
