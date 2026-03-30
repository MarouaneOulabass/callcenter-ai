export const dynamic = 'force-dynamic';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const serviceClient = await createServiceClient();
  const { data: userData } = await serviceClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userData?.role !== 'super_admin') {
    redirect('/overview');
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-red-600 to-red-400 bg-clip-text text-transparent">
              CallCenter AI — Super Admin
            </h1>
          </div>
          <a href="/overview" className="text-sm text-muted-foreground hover:text-primary">
            Retour au dashboard
          </a>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
