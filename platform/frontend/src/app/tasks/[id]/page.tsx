'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { apiFetch } from '@/lib/api';

type User = { login: string; name: string };

export default function TaskTimelinePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);
  useEffect(() => { const login = sessionStorage.getItem('thehive.login'); if (!login) router.replace('/login'); else setAuthedLogin(login); }, [router]);
  const me = useQuery({ queryKey: ['me'], queryFn: () => apiFetch<User>('/api/v1/auth/me'), enabled: !!authedLogin });
  if (!authedLogin) return null;
  return <div className="flex min-h-screen"><Sidebar /><div className="flex-1 flex flex-col"><Topbar user={me.data ?? { login: authedLogin }} /><main className="flex-1 p-4 md:p-6"><div className="case-detail-layout"><section className="thehive-card"><div className="thehive-card-header case-detail-header"><div><h1>Task {params.id}</h1><p>Task/log timeline foundation · TheHive 4 style</p></div><span className="label label-default">Waiting</span></div><div className="thehive-card-body"><div className="timeline"><div className="timeline-item"><span className="timeline-dot" /><div><strong>Task created</strong><p>Append-only task log events will render here.</p></div></div><div className="timeline-item"><span className="timeline-dot" /><div><strong>Analyst note</strong><p>Markdown/log rendering placeholder with attachment hooks.</p></div></div></div></div></section><aside className="thehive-card"><div className="thehive-card-header">Task actions</div><div className="thehive-card-body detail-tabs"><button>Assign</button><button>Close</button><button>Add log</button><button>Attach file</button></div></aside></div></main></div></div>;
}
