'use client';

import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import type { KnowledgeSource } from '@/types';

export default function KnowledgeBasePage() {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');
  const [scrapeUrl, setScrapeUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSources();
    const interval = setInterval(loadSources, 5000); // Poll for status updates
    return () => clearInterval(interval);
  }, []);

  async function loadSources() {
    const res = await fetch('/api/knowledge');
    if (res.ok) {
      setSources(await res.json());
    }
    setLoading(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/knowledge/upload', { method: 'POST', body: formData });
    if (res.ok) {
      loadSources();
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleFaqSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!faqQuestion || !faqAnswer) return;

    const res = await fetch('/api/knowledge/faq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: faqQuestion, answer: faqAnswer }),
    });

    if (res.ok) {
      setFaqQuestion('');
      setFaqAnswer('');
      loadSources();
    }
  }

  async function handleScrape(e: React.FormEvent) {
    e.preventDefault();
    if (!scrapeUrl) return;

    const res = await fetch('/api/knowledge/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: scrapeUrl }),
    });

    if (res.ok) {
      setScrapeUrl('');
      loadSources();
    }
  }

  async function handleDelete(sourceId: string) {
    const res = await fetch('/api/knowledge', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId }),
    });

    if (res.ok) {
      loadSources();
    }
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-green-100 text-green-700">Termine</Badge>;
      case 'processing': return <Badge className="bg-yellow-100 text-yellow-700">En cours</Badge>;
      case 'error': return <Badge variant="destructive">Erreur</Badge>;
      default: return <Badge variant="secondary">En attente</Badge>;
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case 'file': return 'Fichier';
      case 'faq': return 'FAQ';
      case 'web': return 'Web';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Base de connaissance</h1>
        <p className="text-muted-foreground mt-1">Alimentez l&apos;agent avec vos donnees</p>
      </div>

      <Tabs defaultValue="upload" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upload">Upload fichier</TabsTrigger>
          <TabsTrigger value="faq">FAQ manuelle</TabsTrigger>
          <TabsTrigger value="scrape">Scraping web</TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Uploader un document</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-8 text-center">
                  <p className="text-sm text-muted-foreground mb-4">
                    PDF, Word (.docx), TXT ou CSV — max 10 MB
                  </p>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt,.csv"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="max-w-xs mx-auto"
                  />
                  {uploading && <Progress value={50} className="mt-4 max-w-xs mx-auto" />}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faq">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ajouter une FAQ</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleFaqSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Question</Label>
                  <Input
                    placeholder="Ex: Quels sont vos horaires d'ouverture ?"
                    value={faqQuestion}
                    onChange={(e) => setFaqQuestion(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reponse</Label>
                  <Textarea
                    placeholder="Ex: Nous sommes ouverts du lundi au vendredi, de 9h a 18h."
                    value={faqAnswer}
                    onChange={(e) => setFaqAnswer(e.target.value)}
                    rows={4}
                  />
                </div>
                <Button type="submit" disabled={!faqQuestion || !faqAnswer}>
                  Ajouter
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scrape">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Scraper un site web</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleScrape} className="space-y-4">
                <div className="space-y-2">
                  <Label>URL du site</Label>
                  <Input
                    type="url"
                    placeholder="https://www.votresite.com"
                    value={scrapeUrl}
                    onChange={(e) => setScrapeUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Les 50 premieres pages seront analysees automatiquement.
                  </p>
                </div>
                <Button type="submit" disabled={!scrapeUrl}>
                  Lancer le scraping
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sources list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sources ({sources.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Chargement...</p>
          ) : sources.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              Aucune source ajoutee. Commencez par uploader un fichier ou ajouter une FAQ.
            </p>
          ) : (
            <div className="space-y-3">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{typeLabel(source.type)}</Badge>
                    <div>
                      <p className="text-sm font-medium">{source.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(source.created_at).toLocaleString('fr-FR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {statusBadge(source.status)}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(source.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Supprimer
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
