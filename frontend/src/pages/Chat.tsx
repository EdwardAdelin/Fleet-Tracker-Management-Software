import { useEffect, useRef, useState } from 'react';
import axiosClient from '../api/axiosClient';

type ChatMessage = {
  id: number;
  text: string;
  createdAt: string;
  sender: { fullName: string; role: string };
};

type User = {
  id?: number;
  fullName?: string;
  role?: string;
  email?: string;
};

function getCurrentUser(): User {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return {};
    return JSON.parse(raw) as User;
  } catch {
    return {};
  }
}

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const user = getCurrentUser();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const fetchMessages = async () => {
    setIsLoading(true);
    try {
      const { data } = await axiosClient.get<ChatMessage[]>('/messages');
      setMessages(data);
      setError('');
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 20);
    } catch (err) {
      console.error(err);
      setError('Unable to load messages.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = window.setInterval(fetchMessages, 5000);
    return () => window.clearInterval(interval);
  }, []);

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newMessage.trim()) return;

    setIsSending(true);
    setError('');

    try {
      await axiosClient.post('/messages', { text: newMessage.trim() });
      setNewMessage('');
      await fetchMessages();
    } catch (err) {
      console.error(err);
      setError((err as any)?.response?.data?.error || 'Unable to send message.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="h-full">
      <h1 className="text-2xl font-semibold text-slate-900">Company Group Chat</h1>
      <p className="mt-1 text-sm text-slate-500">Messages are shared with all members of your company.</p>

      <div className="mt-6 flex h-[70vh] flex-col rounded-2xl border border-slate-200 bg-white">
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <p className="text-sm text-slate-500">Loading messages…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-slate-500">No messages yet. Start the conversation!</p>
          ) : (
            messages.map((item) => {
              const isMine = item.sender.fullName === user.fullName;
              return (
                <div
                  key={item.id}
                  className={`mb-3 max-w-[85%] rounded-lg px-3 py-2 ${
                    isMine
                      ? 'ml-auto bg-indigo-50 text-indigo-900'
                      : 'bg-slate-100 text-slate-900'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>{item.sender.fullName} ({item.sender.role})</span>
                    <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-sm">{item.text}</div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={sendMessage} className="border-t border-slate-200 p-3">
          <div className="flex items-center gap-2">
            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              disabled={isSending}
            />
            <button
              type="submit"
              disabled={isSending || !newMessage.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              {isSending ? 'Sending...' : 'Send'}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        </form>
      </div>
    </div>
  );
}
