import { createServiceClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function StatsPage() {
  const supabase = await createServiceClient();

  const [
    { count: totalWorkspaces },
    { count: totalConversations },
    { count: totalVoice },
    { count: totalChat },
    { count: totalWhatsapp },
    { count: totalSources },
    { count: totalEscalated },
  ] = await Promise.all([
    supabase.from('workspaces').select('*', { count: 'exact', head: true }),
    supabase.from('conversations').select('*', { count: 'exact', head: true }),
    supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('channel', 'voice'),
    supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('channel', 'chat'),
    supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('channel', 'whatsapp'),
    supabase.from('knowledge_sources').select('*', { count: 'exact', head: true }),
    supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('escalated', true),
  ]);

  const stats = [
    { title: 'Workspaces actifs', value: totalWorkspaces || 0 },
    { title: 'Total conversations', value: totalConversations || 0 },
    { title: 'Appels vocaux', value: totalVoice || 0 },
    { title: 'Conversations chat', value: totalChat || 0 },
    { title: 'Messages WhatsApp', value: totalWhatsapp || 0 },
    { title: 'Sources de connaissance', value: totalSources || 0 },
    { title: 'Escalades', value: totalEscalated || 0 },
    {
      title: 'Taux de resolution global',
      value: totalConversations
        ? `${Math.round(((totalConversations - (totalEscalated || 0)) / totalConversations) * 100)}%`
        : 'N/A',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Statistiques globales</h1>
        <p className="text-muted-foreground mt-1">Vue d&apos;ensemble de la plateforme</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
