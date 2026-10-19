import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, Search, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

export const MessagesPage: React.FC = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConv, setActiveConv] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = async () => {
    try {
      const res = await api.getConversations();
      setConversations(res?.conversations || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (convId: string) => {
    try {
      const res = await api.getMessages(convId);
      setMessages(res?.messages || []);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { loadConversations(); }, []);

  useEffect(() => {
    if (activeConv) loadMessages(activeConv.id);
  }, [activeConv]);

  const handleSend = async () => {
    if (!newMessage.trim() || !activeConv) return;
    setSending(true);
    try {
      await api.sendMessage(activeConv.id, newMessage.trim());
      setNewMessage('');
      loadMessages(activeConv.id);
      loadConversations();
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const filteredConversations = conversations.filter(c =>
    !search || c.other_party_name?.toLowerCase().includes(search.toLowerCase())
  );

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-display font-bold text-charcoal mb-6">Messages</h1>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 240px)', minHeight: '500px' }}>
        <div className="flex h-full">
          {/* Sidebar */}
          <div className="w-72 border-r border-gray-100 flex flex-col shrink-0">
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal/40" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search conversations…"
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-green/30"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-6 h-6 border-2 border-forest-green border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <MessageSquare className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-charcoal/60">No conversations yet</p>
                  <p className="text-xs text-charcoal/40 mt-1">Contact a seller from a product page to start messaging</p>
                </div>
              ) : (
                filteredConversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConv(conv)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 ${
                      activeConv?.id === conv.id ? 'bg-forest-green/5 border-l-2 border-l-forest-green' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-charcoal text-sm truncate">{conv.other_party_name || 'Unknown'}</p>
                        <p className="text-xs text-charcoal/50 truncate mt-0.5">{conv.last_message || 'No messages yet'}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        {conv.last_message_at && (
                          <p className="text-xs text-charcoal/40">{formatTime(conv.last_message_at)}</p>
                        )}
                        {conv.unread_count > 0 && (
                          <span className="inline-block mt-1 w-5 h-5 bg-forest-green text-white text-xs rounded-full flex items-center justify-center font-bold">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Message area */}
          <div className="flex-1 flex flex-col min-w-0">
            {!activeConv ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="font-semibold text-charcoal">Select a conversation</p>
                  <p className="text-sm text-charcoal/60 mt-1">Choose from the list on the left</p>
                </div>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <div className="p-4 border-b border-gray-100 bg-white">
                  <p className="font-semibold text-charcoal">{activeConv.other_party_name}</p>
                  {activeConv.product_title && (
                    <p className="text-xs text-charcoal/50 mt-0.5">Re: {activeConv.product_title}</p>
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-charcoal/50">No messages yet. Say hello!</p>
                    </div>
                  ) : (
                    messages.map((msg: any) => {
                      const isMe = msg.sender_id === user?.id;
                      return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
                            isMe
                              ? 'bg-forest-green text-white rounded-br-sm'
                              : 'bg-gray-100 text-charcoal rounded-bl-sm'
                          }`}>
                            <p className="leading-relaxed">{msg.content}</p>
                            <p className={`text-xs mt-1 ${isMe ? 'text-white/60' : 'text-charcoal/40'}`}>
                              {formatTime(msg.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-gray-100 bg-white">
                  <div className="flex items-end gap-3">
                    <textarea
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message… (Enter to send)"
                      rows={1}
                      className="flex-1 px-4 py-3 bg-gray-50 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-forest-green/30 focus:bg-white transition-colors"
                      style={{ maxHeight: '120px' }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!newMessage.trim() || sending}
                      className="p-3 bg-forest-green text-white rounded-xl hover:bg-forest-green/90 disabled:opacity-50 transition-colors shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
