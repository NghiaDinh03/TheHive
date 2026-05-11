'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Link2 } from '@/components/FaIcon';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { AdminSubnav } from '@/components/AdminSubnav';
import { apiFetch } from '@/lib/api';

type User = { login: string; name: string; permissions?: string[] };

export default function AdminMispPage() {
  return (
    <Suspense fallback={<div className="m-4">Loading MISP admin…</div>}>
      <MispWorkspace />
    </Suspense>
  );
}

function MispWorkspace() {
  const router = useRouter();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);

  useEffect(() => {
    const login = sessionStorage.getItem('thehive.login');
    if (!login) router.replace('/login');
    else setAuthedLogin(login);
  }, [router]);

  const me = useQuery({ queryKey: ['me'], queryFn: () => apiFetch<User>('/api/v1/auth/me'), enabled: !!authedLogin });

  if (!authedLogin) return null;

  return (
    <div className="flex min-h-screen thehive-app-shell">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={me.data ? { login: me.data.login, name: me.data.name } : { login: authedLogin }} />
        <AdminSubnav />
        <main className="content-wrapper flex-1 flex flex-col p-0">
          <div className="w-full h-full flex flex-col flex-1">
            <div className="bg-[#1D1E24] p-3 border-b border-[#2b2d35] flex items-center justify-between">
              <h1 className="text-lg font-semibold text-white flex items-center gap-2 m-0">
                <Link2 size={18} className="text-[#0077CC]" /> MISP Threat Intelligence
              </h1>
              <a href="https://localhost:8443" target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
                Open in new tab
              </a>
            </div>
            <div className="flex-1 w-full bg-black relative">
              <iframe
                src="https://localhost:8443"
                className="absolute top-0 left-0 w-full h-full border-none bg-white"
                title="MISP Integration"
                allowFullScreen
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
