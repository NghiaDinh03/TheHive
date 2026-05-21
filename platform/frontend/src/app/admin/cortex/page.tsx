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

export default function AdminCortexPage() {
  return (
    <Suspense fallback={<div className="m-4 text-slate-400">Đang tải thông tin…</div>}>
      <CortexWorkspace />
    </Suspense>
  );
}

function CortexWorkspace() {
  const router = useRouter();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);

  useEffect(() => {
    const login = sessionStorage.getItem('thehive.login') || localStorage.getItem('thehive.login');
    if (!login) router.replace('/login');
    else setAuthedLogin(login);
  }, [router]);

  const me = useQuery({ queryKey: ['me'], queryFn: () => apiFetch<User>('/api/v1/auth/me'), enabled: !!authedLogin });

  if (!authedLogin) return null;

  return (
    <div className="flex min-h-screen thehive-app-shell bg-[#0B0C10]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={me.data ? { login: me.data.login, name: me.data.name } : { login: authedLogin }} />
        <AdminSubnav />
        <main className="content-wrapper flex-1 flex items-center justify-center p-6 bg-slate-950/20">
          <div className="max-w-md w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-8 shadow-2xl text-center relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all duration-700" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all duration-700" />
            
            <div className="w-16 h-16 bg-blue-900/30 border border-blue-500/30 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner animate-pulse">
              <Link2 size={28} />
            </div>
            
            <h2 className="text-xl font-bold text-slate-100 mb-3 tracking-wide">
              Cortex Engine Đã Bị Vô Hiệu Hóa
            </h2>
            
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              Hệ thống <strong>NCS Fusion Center</strong> đã loại bỏ tích hợp Cortex Server để tinh giản tài nguyên. Mọi hoạt động phân tích dữ liệu độc hại (IOC) và phản ứng sự cố hiện đã được chuyển giao và tự động hóa toàn diện qua <strong>n8n</strong>.
            </p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => router.push('/investigation')}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-sm font-semibold transition-all duration-200 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 flex items-center justify-center gap-2"
              >
                Quay lại Giám sát
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
