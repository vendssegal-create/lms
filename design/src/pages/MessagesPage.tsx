import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchThreadDetail, fetchThreads, markThreadRead } from '@/src/api/messages';
import { ChatArea } from '@/src/components/messages/ChatArea';
import { ThreadSidebar } from '@/src/components/messages/ThreadSidebar';
import { useAuth } from '@/src/features/auth/auth-context';
import type { MessagesThreadListItem, MessagesThreadMessage } from '@/src/types';

export default function MessagesPage() {
  const { threadId } = useParams<{ threadId?: string }>();
  const activeThreadId = threadId ? Number(threadId) : null;
  const navigate = useNavigate();
  const { session, refreshSession } = useAuth();
  const [threads, setThreads] = useState<MessagesThreadListItem[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [messages, setMessages] = useState<MessagesThreadMessage[]>([]);
  const [activeThread, setActiveThread] = useState<MessagesThreadListItem | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [isMobileListOpen, setIsMobileListOpen] = useState(!activeThreadId);

  const meId = session?.user?.id || 0;

  useEffect(() => {
    setThreadsLoading(true);
    fetchThreads()
      .then((response) => setThreads(response.items))
      .finally(() => setThreadsLoading(false));
  }, []);

  useEffect(() => {
    if (!activeThreadId) {
      setActiveThread(null);
      setMessages([]);
      return;
    }
    setMessagesLoading(true);
    const found = threads.find((thread) => thread.id === activeThreadId) || null;
    setActiveThread(found);
    fetchThreadDetail(activeThreadId, 80)
      .then((response) => {
        setMessages(response.messages);
        void markThreadRead(activeThreadId).then(() => refreshSession({ silent: true })).catch(() => {});
      })
      .finally(() => setMessagesLoading(false));
  }, [activeThreadId, threads, refreshSession]);

  function selectThread(nextThreadId: number) {
    navigate(`/messages/${nextThreadId}`);
    setIsMobileListOpen(false);
  }

  function handleNewMessage(message: MessagesThreadMessage) {
    setMessages((prev) => (prev.some((item) => item.id === message.id) ? prev : [...prev, message]));
    setThreads((prev) => prev
      .map((thread) => (thread.id === message.thread_id ? { ...thread, last_message: message, updated_at: message.created_at } : thread))
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
  }

  function handleMessageDeleted(messageId: number) {
    setMessages((prev) => prev.map((message) => (message.id === messageId ? { ...message, is_deleted: true, body: "[o'chirildi]" } : message)));
  }

  function handleReaction(messageId: number, reactions: Record<string, number>) {
    setMessages((prev) => prev.map((message) => (message.id === messageId ? { ...message, reactions } : message)));
  }

  function handleMessagesRead(readerId: number, readAt: string) {
    if (readerId === meId) return;
    setMessages((prev) => prev.map((message) => (message.sender_id === meId && !message.is_read ? { ...message, is_read: true, read_at: readAt } : message)));
  }

  return (
    <div className="flex h-[calc(100vh-96px)] overflow-hidden rounded-[32px] border border-border bg-white shadow-premium">
      <ThreadSidebar
        threads={threads}
        activeThreadId={activeThreadId}
        loading={threadsLoading}
        meId={meId}
        onSelect={selectThread}
        isMobileOpen={isMobileListOpen}
        onMobileClose={() => setIsMobileListOpen(false)}
      />
      {activeThreadId && activeThread ? (
        <ChatArea
          threadId={activeThreadId}
          otherUser={activeThread.other_user}
          messages={messages}
          loading={messagesLoading}
          meId={meId}
          onNewMessage={handleNewMessage}
          onMessageDeleted={handleMessageDeleted}
          onReaction={handleReaction}
          onMessagesRead={handleMessagesRead}
          onBackToList={() => setIsMobileListOpen(true)}
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-primary/10">
            <MessageCircle size={36} className="text-primary/60" />
          </div>
          <h3 className="text-xl font-black text-text-primary">Suhbat tanlang</h3>
          <p className="max-w-xs text-sm text-text-secondary">Chap paneldan mavjud suhbatni tanlang yoki yangi suhbat boshlang.</p>
        </div>
      )}
    </div>
  );
}
