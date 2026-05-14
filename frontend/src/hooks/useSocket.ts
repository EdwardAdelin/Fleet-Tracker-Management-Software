import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'react-toastify';

export type SocketEvents = {
  new_task: (task: any) => void;
  task_status_updated: (task: any) => void;
};

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const rawUser = localStorage.getItem('user');

    if (!token || !rawUser) return;

    let user;
    try {
      user = JSON.parse(rawUser);
    } catch {
      return;
    }

    const socket = io('http://localhost:5000', {
      auth: {
        token,
      },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('register', {
        userId: user.id,
        role: user.role,
      });
    });

    socket.on('new_task', (task: any) => {
      toast.info(`New task assigned: ${task.title}`);
    });

    socket.on('task_status_updated', (task: any) => {
      toast.info(`Task updated: ${task.title} → ${task.status.replace('_', ' ')}`);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);
}
