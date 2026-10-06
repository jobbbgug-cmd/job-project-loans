'use client';

import { useState, useEffect, useRef } from 'react';

interface LineMessage {
  id: number;
  line_user_id: string;
  display_name: string;
  message: string;
  received_at: string;
  used: boolean;
  type?: 'outgoing'; // undefined means incoming (default)
  image_url?: string; // Image message URL
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      // Sort messages ascending (oldest first) and threads by last message descending
      Array.from(grouped.values()).forEach(thread => {
        thread.messages.sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime());
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

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('ไฟล์ต้องไม่เกิน 5MB');
      return;
    }

    // Compress image
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Resize to max 800px
        const canvas = document.createElement('canvas');
        const maxWidth = 800;
        const maxHeight = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to JPEG with quality 0.7
        const compressed = canvas.toDataURL('image/jpeg', 0.7);
        setPreview(compressed);

        // Create blob from canvas
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, { type: 'image/jpeg' });
            setSelectedFile(compressedFile);
          }
        }, 'image/jpeg', 0.7);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function sendReply() {
    if (!selectedUserId || (!replyText.trim() && !selectedFile)) return;

    setSending(true);
    try {
      const formData = new FormData();
      formData.append('userId', selectedUserId);
      if (replyText.trim()) formData.append('message', replyText);
      if (selectedFile) formData.append('file', selectedFile);

      const res = await fetch('/api/loan/line-reply', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        console.log('📥 Response from server:', data);
        console.log('📥 Messages received:', data.messages?.length);

        setReplyText('');
        setSelectedFile(null);
        setPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';

        // Update thread with new messages immediately
        if (data.messages && Array.isArray(data.messages)) {
          console.log('✓ Adding messages to thread. Count:', data.messages.length);
          data.messages.forEach((msg: any, i: number) => {
            console.log(`  Message ${i}: type=${msg.type}, hasImage=${!!msg.image_url}, message="${msg.message}"`);
          });

          setThreads(prev => {
            const updated = prev.map(thread => {
              if (thread.userId === selectedUserId) {
                const newMessages = [...thread.messages, ...data.messages];
                console.log('✓ Thread updated. Total messages:', newMessages.length);
                return {
                  ...thread,
                  messages: newMessages,
                  lastMessage: data.messages[data.messages.length - 1],
                };
              }
              return thread;
            });
            return updated;
          });
        } else {
          console.warn('⚠️ No messages in response');
        }
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

  // Mobile: show full-screen list or conversation; Desktop: side-by-side
  const showConversation = selectedUserId !== null;

  return (
    <div className="h-[calc(100vh-200px)] flex gap-4">
      {/* Thread list - hidden on mobile when conversation is selected */}
      <div className={`${
        showConversation ? 'hidden md:flex' : 'flex'
      } w-full md:w-80 border border-slate-700 rounded-lg overflow-hidden flex-col bg-slate-800`}>
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

      {/* Chat view - full width on mobile when selected, side-by-side on desktop */}
      <div className={`${
        selectedUserId === null ? 'hidden md:flex' : 'flex'
      } flex-1 border border-slate-700 rounded-lg overflow-hidden flex-col bg-slate-800`}>
        {selectedThread ? (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-700 bg-slate-750 flex items-center gap-3">
              <button
                onClick={() => setSelectedUserId(null)}
                className="md:hidden text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h3 className="text-sm font-semibold text-white">{selectedThread.displayName}</h3>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-3 p-4">
              {selectedThread.messages.map((msg, i) => {
                const isOutgoing = msg.type === 'outgoing';
                const hasImage = msg.image_url;
                const hasText = msg.message && msg.message !== '[Image]';

                return (
                  <div key={i} className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs rounded-lg overflow-hidden ${
                      isOutgoing
                        ? 'bg-yellow-500 text-slate-900'
                        : 'bg-slate-700 text-white'
                    }`}>
                      {hasImage ? (
                        <>
                          {msg.image_url ? (
                            <img
                              src={msg.image_url}
                              alt="chat image"
                              className="w-full max-h-96 object-cover"
                              onError={() => console.error('Image load failed:', msg.image_url?.substring(0, 100))}
                              onLoad={() => console.log('✓ Image loaded:', msg.image_url?.substring(0, 100))}
                            />
                          ) : (
                            <div className="px-4 py-2 bg-red-500/20">
                              <p className="text-xs text-red-400">⚠️ No image URL</p>
                            </div>
                          )}
                          <div className={`px-4 py-2 ${
                            isOutgoing ? 'text-slate-800' : 'text-slate-400'
                          }`}>
                            <p className="text-xs">
                              {new Date(msg.received_at).toLocaleString('th-TH')}
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          {hasText && (
                            <div className="px-4 py-2">
                              <p className="text-sm break-words whitespace-pre-wrap">{msg.message}</p>
                            </div>
                          )}
                          <div className={`px-4 py-2 ${
                            hasText ? 'pt-0' : ''
                          } ${
                            isOutgoing ? 'text-slate-800' : 'text-slate-400'
                          }`}>
                            <p className="text-xs">
                              {new Date(msg.received_at).toLocaleString('th-TH')}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Preview */}
            {preview && (
              <div className="px-4 py-2 border-t border-slate-700 flex gap-2 items-end">
                <img src={preview} alt="preview" className="h-20 rounded-lg border border-slate-600" />
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-slate-400 hover:text-red-400 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Input */}
            <div className="px-4 py-3 border-t border-slate-700 flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
                className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded-lg disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <input
                type="text"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey && !selectedFile) {
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
                disabled={sending || (!replyText.trim() && !selectedFile)}
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
