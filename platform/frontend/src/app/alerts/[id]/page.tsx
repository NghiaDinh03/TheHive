'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { apiFetch } from '@/lib/api';

type User = { login: string; name: string };
type AlertItem = { id: string; title: string; type: string; source: string; source_ref: string; severity: number; tlp: number; status: string; read: boolean; tags: string[]; created_at: string };
type AlertCollection = { values: AlertItem[] };

export default function AlertDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);
  useEffect(() => { const login = sessionStorage.getItem('thehive.login'); if (!login) router.replace('/login'); else setAuthedLogin(login); }, [router]);
  const me = useQuery({ queryKey: ['me'], queryFn: () => apiFetch<User>('/api/v1/auth/me'), enabled: !!authedLogin });
  const alerts = useQuery({ queryKey: ['alert-detail', params.id], queryFn: () => apiFetch<AlertCollection>(`/api/v1/alerts?filter=id:${params.id}`), enabled: !!authedLogin && !!params.id });
  const item = alerts.data?.values?.[0];
  if (!authedLogin) return null;
  return <div className="flex min-h-screen"><Sidebar /><div className="flex-1 flex flex-col"><Topbar user={me.data ?? { login: authedLogin }} /><main className="flex-1 p-4 md:p-6"><div className="case-detail-layout"><section className="thehive-card"><div className="thehive-card-header case-detail-header"><div><h1>{item?.title ?? 'Alert detail'}</h1><p>Alert import / merge workflow foundation · TheHive 4 style</p></div><span className="label label-warning">{item?.status ?? 'Loading'}</span></div><div className="thehive-card-body"><div className="case-detail-grid"><Info label="Severity" value={item?.severity} /><Info label="TLP" value={item?.tlp} /><Info label="Type" value={item?.type} /><Info label="Source" value={item?.source} /><Info label="Reference" value={item?.source_ref} /><Info label="Created" value={item ? new Date(item.created_at).toLocaleString() : 'Loading'} /></div><h3 className="detail-section-title">Import / merge actions</h3><div className="detail-action-row"><button className="thehive-btn-primary">Import into case</button><button className="thehive-btn-secondary">Merge similar alerts</button></div></div></section><aside className="thehive-card"><div className="thehive-card-header">Similar alerts</div><div className="thehive-card-body thehive-empty">Similarity engine placeholder</div></aside></div></main></div></div>;
}

function Info({ label, value }: { label: string; value: unknown }) { return <div className="detail-info"><span>{label}</span><strong>{String(value ?? '—')}</strong></div>; }
