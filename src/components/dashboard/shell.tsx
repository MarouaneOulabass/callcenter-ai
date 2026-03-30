'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import type { User } from '@supabase/supabase-js';

const navItems = [
  { href: '/overview', label: 'Vue d\'ensemble', icon: '📊' },
  { href: '/conversations', label: 'Conversations', icon: '💬' },
  { href: '/knowledge-base', label: 'Base de connaissance', icon: '📚' },
  { href: '/settings', label: 'Parametres', icon: '⚙️' },
  { href: '/widget', label: 'Widget', icon: '🔌' },
];

export function DashboardShell({ children, user }: { children: React.ReactNode; user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 z-40 h-screen bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all ${sidebarOpen ? 'w-64' : 'w-16'}`}>
        <div className="flex h-16 items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800">
          {sidebarOpen && (
            <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
              CallCenter AI
            </h1>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="h-8 w-8 p-0"
          >
            {sidebarOpen ? '\u2190' : '\u2192'}
          </Button>
        </div>

        <nav className="flex flex-col gap-1 p-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                pathname === item.href
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-medium'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-slate-200 dark:border-slate-800">
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full flex items-center justify-start gap-3 h-auto py-2 px-3 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                    {user.email?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {sidebarOpen && (
                  <div className="text-left">
                    <p className="text-sm font-medium truncate max-w-[140px]">{user.email}</p>
                    <p className="text-xs text-muted-foreground">Admin</p>
                  </div>
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={handleLogout}>
                Se deconnecter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main content */}
      <main className={`transition-all ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
