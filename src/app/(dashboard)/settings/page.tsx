'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Workspace } from '@/types';

export default function SettingsPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('fr');
  const [tone, setTone] = useState('neutral');
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [customPrompt, setCustomPrompt] = useState('');

  useEffect(() => {
    loadWorkspace();
  }, []);

  async function loadWorkspace() {
    const res = await fetch('/api/workspace');
    if (res.ok) {
      const data = await res.json();
      setWorkspace(data);
      setName(data.name);
      setLanguage(data.language);
      setTone(data.tone);
      setPrimaryColor(data.primary_color);
      setCustomPrompt(data.custom_prompt || '');
    }
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch('/api/workspace', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, language, tone, primary_color: primaryColor, custom_prompt: customPrompt }),
    });

    if (res.ok) {
      const data = await res.json();
      setWorkspace(data);
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Parametres</h1>
        <p className="text-muted-foreground mt-1">Configuration de votre agent et workspace</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations generales</CardTitle>
          <CardDescription>Identite de votre workspace</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nom de l&apos;entreprise</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Couleur principale</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-10 h-10 rounded border cursor-pointer"
              />
              <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-32" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comportement de l&apos;agent</CardTitle>
          <CardDescription>Langue, ton et instructions personnalisees</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Langue</Label>
              <Select value={language} onValueChange={(v) => v && setLanguage(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr">Francais</SelectItem>
                  <SelectItem value="ar">Arabe</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ton</Label>
              <Select value={tone} onValueChange={(v) => v && setTone(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="formal">Formel</SelectItem>
                  <SelectItem value="casual">Decontracte</SelectItem>
                  <SelectItem value="neutral">Neutre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Instructions personnalisees (optionnel)</Label>
            <Textarea
              placeholder="Ex: Toujours proposer un rendez-vous en cas de question technique complexe..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Ces instructions seront ajoutees au prompt systeme de l&apos;agent.
            </p>
          </div>
        </CardContent>
      </Card>

      {workspace?.twilio_number && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Telephone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">Numero Twilio : <span className="font-mono font-medium">{workspace.twilio_number}</span></p>
          </CardContent>
        </Card>
      )}

      <Button onClick={handleSave} disabled={saving}>
        {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
      </Button>
    </div>
  );
}
