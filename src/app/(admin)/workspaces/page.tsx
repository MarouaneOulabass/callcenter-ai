import { createServiceClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default async function WorkspacesPage() {
  const supabase = await createServiceClient();

  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('*, users(count), conversations(count), knowledge_sources(count)')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Workspaces</h1>
        <p className="text-muted-foreground mt-1">Gestion de tous les clients</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total workspaces</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{workspaces?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total conversations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {workspaces?.reduce((sum, w) => sum + ((w.conversations as unknown as { count: number }[])?.[0]?.count || 0), 0) || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {workspaces?.reduce((sum, w) => sum + ((w.knowledge_sources as unknown as { count: number }[])?.[0]?.count || 0), 0) || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tous les workspaces</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Langue</TableHead>
                <TableHead>Ton</TableHead>
                <TableHead>Conversations</TableHead>
                <TableHead>Sources</TableHead>
                <TableHead>Telephone</TableHead>
                <TableHead>Cree le</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workspaces?.map((ws) => (
                <TableRow key={ws.id}>
                  <TableCell className="font-medium">{ws.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {ws.language === 'fr' ? 'FR' : ws.language === 'ar' ? 'AR' : 'EN'}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize">{ws.tone}</TableCell>
                  <TableCell>{(ws.conversations as unknown as { count: number }[])?.[0]?.count || 0}</TableCell>
                  <TableCell>{(ws.knowledge_sources as unknown as { count: number }[])?.[0]?.count || 0}</TableCell>
                  <TableCell className="font-mono text-sm">{ws.twilio_number || '—'}</TableCell>
                  <TableCell>{new Date(ws.created_at).toLocaleDateString('fr-FR')}</TableCell>
                </TableRow>
              ))}
              {(!workspaces || workspaces.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Aucun workspace
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
