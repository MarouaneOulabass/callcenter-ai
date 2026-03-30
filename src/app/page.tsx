import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950">
      {/* Header */}
      <header className="border-b border-slate-200/50 dark:border-slate-800/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
            CallCenter AI
          </h1>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Se connecter</Button>
            </Link>
            <Link href="/register">
              <Button>Commencer gratuitement</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <div className="inline-block px-4 py-1.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-full mb-6">
          Support client propulse par l&apos;IA
        </div>
        <h2 className="text-5xl md:text-6xl font-bold tracking-tight text-slate-900 dark:text-white max-w-4xl mx-auto leading-tight">
          Remplacez votre call center par un{' '}
          <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
            agent IA intelligent
          </span>
        </h2>
        <p className="mt-6 text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          Appels telephoniques, chat web et WhatsApp — un seul agent IA qui repond 24/7
          avec le contexte de votre entreprise. Operationnel en moins de 10 minutes.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/register">
            <Button size="lg" className="text-base px-8 py-6">
              Creer mon agent IA
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              title: 'Appels vocaux',
              desc: 'Votre agent repond au telephone avec une voix naturelle. Transcription et resume automatiques de chaque appel.',
            },
            {
              title: 'Chat widget',
              desc: 'Widget embeddable en une ligne de code. Chat en temps reel avec historique et escalade automatique.',
            },
            {
              title: 'WhatsApp',
              desc: "Vos clients ecrivent sur WhatsApp, l'agent IA repond instantanement avec le meme contexte.",
            },
            {
              title: 'Base de connaissance',
              desc: "Uploadez vos PDF, ajoutez des FAQ ou scrapez votre site. L'agent s'entraine automatiquement.",
            },
            {
              title: 'IA contextuelle',
              desc: "Propulse par Claude, l'agent comprend le contexte de chaque conversation et repond avec precision.",
            },
            {
              title: 'Dashboard analytics',
              desc: 'Suivez les conversations, le taux de resolution et identifiez les questions frequentes.',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6"
            >
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Operationnel en 3 etapes</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { step: '1', title: 'Creez votre workspace', desc: 'Inscrivez-vous et configurez la langue et le ton de votre agent.' },
            { step: '2', title: 'Alimentez la base', desc: 'Uploadez vos documents, ajoutez vos FAQ ou scrapez votre site web.' },
            { step: '3', title: 'Activez les canaux', desc: 'Integrez le widget chat, connectez votre numero de telephone et WhatsApp.' },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                {item.step}
              </div>
              <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 mt-20">
        <div className="max-w-6xl mx-auto px-6 py-8 text-center text-sm text-slate-500">
          CallCenter AI. Tous droits reserves.
        </div>
      </footer>
    </div>
  );
}
