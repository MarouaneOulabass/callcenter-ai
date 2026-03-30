import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function OverviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const serviceClient = await createServiceClient();
  const { data: userData } = await serviceClient
    .from('users')
    .select('workspace_id')
    .eq('id', user!.id)
    .single();

  const workspaceId = userData?.workspace_id;

  // Fetch stats
  const [
    { count: totalConversations },
    { count: chatCount },
    { count: voiceCount },
    { count: escalatedCount },
    { count: sourcesCount },
    { data: workspace },
  ] = await Promise.all([
    serviceClient.from('conversations').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    serviceClient.from('conversations').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('channel', 'chat'),
    serviceClient.from('conversations').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('channel', 'voice'),
    serviceClient.from('conversations').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('escalated', true),
    serviceClient.from('knowledge_sources').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    serviceClient.from('workspaces').select('name').eq('id', workspaceId).single(),
  ]);

  const resolutionRate = totalConversations
    ? Math.round(((totalConversations - (escalatedCount || 0)) / totalConversations) * 100)
    : 0;

  const stats = [
    { title: 'Total conversations', value: totalConversations || 0, description: 'Toutes les interactions' },
    { title: 'Appels vocaux', value: voiceCount || 0, description: 'Via telephone' },
    { title: 'Chats', value: chatCount || 0, description: 'Widget + WhatsApp' },
    { title: 'Taux de resolution', value: `${resolutionRate}%`, description: 'Sans escalade humaine' },
    { title: 'Escalades', value: escalatedCount || 0, description: 'Transferts humains' },
    { title: 'Sources', value: sourcesCount || 0, description: 'Base de connaissance' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{workspace?.name || 'Dashboard'}</h1>
        <p className="text-muted-foreground mt-1">Vue d&apos;ensemble de votre agent IA</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
