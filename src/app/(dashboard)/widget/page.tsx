'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Workspace } from '@/types';

export default function WidgetPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/workspace').then(r => r.json()).then(setWorkspace);
  }, []);

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const embedCode = workspace
    ? `<script src="${appUrl}/widget.js" data-token="${workspace.id}" data-color="${workspace.primary_color}"></script>`
    : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Widget Chat</h1>
        <p className="text-muted-foreground mt-1">Integrez le chat sur votre site web</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Code d&apos;integration</CardTitle>
          <CardDescription>Collez ce code avant la balise &lt;/body&gt; de votre site</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-slate-950 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto">
            {embedCode || 'Chargement...'}
          </div>
          <Button onClick={handleCopy} disabled={!embedCode}>
            {copied ? 'Copie !' : 'Copier le code'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Apercu</CardTitle>
          <CardDescription>Voici a quoi ressemblera le widget sur votre site</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative border rounded-lg h-96 bg-white dark:bg-slate-900 overflow-hidden">
            {/* Preview of widget */}
            <div className="absolute bottom-4 right-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl shadow-lg cursor-pointer"
                style={{ backgroundColor: workspace?.primary_color || '#2563eb' }}
              >
                💬
              </div>
            </div>
            <div className="absolute bottom-20 right-4 w-80 bg-white dark:bg-slate-800 border rounded-2xl shadow-xl overflow-hidden">
              <div className="p-4 text-white" style={{ backgroundColor: workspace?.primary_color || '#2563eb' }}>
                <p className="font-semibold">{workspace?.name || 'Votre entreprise'}</p>
                <p className="text-sm opacity-90">Agent IA en ligne</p>
              </div>
              <div className="p-4 space-y-3">
                <div className="bg-slate-100 dark:bg-slate-700 rounded-2xl px-4 py-2 max-w-[80%]">
                  <p className="text-sm">Bonjour ! Comment puis-je vous aider ?</p>
                </div>
              </div>
              <div className="p-3 border-t flex gap-2">
                <div className="flex-1 bg-slate-50 dark:bg-slate-700 rounded-full px-4 py-2 text-sm text-muted-foreground">
                  Ecrivez votre message...
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
