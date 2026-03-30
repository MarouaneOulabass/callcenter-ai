'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { Conversation, Message } from '@/types';

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadConversations();
  }, []);

  async function loadConversations() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const res = await fetch('/api/conversations');
    if (res.ok) {
      const data = await res.json();
      setConversations(data);
    }
    setLoading(false);
  }

  async function loadMessages(conv: Conversation) {
    setSelected(conv);
    const res = await fetch(`/api/conversations/${conv.id}/messages`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data);
    }
  }

  const channelLabel = (ch: string) => {
    switch (ch) {
      case 'voice': return 'Appel';
      case 'chat': return 'Chat';
      case 'whatsapp': return 'WhatsApp';
      default: return ch;
    }
  };

  const channelColor = (ch: string) => {
    switch (ch) {
      case 'voice': return 'bg-green-100 text-green-700';
      case 'chat': return 'bg-blue-100 text-blue-700';
      case 'whatsapp': return 'bg-emerald-100 text-emerald-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Conversations</h1>
        <p className="text-muted-foreground mt-1">Historique de toutes les interactions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
        {/* Conversation list */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">
              {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <ScrollArea className="h-[calc(100vh-320px)]">
            <div className="px-4 pb-4 space-y-2">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadMessages(conv)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selected?.id === conv.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                      : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${channelColor(conv.channel)}`}>
                      {channelLabel(conv.channel)}
                    </span>
                    {conv.escalated && (
                      <Badge variant="destructive" className="text-xs">Escalade</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-1">
                    {conv.summary || 'Pas de resume'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(conv.started_at).toLocaleString('fr-FR')}
                  </p>
                </button>
              ))}
              {conversations.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Aucune conversation</p>
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Messages */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              {selected ? `Conversation du ${new Date(selected.started_at).toLocaleString('fr-FR')}` : 'Selectionnez une conversation'}
            </CardTitle>
            {selected?.summary && (
              <p className="text-sm text-muted-foreground mt-1">{selected.summary}</p>
            )}
          </CardHeader>
          <Separator />
          <ScrollArea className="h-[calc(100vh-380px)]">
            <div className="p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-blue-200' : 'text-muted-foreground'}`}>
                      {new Date(msg.created_at).toLocaleTimeString('fr-FR')}
                    </p>
                  </div>
                </div>
              ))}
              {!selected && (
                <p className="text-center text-muted-foreground py-12">
                  Selectionnez une conversation pour voir les messages
                </p>
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}
