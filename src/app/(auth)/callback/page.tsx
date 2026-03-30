'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function CallbackPage() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        router.push('/overview');
      }
    });
  }, [router, supabase.auth]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Connexion en cours...</p>
    </div>
  );
}
