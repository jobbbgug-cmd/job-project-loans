'use client';

import { useState, useEffect, useRef } from 'react';

interface LineMessage {
  id: number;
  line_user_id: string;
  display_name: string;
  message: string;
  received_at: string;
  used: boolean;
}

interface UserThread {
  userId: string;
  displayName: string;
  messages: LineMessage[];
  lastMessage: LineMessage;
}

export default function ChatPage() {
  const [threads, setThreads] = useState<UserThread[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedUserId, threads]);

  async function fetchMessages() {
    try {
      const res = await fetch('/api/loan/line-messages');
      const messages: LineMessage[] = await res.json();

      // Group by userId
      const grouped = new Map<string, UserThread>();
      messages.forEach(msg => {
        if (!grouped.has(msg.line_user_id)) {
          grouped.set(msg.line_user_id, {
            userId: msg.line_user_id,
            displayName: msg.display_name || 'Unknown',
            messages: [],
            lastMessage: msg,
          });
        }
        grouped.get(msg.line_user_id)!.messages.push(msg);
      });

      const sorted = Array.from(grouped.values())
        .sort((a, b) => new Date(b.lastMessage.received_at).getTime() - new Date(a.lastMessage.received_at).getTime());

      setThreads(sorted);
      if (sorted.length > 0 && !selectedUserId) {
        setSelectedUserId(sorted[0].userId);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoading(false);
    }
  }

  async function sendReply() {
    if (!selectedUserId || !replyText.trim()) return;

    setSending(true);
    try {
      const res = await fetch('/api/loan/line-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId, message: replyText }),
      });

      if (res.ok) {
        setReplyText('');
        // Refresh messages
        await fetchMessages();
      } else {
        alert('ไม่สามารถส่งแชทได้');
      }
    } catch (err) {
      console.error('Failed to send reply:', err);
      alert('เกิดข้อผิดพลาด');
    } finally {
      setSending(false);
    }
  }

  const selectedThread = threads.find(t => t.userId === selectedUserId);

  return (
    <div className="flex gap-4 h-[calc(100vh-200px)]">
      {/* Thread list */}
      <div className="w-80 border border-slate-700 rounded-lg overflow-hidden flex flex-col bg-slate-800">
        <div className="px-4 py-3 border-b border-slate-700 bg-slate-750">
          <h2 className="text-sm font-semibold text-white">บทสนทนา</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-slate-400 text-sm">กำลังโหลด...</div>
            </div>
          ) : threads.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-slate-400 text-sm">ไม่มีข้อความ</div>
            </div>
          ) : (
            threads.map(thread => (
              <button
                key={thread.userId}
                onClick={() => setSelectedUserId(thread.userId)}
                className={`w-full px-4 py-3 text-left border-b border-slate-700 transition-colors hover:bg-slate-700 ${
                  selectedUserId === thread.userId ? 'bg-slate-700 border-l-2 border-l-yellow-500' : ''
                }`}
              >
                <p className="text-sm font-medium text-white truncate">{thread.displayName}</p>
                <p className="text-xs text-slate-400 truncate">{thread.lastMessage.message}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {new Date(thread.lastMessage.received_at).toLocaleString('th-TH')}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat view */}
      <div className="flex-1 border border-slate-700 rounded-lg overflow-hidden flex flex-col bg-slate-800">
        {selectedThread ? (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-700 bg-slate-750">
              <h3 className="text-sm font-semibold text-white">{selectedThread.displayName}</h3>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-3 p-4">
              {selectedThread.messages.map((msg, i) => (
                <div key={i} className="flex justify-start">
                  <div className="max-w-xs bg-slate-700 rounded-lg px-4 py-2">
                    <p className="text-sm text-white break-words">{msg.message}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(msg.received_at).toLocaleString('th-TH')}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-slate-700 flex gap-2">
              <input
                type="text"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
                placeholder="พิมพ์ข้อความ..."
                disabled={sending}
                className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-yellow-500 disabled:opacity-50"
              />
              <button
                onClick={sendReply}
                disabled={sending || !replyText.trim()}
                className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {sending ? 'ส่ง...' : 'ส่ง'}
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-slate-400 text-sm">เลือกบทสนทนา</div>
          </div>
        )}
      </div>
    </div>
  );
}
