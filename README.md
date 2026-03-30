# CallCenter AI

Plateforme SaaS de support client propulsee par l'IA. Un agent IA qui repond aux appels telephoniques, au chat web et a WhatsApp, entraine automatiquement sur le contexte metier du client.

## Stack technique

- **Frontend** : Next.js 16 (App Router), Tailwind CSS, shadcn/ui
- **Backend** : Next.js API Routes (serverless)
- **Base de donnees** : Supabase (PostgreSQL + pgvector + Auth + Storage)
- **IA** : Google Gemini (POC) / Anthropic Claude (production)
- **Voix** : Vapi.ai + Twilio + ElevenLabs (phase 2)
- **Cache** : Upstash Redis (optionnel)

## Switch AI Provider : Gemini (gratuit) vs Claude (payant)

Le projet supporte **deux modes** configures via une seule variable d'environnement :

```env
AI_PROVIDER=gemini      # Mode POC gratuit
AI_PROVIDER=anthropic   # Mode production payant
```

### Pourquoi ce switch ?

| | Mode `gemini` (POC) | Mode `anthropic` (Production) |
|---|---|---|
| **LLM** | Google Gemini 2.0 Flash | Anthropic Claude Sonnet |
| **Embeddings** | Google text-embedding-004 | OpenAI text-embedding-3-small |
| **Cout** | Gratuit (15 req/min, 1M tokens/jour) | Payant (usage-based) |
| **Qualite** | Tres bon pour validation | Meilleur pour production |
| **Cles requises** | `GOOGLE_AI_API_KEY` uniquement | `ANTHROPIC_API_KEY` + `OPENAI_API_KEY` |

**Motivation** : eviter de payer des API pendant la phase de validation du POC. Gemini offre un tier gratuit genereux suffisant pour tester toutes les fonctionnalites (chat, RAG, knowledge base). Une fois le POC valide, on bascule en production en changeant `AI_PROVIDER=anthropic` dans `.env.local`.

### Comment basculer en production

1. Changer `AI_PROVIDER=anthropic` dans `.env.local`
2. Ajouter `ANTHROPIC_API_KEY` (console.anthropic.com)
3. Ajouter `OPENAI_API_KEY` (platform.openai.com)
4. **Important** : si vous avez deja des embeddings en base generes par Gemini, il faut les re-generer car les dimensions sont differentes (Gemini: 768 dims padde a 1536 vs OpenAI: 1536 natif). Supprimez les chunks existants et re-uploadez les sources.

### Fichiers concernes par le switch

- `src/lib/rag/embeddings.ts` — generation des embeddings (Gemini ou OpenAI)
- `src/lib/rag/engine.ts` — appel LLM pour les reponses (Gemini ou Claude)

## Installation rapide

### 1. Cloner et installer

```bash
git clone https://github.com/MarouaneOulabass/callcenter-ai.git
cd callcenter-ai
npm install
```

### 2. Configurer Supabase (gratuit)

1. Creer un projet sur [supabase.com](https://supabase.com)
2. Aller dans SQL Editor et executer le contenu de `supabase/migrations/001_initial_schema.sql`
3. Copier les cles depuis Settings > API

### 3. Configurer Google AI (gratuit)

1. Aller sur [aistudio.google.com](https://aistudio.google.com)
2. Creer une cle API
3. La mettre dans `GOOGLE_AI_API_KEY`

### 4. Remplir `.env.local`

```env
AI_PROVIDER=gemini
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GOOGLE_AI_API_KEY=AIza...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Lancer

```bash
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

## Fonctionnalites

- **Multi-tenant** : chaque client a son workspace isole (RLS Supabase)
- **Knowledge Base** : upload PDF/DOCX/TXT/CSV, FAQ manuelle, scraping de site web
- **RAG** : recherche vectorielle pgvector + reponse contextuelle via LLM
- **Chat widget** : embeddable en 1 ligne de code `<script>`
- **Appels vocaux** : integration Vapi.ai avec transcription et resume automatique
- **WhatsApp** : webhook Twilio
- **Dashboard client** : stats, conversations, gestion KB, parametres agent
- **Super admin** : gestion multi-clients, stats globales
- **Escalade humaine** : detection automatique quand l'agent ne sait pas repondre

## Structure du projet

```
src/
  app/
    (auth)/          # Login, Register, Callback
    (dashboard)/     # Overview, Conversations, KB, Settings, Widget
    (admin)/         # Super admin (Workspaces, Stats)
    api/
      auth/          # Auth callback + workspace setup
      chat/          # Chat API (authenticated)
      knowledge/     # Upload, FAQ, Scrape
      webhook/       # Vapi (voix) + WhatsApp (Twilio)
      widget/        # Chat public (token-based)
      workspace/     # GET/PATCH workspace config
      conversations/ # Liste + messages
  lib/
    rag/             # Embeddings, Chunker, Engine, Ingest
    supabase/        # Client, Server, Middleware
    vapi/            # Vapi.ai client
    twilio/          # Twilio client
  components/
    ui/              # shadcn/ui
    dashboard/       # Shell (sidebar + layout)
  types/             # TypeScript interfaces
public/
  widget.js          # Script chat embeddable
supabase/
  migrations/        # Schema SQL + RLS + pgvector
```

## Deploiement (Vercel)

```bash
npm run build   # Verifier que le build passe
```

1. Connecter le repo GitHub a [Vercel](https://vercel.com)
2. Ajouter toutes les variables d'environnement
3. Deployer
4. Mettre a jour les webhook URLs (Vapi, Twilio) avec le domaine de prod
